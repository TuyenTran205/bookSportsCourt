# 05 – Đặt sân & Realtime

> **Phiên bản:** 1.0.0 | **Cập nhật lần cuối:** 2026-09-30 | **Trạng thái:** TÀI LIỆU SỐNG CÒN

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
[held] ──────────── expires_at (10 phút) ──────────► [expired]
    │
    │ POST /payments (thanh toán)
    ▼
[pending_payment]
    │
    │ Webhook xác nhận
    ├────────────────────────────────────────────► [confirmed]
    │                                                   │
    │ Webhook thất bại / timeout                        │ Thời gian qua
    ▼                                                   ▼
[cancelled]                                        [completed]
                                                        │
                                                        │ Owner đánh dấu
                                                        ▼
                                                   [no_show]
```

### Bảng chuyển trạng thái hợp lệ

| Từ → | → held | → pending_payment | → confirmed | → completed | → cancelled | → expired | → no_show |
|------|--------|-------------------|-------------|-------------|-------------|-----------|-----------|
| (tạo mới) | ✅ | | | | | | |
| held | | ✅ | | | ✅ | ✅ | |
| pending_payment | | | ✅ | | ✅ | | |
| confirmed | | | | ✅ | ✅ | | |
| completed | | | | | | | ✅ |

Mọi chuyển trạng thái ngoài bảng trên phải ném lỗi `INVALID_STATUS_TRANSITION`.

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

    // 2. Tạo booking mới (EXCLUDE constraint sẽ từ chối nếu trùng)
    const [booking] = await tx.insert(bookings).values({
      court_id: courtId,
      customer_id: customerId,
      during,
      status: 'held',
      expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 phút
      total_price: await this.calculatePrice(courtId, during, tx),
    }).returning();

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

### Webhook thanh toán
```typescript
// Dùng idempotency_key để tránh xử lý 2 lần
const existing = await tx.select().from(payments)
  .where(eq(payments.idempotency_key, webhookData.ref));
if (existing.length > 0) return; // Đã xử lý rồi, bỏ qua
```

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
- [ ] **BOOKING-TEST-07:** Webhook thanh toán idempotent (gọi 2 lần chỉ xử lý 1 lần).
- [ ] **BOOKING-TEST-08:** Chuyển trạng thái không hợp lệ → nhận lỗi INVALID_STATUS_TRANSITION.
- [ ] **BOOKING-TEST-09:** Blackout period chặn booking trong khoảng thời gian đó.
- [ ] **BOOKING-TEST-10:** WebSocket emit đúng payload sau khi tạo hold.
