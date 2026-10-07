# 05 – Đặt sân & Realtime

> **Phiên bản:** 1.1.0 | **Cập nhật lần cuối:** 2026-10-07 | **Trạng thái:** TÀI LIỆU SỐNG CÒN

## 1. Block 30 phút

- **Đơn vị tối thiểu:** 30 phút.
- **Ràng buộc:** Thời điểm bắt đầu và kết thúc PHẢI là bội số của 30 phút (`:00` hoặc `:30`).
- **Lưu trữ:** UTC dưới dạng `TSTZRANGE` (kiểu `[start, end)`  – nửa mở phía phải).
- **Hiển thị:** Chuyển đổi sang `Asia/Ho_Chi_Minh` ở tầng API (response) và FE.

**Ví dụ hợp lệ:**
```
[2026-10-15 08:00:00+07, 2026-10-15 09:30:00+07)   ✅ 3 block liên tiếp
[2026-10-15 01:00:00+00, 2026-10-15 02:30:00+00)   ✅ Lưu UTC tương đương
```

**Ví dụ KHÔNG hợp lệ:**
```
[2026-10-15 08:15:00+07, 2026-10-15 09:00:00+07)   ❌ Không phải bội số 30
[2026-10-15 08:00:00+07, 2026-10-15 08:00:00+07)   ❌ Khoảng trống (0 phút)
```

## 2. Chống trùng lịch (EXCLUDE Constraint)

```sql
EXCLUDE USING gist (
  court_id WITH =,
  during   WITH &&
) WHERE (status IN ('held', 'pending_payment', 'confirmed'))
```

**Giải thích:**
- Toán tử `&&` (overlap) từ extension `btree_gist` phát hiện 2 range giao nhau.
- Chỉ áp dụng cho trạng thái hoạt động; `cancelled/expired/no_show/completed` không bị ảnh hưởng.
- Khi vi phạm, PostgreSQL ném lỗi code `23P01` (exclusion_violation).
- Service bắt lỗi này và trả về HTTP 409 với mã lỗi `BOOKING_CONFLICT`.

**KHÔNG được:**
- Dựa vào SELECT kiểm tra trước (TOCTOU race condition).
- Thêm kiểm tra ở FE hoặc service thay thế constraint DB.

## 3. Vòng đời Booking

```
HOLD REQUEST
    │
    ▼
[held] ──── expires_at (10 phút, khách chưa gửi ảnh) ────► [expired]
    │
    │ POST /bookings/:id/payment/proof (người đặt chuyển khoản QR chủ sân, gửi ảnh xác nhận)
    ▼
[pending_payment]  (vẫn chiếm block, chờ Owner duyệt)
    │
    │ Owner duyệt (PATCH /owner/payments/:id/approve)
    ├────────────────────────────────────────────► [confirmed]
    │                                                   │
    │ Owner từ chối, hoặc quá 2 giờ Owner                │ Thời gian qua
    │ chưa xử lý (cron)                                 ▼
    ▼                                              [completed]
[cancelled]                                             │
                                                        │ Owner đánh dấu
                                                        ▼
                                                   [no_show]
```

**Booking thủ công của Owner (OWN-07):** tạo thẳng ở trạng thái `confirmed` với `source = 'manual'` và `payments.provider = 'cash'` (status `completed`), bỏ qua `held` và `pending_payment`.

### Bảng chuyển trạng thái hợp lệ

| Từ → | → held | → pending_payment | → confirmed | → completed | → cancelled | → expired | → no_show |
|------|--------|-------------------|-------------|-------------|-------------|-----------|-----------|
| (tạo mới) | ✅ | | ✅ (chỉ booking thủ công) | | | | |
| held | | ✅ | | | ✅ | ✅ | |
| pending_payment | | | ✅ | | ✅ | | |
| confirmed | | | | ✅ | ✅ | | |
| completed | | | | | | | ✅ |

Mọi chuyển trạng thái ngoài bảng trên phải ném lỗi `INVALID_STATUS_TRANSITION`.

### Trạng thái thanh toán đi kèm

| `bookings.status` | `payments.status` | Người thực hiện |
|-------------------|-------------------|-----------------|
| `held` | `pending` (tạo cùng lúc với hold, có `transfer_code`) | Hệ thống |
| `expired` | `expired` | Cron hết hạn hold 10 phút, khách chưa gửi ảnh |
| `pending_payment` | `submitted` | Người đặt gửi ảnh xác nhận chuyển khoản |
| `confirmed` | `completed` | Owner duyệt |
| `cancelled` | `rejected` | Owner từ chối (kèm `reject_reason`) |
| `cancelled` | `refunded` | Khách/Owner huỷ booking đã `completed` thanh toán, hoàn theo chính sách huỷ |
| `cancelled` | `cancelled` | Khách huỷ khi thanh toán chưa duyệt (`pending`/`submitted`), hoặc quá hạn Owner duyệt (cron); không tạo hoàn tiền |

### Quy trình thanh toán chuyển khoản QR

1. Khách tạo hold: server tính `total_price`, `deposit_amount = total_price × deposit_percent / 100` (theo `cancellation_policies`, mặc định 100%), sinh `transfer_code` dạng `BSC-XXXXXX`, và tạo `payments` ở trạng thái `pending`. Nếu venue chưa có `venue_payment_accounts`, hold bị từ chối với lỗi `PAYMENT_ACCOUNT_MISSING`.
2. API trả `bankBin`, `accountNo`, `accountName`; **FE tự dựng mã QR phía client** từ các trường này cùng số tiền cọc `deposit_amount` và nội dung `transfer_code` (không gọi dịch vụ sinh QR bên ngoài, server không lưu ảnh QR). Người đặt quét mã để chuyển khoản qua ứng dụng ngân hàng, FE vẫn hiển thị ngân hàng, số tài khoản và nội dung dạng văn bản kèm nút sao chép để dự phòng khi không quét được.
3. Lúc xác nhận thanh toán, người đặt gửi ảnh đã chuyển khoản lên hệ thống trong vòng 10 phút kể từ lúc hold. Server lưu `proof_url`, đặt `payments.status = 'submitted'`, `bookings.status = 'pending_payment'` và **xoá `expires_at`** (hết hạn hold không còn áp dụng).
4. Owner nhận thông báo realtime `booking_created`/`payment_submitted`, đối chiếu ảnh với sao kê, rồi duyệt hoặc từ chối.
5. Quá **2 giờ** (hằng số `OWNER_REVIEW_TIMEOUT`, cấu hình qua env) kể từ `proof_uploaded_at` mà Owner chưa xử lý, cron chuyển booking sang `cancelled` và thông báo cho khách. Hệ thống không tự hoàn tiền; khách liên hệ Owner.
6. Owner **phải** được xác nhận là chủ của venue chứa court trong booking (`NOT_VENUE_OWNER`) trước khi duyệt/từ chối.

**Hạn chế đã chấp nhận (MVP):** không có đối soát tự động với ngân hàng; Owner chịu trách nhiệm kiểm tra ảnh chuyển khoản. Tích hợp webhook ngân hàng (SePay/Casso/PayOS) để dành cho giai đoạn sau, xem ADR-006.

## 4. Giữ chỗ (Hold) và Expire

### Tạo Hold
```typescript
// BookingService.hold() – trong một transaction
async hold(courtId: string, during: TsTzRange, customerId: string): Promise<Booking> {
  return this.db.transaction(async (tx) => {
    // 1. Expire các hold quá hạn của court này TRƯỚC (vì EXCLUDE áp dụng cho 'held')
    await tx.update(bookings)
      .set({ status: 'expired', updated_at: new Date() })
      .where(and(
        eq(bookings.court_id, courtId),
        eq(bookings.status, 'held'),
        lt(bookings.expires_at, new Date())
      ));

    // 2. Tính giá ở server (bỏ qua mọi giá từ client) và lấy chính sách cọc
    const total_price = await this.calculatePrice(courtId, during, tx);
    const policy = await this.getCancellationPolicy(courtId, tx); // mặc định deposit 100%

    // 3. Tạo booking mới (EXCLUDE constraint sẽ từ chối nếu trùng)
    const [booking] = await tx.insert(bookings).values({
      court_id: courtId,
      customer_id: customerId,
      during,
      status: 'held',
      expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 phút
      total_price,
      deposit_amount: Math.round(total_price * policy.deposit_percent / 100),
    }).returning();

    // 4. Tạo payment chờ chuyển khoản, kèm mã nội dung chuyển khoản
    await tx.insert(payments).values({
      booking_id: booking.id,
      amount: booking.deposit_amount,
      provider: 'bank_transfer',
      transfer_code: generateTransferCode(), // "BSC-" + 6 ký tự ngẫu nhiên
      status: 'pending',
    });

    return booking;
  });
}
```

### Cron Expire (mỗi phút)
```typescript
@Cron('* * * * *') // Mỗi phút
async expireHolds() {
  await this.db.update(bookings)
    .set({ status: 'expired', updated_at: new Date() })
    .where(and(
      eq(bookings.status, 'held'),
      lt(bookings.expires_at, new Date())
    ));
  // Sau đó emit WebSocket để client biết slot available lại
}
```

### Cron huỷ booking quá hạn duyệt (mỗi 5 phút)
```typescript
@Cron('*/5 * * * *')
async cancelStalePendingPayments() {
  // pending_payment mà payments.proof_uploaded_at < now() - OWNER_REVIEW_TIMEOUT
  // → bookings.status = 'cancelled', cancel_reason = 'Chủ sân không xử lý kịp thời'
  // → emit booking_cancelled cho khách, slot_updated cho room venue
}
```

**Lưu ý:** EXCLUDE constraint dùng `=` cho court_id, không thể dùng `now()` như filter thông thường. Vì vậy cần expire trước trong cùng transaction.

## 5. Tính giá (Price Calculation)

```typescript
// Giá tính ở SERVER, KHÔNG ở client
async calculatePrice(courtId: string, during: TsTzRange, tx: Tx): Promise<number> {
  const rules = await tx.select().from(pricing_rules)
    .where(eq(pricing_rules.court_id, courtId))
    .orderBy(desc(pricing_rules.priority));

  // Chia during thành các block 30 phút
  const blocks = splitIntoBlocks(during); // mỗi block là [start, end)

  return blocks.reduce((total, block) => {
    const rule = findMatchingRule(rules, block); // So khớp giờ, thứ, ngày lễ
    return total + (rule?.price_per_slot ?? 0);
  }, 0);
}
```

**Quy tắc ưu tiên pricing_rules:**
1. `date_override` cụ thể (ngày lễ) – ưu tiên cao nhất.
2. `day_of_week` cụ thể + `start_time/end_time`.
3. Rule chung (không có `day_of_week`).
4. `priority` số cao hơn = ưu tiên hơn.

## 6. Realtime (Socket.IO)

### Kênh (Channel/Room)
```
venue:{venueId}:date:{yyyy-mm-dd}
```

Ví dụ: `venue:uuid-abc:date:2026-10-15`

### Payload sự kiện `slot_updated`
```typescript
interface SlotUpdatedPayload {
  courtId: string;
  date: string;         // yyyy-mm-dd
  slots: Array<{
    start: string;      // ISO UTC: "2026-10-15T01:00:00.000Z"
    end:   string;      // ISO UTC: "2026-10-15T01:30:00.000Z"
    status: 'available' | 'held' | 'booked' | 'blocked' | 'past';
  }>;
}
```

**Nguyên tắc payload:** Chỉ gửi dữ liệu tối thiểu cần thiết để update, không gửi toàn bộ lịch.

### Phía client (FE)
```typescript
// Merge vào TanStack Query cache
queryClient.setQueryData(['slots', venueId, date], (old: SlotsData) => ({
  ...old,
  courts: old.courts.map(court =>
    court.id === payload.courtId
      ? { ...court, slots: mergeSlots(court.slots, payload.slots) }
      : court
  )
}));
```

### Xử lý mất kết nối
```typescript
socket.on('disconnect', () => setConnectionStatus('disconnected'));

socket.on('connect', () => {
  setConnectionStatus('connected');
  // Đồng bộ lại toàn bộ trạng thái
  queryClient.invalidateQueries(['slots', venueId, date]);
});
```

## 7. Idempotency & Race Condition

### Duyệt thanh toán và tính idempotent
Không có webhook ở MVP. Việc duyệt phải idempotent: gọi `approve` lần 2 trên payment đã `completed` trả 200 với trạng thái hiện tại, không đổi dữ liệu; gọi `approve` trên payment `rejected`/booking `cancelled` trả `INVALID_STATUS_TRANSITION`.
```typescript
// PaymentsService.approve() – trong một transaction, khoá hàng bằng FOR UPDATE
const [p] = await tx.select().from(payments)
  .where(eq(payments.id, paymentId)).for('update');
if (p.status === 'completed') return p;            // đã duyệt, bỏ qua
if (p.status !== 'submitted') throw new InvalidStatusTransition();
```
Cột `payments.idempotency_key` giữ lại (NULL ở MVP) cho tích hợp webhook ngân hàng sau này.

### Race condition – 2 người đặt cùng lúc
- Không cần distributed lock ở MVP (1 instance).
- PostgreSQL EXCLUDE constraint + transaction đảm bảo chỉ 1 INSERT thành công.
- Người đến sau nhận lỗi 409 ngay lập tức.

## 8. Edge Cases

| Tình huống | Xử lý |
|------------|-------|
| **Booking qua nửa đêm** | `during` vẫn là một range liên tục; kiểm tra giờ mở cửa theo từng ngày trong range |
| **Owner đổi giờ mở cửa** | Chỉ ảnh hưởng booking tương lai; booking đã confirmed không bị huỷ tự động |
| **Owner khoá giờ có booking đã confirmed** | API trả lỗi `CONFLICT_WITH_EXISTING_BOOKING`; phải huỷ booking trước |
| **Huỷ hàng loạt** | Dùng batch update trong transaction; emit WebSocket sau khi hoàn thành |
| **Client gửi giá sai** | Server bỏ qua giá từ client; luôn tính lại từ pricing_rules |

## 9. Danh sách Test Bắt buộc

- [ ] **BOOKING-TEST-01:** Tạo hold thành công cho block trống.
- [ ] **BOOKING-TEST-02:** Hold thứ 2 trên cùng block → nhận 409 BOOKING_CONFLICT.
- [ ] **BOOKING-TEST-03:** Hold hết hạn sau 10 phút → block trở về available.
- [ ] **BOOKING-TEST-04:** Cron expire chạy và expire đúng hold quá hạn.
- [ ] **BOOKING-TEST-05:** **[QUAN TRỌNG]** N request đồng thời đặt cùng một block → chỉ 1 thành công, N-1 nhận 409.
- [ ] **BOOKING-TEST-06:** Giá tính đúng theo pricing_rules (khung giờ, thứ, ngày lễ).
- [ ] **BOOKING-TEST-07:** Duyệt thanh toán idempotent (Owner approve 2 lần chỉ xử lý 1 lần, không lỗi).
- [ ] **BOOKING-TEST-11:** Người đặt gửi ảnh xác nhận chuyển khoản → booking sang `pending_payment`, `expires_at` bị xoá, cron expire không huỷ.
- [ ] **BOOKING-TEST-12:** Owner của venue khác duyệt/từ chối → 403 `NOT_VENUE_OWNER`.
- [ ] **BOOKING-TEST-13:** Quá `OWNER_REVIEW_TIMEOUT` chưa duyệt → cron chuyển `cancelled`, slot trả về available.
- [ ] **BOOKING-TEST-14:** `deposit_amount` tính đúng theo `deposit_percent`, bỏ qua giá từ client.
- [ ] **BOOKING-TEST-08:** Chuyển trạng thái không hợp lệ → nhận lỗi INVALID_STATUS_TRANSITION.
- [ ] **BOOKING-TEST-09:** Blackout period chặn booking trong khoảng thời gian đó.
- [ ] **BOOKING-TEST-10:** WebSocket emit đúng payload sau khi tạo hold.
