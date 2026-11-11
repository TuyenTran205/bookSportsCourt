# 05 – Đặt sân & Realtime

> **Phiên bản:** 1.4.2 | **Cập nhật lần cuối:** 2026-11-08 | **Trạng thái:** TÀI LIỆU SỐNG CÒN

**Bổ sung Phase 4 đã chốt:** snapshot/deadline/retry/lock/outbox. Protocol này cần được Phase 2 và Phase 4 cùng triển khai; chưa xác nhận runtime đã có. Các ví dụ SQL dưới đây minh hoạ chuyển trạng thái, không thay thế lock/recheck/outbox trong contract.

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

### Điều kiện Venue và phối hợp với xoá/kiểm duyệt (BSC-014)

Hold/manual booking mới chỉ tạo khi Venue approved và chưa xoá. Transaction tạo booking khoá user rồi Venue FOR SHARE và kiểm tra lại điều kiện trước khi INSERT; mutation Venue khoá user rồi Venue FOR UPDATE. DELETE bị chặn với 409 RESOURCE_IN_USE nếu còn booking held/pending_payment/confirmed trên bất kỳ Court của Venue (kể cả hold quá giờ chưa expire và Court đã xoá). Nếu DELETE commit trước, request tạo booking phải bị từ chối; nếu booking commit trước, DELETE phải thấy booking và bị chặn. EXCLUDE vẫn là bảo vệ cuối chống trùng slot.

Owner sửa làm Venue về pending hoặc Admin đình chỉ không huỷ/đổi giá booking hiện có. Lịch sử và xử lý payment vẫn truy cập theo quyền booking; không lọc mất lịch sử do Venue/Court bị xoá mềm. Đây là yêu cầu triển khai Phase 2/3, chưa phải xác nhận đã có service. Quy tắc đầy đủ ở mục BSC-014 của [API contract](11-api-contract.md).

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

### 2.1 Khoá giờ bảo trì & Mở khoá sân (Blackout Period – OWN-08)

Chủ sân có quyền tạm dừng nhận khách trên một sân trong một khoảng thời gian nhất định (bảo trì định kỳ, sửa chữa mặt sân, tổ chức sự kiện).

- **Tạo khoá sân (`POST /api/v1/courts/:id/blackouts`):**
  - **Ràng buộc:** Thời gian khoá phải là bội số của 30 phút, nằm trong ngày cụ thể (không áp dụng lặp qua các ngày khác), và **không được đè** lên booking đang hoạt động (`held`, `pending_payment`, `confirmed`). DB có constraint `excl_blackout_overlap` chống 2 blackout đè nhau trên cùng court.
  - **Trạng thái slot:** Các block 30 phút nằm trong khoảng khoá chuyển sang trạng thái `blocked`. Khách không thể chọn hoặc giữ chỗ các block này.
  - **Bảo vệ tầng DB:** Trigger `trg_bookings_no_blackout` (`reject_booking_in_blackout()`) chặn ở tầng PostgreSQL mọi hành vi tạo booking đè lên blackout (trả lỗi `23P01`).
  - **Realtime:** Server emit sự kiện `slot_updated` vào room `venue:{venueId}:date:{yyyy-mm-dd}` với các slot mang `status: 'blocked'`.

- **Mở khoá sân (`DELETE /api/v1/courts/:id/blackouts/:blackoutId`):**
  - Xoá bản ghi `blackout_periods`.
  - **Khôi phục trạng thái:** Các block 30 phút trong khoảng thời gian vừa mở khoá lập tức trở về trạng thái `available` (miễn là nằm trong giờ mở cửa `opening_hours` của sân và chưa qua giờ hiện tại `past`).
  - **Realtime:** Server emit sự kiện `slot_updated` vào room `venue:{venueId}:date:{yyyy-mm-dd}` với các slot mang `status: 'available'`. Mọi khách đang xem lịch hoặc chủ sân khác đang mở màn hình đều thấy sân khả dụng ngay lập tức mà không cần reload trang.
  - **Trải nghiệm chủ sân (UX):** Chủ sân có 2 cách mở khoá:
    1. Click trực tiếp vào bất kỳ block sọc xám `blocked` trên `OwnerTimeline` → mở Detail Panel hiển thị lý do bảo trì và nút **"Mở khoá sân"** (kèm hộp thoại xác nhận).
    2. Nhấn nút "Khoá sân" trên thanh công cụ → xem danh sách các khoảng khoá đang có hiệu lực trong ngày (`activeBlackouts`) và nhấn nút icon mở khoá từng khoảng.

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
    │ Owner từ chối, hoặc quá 2 giờ Owner                ├── cron hết giờ sử dụng ──► [completed] (terminal)
    │ chưa xử lý (cron)                                 │
    ▼                                                   └── Owner đánh dấu ────────► [no_show]   (terminal)
[cancelled] (terminal)
```

**`completed` là terminal** – không có đường ra. Booking đã qua giờ sử dụng thì không huỷ được nữa; nếu phát sinh tranh chấp, xử lý ngoài hệ thống (hoàn tiền thủ công, xem mục 7).

**Booking thủ công của Owner (OWN-07):** tạo thẳng ở trạng thái `confirmed` với `source = 'manual'` và `payments.provider = 'cash'` (status `completed`), bỏ qua `held` và `pending_payment`.

### Bảng chuyển trạng thái hợp lệ

| Từ → | → held | → pending_payment | → confirmed | → completed | → cancelled | → expired | → no_show |
|------|--------|-------------------|-------------|-------------|-------------|-----------|-----------|
| (tạo mới) | ✅ | | ✅ (chỉ booking thủ công) | | | | |
| held | | ✅ | | | ✅ | ✅ | |
| pending_payment | | | ✅ | | ✅ | | |
| confirmed | | | | ✅ (cron hết giờ sử dụng) | ✅ | | ✅ (Owner đánh dấu) |
| completed | | | | | | | |
| cancelled | | | | | | | |
| expired | | | | | | | |
| no_show | | | | | | | |

Mọi chuyển trạng thái ngoài bảng trên phải ném lỗi `INVALID_STATUS_TRANSITION`.

**Bốn trạng thái kết thúc (terminal):** `completed`, `cancelled`, `expired`, `no_show` — không có chuyển tiếp nào đi ra. Đặc biệt **không** có `completed → cancelled`: huỷ chỉ xảy ra trước khi booking hoàn tất; sau khi đã `completed` thì không huỷ được nữa.

**`confirmed → completed` do cron `autoCompleteBookings` thực hiện** (mục 6), không do người dùng bấm. `confirmed → no_show` do Owner đánh dấu (OWN-09) và chỉ hợp lệ sau khi giờ bắt đầu đã qua.

### Trạng thái thanh toán đi kèm

| `bookings.status` | `payments.status` | Người thực hiện |
|-------------------|-------------------|-----------------|
| `held` | `pending` (tạo cùng lúc với hold, có `transfer_code`) | Hệ thống |
| `expired` | `expired` | Cron hết hạn hold 10 phút, khách chưa gửi ảnh |
| `pending_payment` | `submitted` | Người đặt gửi ảnh xác nhận chuyển khoản |
| `confirmed` | `completed` | Owner duyệt |
| `cancelled` | `rejected` | Owner từ chối (kèm `reject_reason`) |
| `cancelled` | `completed`, rồi `refunded` sau xác nhận hoàn tiền | Khách/Owner huỷ theo chính sách, Owner chuyển tiền ngoài hệ thống rồi gọi refund để ghi nhận; không tự refunded khi mới huỷ |
| `cancelled` | `cancelled` | Khách huỷ khi thanh toán chưa duyệt (`pending`/`submitted`), hoặc quá hạn Owner duyệt (cron); không tạo hoàn tiền |

### Quy trình thanh toán chuyển khoản QR

1. Khách tạo hold: server tính `total_price`, `deposit_amount = total_price × deposit_percent / 100` (theo `cancellation_policies`, mặc định 100%), sinh `transfer_code` dạng `BSC-XXXXXX`, và tạo `payments` ở trạng thái `pending`. Nếu venue chưa có `venue_payment_accounts`, hold bị từ chối với lỗi `PAYMENT_ACCOUNT_MISSING`.
2. API trả `bankBin`, `accountNo`, `accountName`; **FE tự dựng mã QR phía client** từ các trường này cùng số tiền cọc `deposit_amount` và nội dung `transfer_code` (không gọi dịch vụ sinh QR bên ngoài, server không lưu ảnh QR). Người đặt quét mã để chuyển khoản qua ứng dụng ngân hàng, FE vẫn hiển thị ngân hàng, số tài khoản và nội dung dạng văn bản kèm nút sao chép để dự phòng khi không quét được.
3. Lúc xác nhận thanh toán, người đặt gửi ảnh đã chuyển khoản lên hệ thống trong vòng 10 phút kể từ lúc hold. Server lưu `proof_url`, đặt `payments.status = 'submitted'`, `bookings.status = 'pending_payment'` và **xoá `expires_at`** (hết hạn hold không còn áp dụng).
4. Owner nhận thông báo realtime `booking_created`/`payment_submitted`, đối chiếu ảnh với sao kê, rồi duyệt hoặc từ chối.
5. Quá **2 giờ** (hằng số `OWNER_REVIEW_TIMEOUT`, cấu hình qua env) kể từ `proof_uploaded_at` mà Owner chưa xử lý, cron chuyển booking sang `cancelled` và thông báo cho khách. Hệ thống không tự hoàn tiền; khách liên hệ Owner.
6. Owner **phải** được xác nhận là chủ của venue chứa court trong booking (`NOT_VENUE_OWNER`) trước khi duyệt/từ chối.

Chốt thêm ngày 2026-11-06: payment giữ snapshot tài khoản trả lúc hold; thay proof không đổi proof_uploaded_at hoặc deadline, chỉ đổi proof_updated_at/key. Proof trả200, chỉ khi còn held/pending trước expiresAt hoặc pending_payment/submitted trước review deadline. Clock lấy sau lock; đúng deadline là hết hạn. Nếu booking đã bắt đầu/kết thúc nhưng review chưa hết 2 giờ, vẫn cho approve theo contract; không tự rút ngắn deadline. Pending mutation quá review deadline trả409, cron huỷ riêng. Payment cash không nhận proof/approve/reject bank_transfer.

Đơn vị config giữ theo .env.example: HOLD_TTL_MINUTES=10, OWNER_REVIEW_TIMEOUT_HOURS=2, AUTOCOMPLETE_GRACE_MINUTES=30. OWNER_REVIEW_TIMEOUT/AUTOCOMPLETE_GRACE trong pseudocode là milliseconds sau chuyển đổi, không phải tên env mới hoặc giá trị giờ/phút đem trừ trực tiếp vào Date.now().

**Hạn chế đã chấp nhận (MVP):** không có đối soát tự động với ngân hàng; Owner chịu trách nhiệm kiểm tra ảnh chuyển khoản. Tích hợp webhook ngân hàng (SePay/Casso/PayOS) để dành cho giai đoạn sau, xem ADR-006.

## 4. Giữ chỗ (Hold) và Expire

### Tạo Hold
```typescript
// BookingService.hold() – trong một transaction
async hold(courtId: string, during: TsTzRange, customerId: string): Promise<Booking> {
  return this.db.transaction(async (tx) => {
    // 1. Expire các hold quá hạn của court này TRƯỚC (vì EXCLUDE áp dụng cho 'held')
    await tx.update(bookings)
      .set({ status: 'expired', expires_at: null, updated_at: new Date() })
      .where(and(
        eq(bookings.court_id, courtId),
        eq(bookings.status, 'held'),
        lte(bookings.expires_at, new Date())
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
  await this.db.transaction(async (tx) => {
    const expired = await tx.update(bookings)
      .set({ status: 'expired', expires_at: null, updated_at: new Date() })
      .where(and(
        eq(bookings.status, 'held'),
        lt(bookings.expires_at, new Date())
      ))
      .returning({ id: bookings.id, court_id: bookings.court_id, during: bookings.during });

    if (expired.length === 0) return;

    // BẮT BUỘC: cập nhật payments cùng lúc, nếu không hai bảng lệch trạng thái
    // (booking expired mà payment vẫn 'pending' → dashboard Owner hiện đơn ma).
    await tx.update(payments)
      .set({ status: 'expired', updated_at: new Date() })
      .where(inArray(payments.booking_id, expired.map((b) => b.id)));

    // Pseudocode: lưu sự kiện cùng transaction; worker gửi realtime SAU commit.
    for (const b of expired) {
      await this.outbox.enqueue(tx, 'hold_expired', b);
    }
  });
}
```

### Cron tự động hoàn tất booking (mỗi 5 phút)
```typescript
@Cron('*/5 * * * *')
async autoCompleteBookings() {
  // Điều kiện: booking đã confirmed và đã qua thời điểm kết thúc (during.upper)
  // cộng thêm khoảng đệm AUTOCOMPLETE_GRACE (mặc định 30 phút, cấu hình qua env)
  // để Owner còn kịp đánh dấu no_show trước khi booking chốt completed.
  const cutoff = new Date(Date.now() - AUTOCOMPLETE_GRACE);

  await this.db.update(bookings)
    .set({ status: 'completed', updated_at: new Date() })
    .where(and(
      eq(bookings.status, 'confirmed'),
      sql`upper(${bookings.during}) < ${cutoff}`
    ));
  // Không cần emit slot_updated: block đã ở quá khứ, lưới không còn hiển thị nó.
}
```

> **Vì sao cần cron này:** không có nó thì `completed` là trạng thái không thể đạt tới, khiến CUS-13 (đánh giá sân, chỉ cho booking `completed`) và OWN-09 (đánh dấu no-show) vĩnh viễn không dùng được.

### Cron nhắc lịch (mỗi 15 phút) – phục vụ CUS-14

BSC-045/BSC-078 triển khai ở `BookingRemindersRepository`, `SendRemindersSchedule` và `BusinessMailService`; giải thích code/test. Mỗi lượt tối đa100 booking confirmed có Customer, chưa nhắc, start trong `(now,now+24h]`. Cửa sổ bắt kịp giúp server dừng/trễ cron vẫn nhắc được trước giờ bắt đầu; không dùng duy nhất cửa sổ15 phút quanh mốc24h. Có thể nhắc trễ hơn24h nếu server ngừng hoặc booking mới xác nhận sát giờ.

Khoá Customer→Venue→Court→booking và kiểm tra lại điều kiện; tạo notification/outbox cùng transaction. Unique `booking:{id}:reminder` ngăn hai cron/khởi động lại enqueue trùng. Job failed/unknown không tự tạo intent mới; retry cùng key theo quy trình vận hành. `reminders_sent_at` chỉ đặt cùng ACK sau provider chấp nhận, không phải lúc enqueue. Worker gửi ngoài transaction, kiểm tra lại confirmed/chưa bắt đầu, retry bằng body/key đã đóng băng và dừng đối soát nếu quá cửa sổ provider. Không bảo đảm exactly-once ở dịch vụ ngoài. Manual guest không có Customer/email thì bỏ qua, không dựng địa chỉ email.

### Cron huỷ booking quá hạn duyệt (mỗi 5 phút)
```typescript
@Cron('*/5 * * * *')
async cancelStalePendingPayments() {
  const deadline = new Date(Date.now() - OWNER_REVIEW_TIMEOUT); // OWNER_REVIEW_TIMEOUT = 2h

  await this.db.transaction(async (tx) => {
    // Phải JOIN sang payments để lọc theo proof_uploaded_at — cột đó không nằm trên
    // bookings, nên KHÔNG thể đưa thẳng vào WHERE của một UPDATE bookings.
    const stale = await tx
      .select({
        id: bookings.id,
        customer_id: bookings.customer_id,
        court_id: bookings.court_id,
        during: bookings.during,
      })
      .from(bookings)
      .innerJoin(payments, eq(payments.booking_id, bookings.id))
      .where(and(
        eq(bookings.status, 'pending_payment'),
        eq(payments.status, 'submitted'),
        lte(payments.proof_uploaded_at, deadline)
      ));

    if (stale.length === 0) return;
    const ids = stale.map((b) => b.id);

    await tx.update(bookings)
      .set({
        status: 'cancelled',
        cancel_reason: 'Chủ sân không xử lý kịp thời',
        cancelled_at: new Date(),
        updated_at: new Date(),
      })
      .where(inArray(bookings.id, ids));

    // payments sang 'cancelled' (KHÔNG phải 'refunded'): tiền chưa được Owner xác nhận
    // nên hệ thống không ghi nhận đã thu, cũng không tạo yêu cầu hoàn tiền.
    await tx.update(payments)
      .set({ status: 'cancelled', updated_at: new Date() })
      .where(inArray(payments.booking_id, ids));

    // Pseudocode: worker dựng payload theo room/contract và gửi sau commit.
    for (const b of stale) await this.outbox.enqueue(tx, 'payment.review_expired', b);
  });
}
```

### Cron dọn dữ liệu hết hạn (hằng ngày 03:00)

Xoá theo lô các bản ghi không còn giá trị nghiệp vụ, tránh bảng phình vô hạn. Danh sách bảng và điều kiện xoá đầy đủ ở [04-database-schema.md](04-database-schema.md#job-dọn-dữ-liệu-hết-hạn).

```typescript
@Cron('0 3 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
async cleanupExpiredData() {
  // Mỗi bảng xoá theo lô 1000 dòng, lặp tới khi hết — tránh transaction giữ lock lâu.
  await this.cleanup.deleteInBatches(authTokens,   lt(authTokens.expires_at, daysAgo(7)));
  await this.cleanup.deleteInBatches(refreshTokens, or(eq(refreshTokens.revoked, true), lt(refreshTokens.expires_at, daysAgo(30))));
  await this.cleanup.deleteInBatches(notifications, and(isNotNull(notifications.read_at), lt(notifications.read_at, daysAgo(90))));
  await this.cleanup.deleteInBatches(auditLogs,    lt(auditLogs.created_at, monthsAgo(12)));
  // CHỈ xoá booking 'expired' (khách chưa từng chuyển tiền).
  // completed/cancelled/no_show là dữ liệu đối soát và báo cáo doanh thu — không xoá.
  await this.cleanup.deleteInBatches(bookings, and(eq(bookings.status, 'expired'), lt(bookings.updated_at, daysAgo(30))));
}
```

**Lưu ý:** EXCLUDE constraint dùng `=` cho court_id, không thể dùng `now()` như filter thông thường. Vì vậy cần expire trước trong cùng transaction.

## 5. Tính giá (Price Calculation)

```typescript
// Giá tính ở SERVER, KHÔNG ở client
async calculatePrice(courtId: string, during: TsTzRange, tx: Tx): Promise<number> {
  const rules = await tx.select().from(pricing_rules)
    .where(eq(pricing_rules.court_id, courtId));

  // Chia during thành các block 30 phút
  const blocks = splitIntoBlocks(during); // mỗi block là [start, end)

  return blocks.reduce((total, block) => {
    const rule = findMatchingRule(rules, block); // So khớp giờ, thứ, ngày lễ
    if (!rule) {
      // KHÔNG được trả 0: không khớp rule nghĩa là cấu hình giá thiếu, không phải "miễn phí".
      // Trả 0 sẽ cho phép đặt sân 0 đồng → phải chặn và báo lỗi cấu hình.
      throw new Error(
        `PRICING_RULE_NOT_FOUND: sân ${courtId} chưa có quy tắc giá cho khung ${block.start.toISOString()}`
      );
    }
    return total + rule.price_per_slot;
  }, 0);
}

/**
 * Chọn rule khớp cho 1 block. Thứ tự ưu tiên (mục "Quy tắc ưu tiên" bên dưới):
 *   1. date_override (ngày lễ cụ thể)      – loại cụ thể nhất
 *   2. day_of_week + start_time/end_time
 *   3. rule chung (không có day_of_week)
 * Trong cùng một loại, priority cao hơn thắng.
 * Sắp xếp theo (độ cụ thể DESC, priority DESC) rồi lấy rule khớp đầu tiên —
 * KHÔNG được chỉ sort theo priority, vì rule chung priority cao sẽ đè date_override.
 */
function findMatchingRule(rules: PricingRule[], block: Block): PricingRule | undefined {
  return rules
    .filter((r) => matchesBlock(r, block))
    .sort((a, b) => specificity(b) - specificity(a) || b.priority - a.priority)[0];
}

function specificity(rule: PricingRule): number {
  if (rule.date_override) return 3;
  if (rule.day_of_week !== null) return 2;
  return 1;
}
```

**Quy tắc ưu tiên pricing_rules** (so khớp theo thứ tự từ trên xuống, dừng ở rule đầu tiên khớp):
1. `date_override` cụ thể (ngày lễ) – ưu tiên cao nhất.
2. `day_of_week` cụ thể + `start_time/end_time`.
3. Rule chung (không có `day_of_week`).
4. Trong **cùng một mức** ở trên, `priority` số cao hơn = ưu tiên hơn.

> `priority` chỉ là tiêu chí phá vỡ thế cân bằng trong cùng một mức, **không** được vượt qua mức. Nếu chỉ sort theo `priority` thì một rule chung có `priority` cao sẽ đè `date_override`, trái với thứ tự trên.

**Không khớp rule ⇒ lỗi, không phải giá 0.** Mọi sân phải có ít nhất một rule chung phủ toàn bộ khung giờ hoạt động; `calculatePrice` ném `PRICING_RULE_NOT_FOUND` khi thiếu. Xem thêm ràng buộc dữ liệu ở [03-database-schema.md](03-database-schema.md).

## 6. Realtime (Socket.IO)

### Kênh (Channel/Room)

Có **3 loại room**, đặt tên theo quy ước dưới đây. Mọi sự kiện trong bảng ở [11-api-contract.md](11-api-contract.md#sự-kiện-websocket-socketio) đều phải gửi vào đúng một trong các room này — không có room nào khác.

| Room | Tên room | Cách tham gia | Sự kiện gửi vào |
|------|----------|---------------|-----------------|
| **Venue + ngày** | `venue:{venueId}:date:{yyyy-mm-dd}` | Client chủ động emit `join_venue` `{ venueId, date }` | `slot_updated` |
| **Cá nhân** | `user:{userId}` | **Tự động** khi socket xác thực thành công (không cần emit) | `booking_confirmed`, `booking_cancelled`, `payment_rejected`, `notification_created` |
| **Chủ sân** | `owner:{userId}` | **Tự động** khi socket xác thực thành công **và** `users.role = 'owner'` | `booking_created`, `payment_submitted` |

Ví dụ: `venue:uuid-abc:date:2026-10-15`, `user:uuid-cust-1`, `owner:uuid-own-1`

**Quy tắc:**
- `join_venue` **bắt buộc** kiểm tra `date` đúng định dạng `yyyy-mm-dd` và `venueId` tồn tại; sai thì trả lỗi `INVALID_ROOM` và không join.
- Client chỉ được join room venue của ngày mình đang xem; rời room cũ trước khi join room mới (`leave_venue`) để tránh rò rỉ dữ liệu giữa các ngày.
- `user:` và `owner:` do **server** gán từ `socket.data.user.id` sau khi xác thực JWT — client **không** được tự emit để join room của người khác. Đây là ràng buộc bảo mật, không phải tiện ích.
- Một tài khoản vừa là owner vừa đặt sân vẫn nhận đủ cả `user:` lẫn `owner:`.
- Khi emit cho nhiều room (ví dụ cron huỷ booking), emit riêng cho từng room; không gộp.

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
// Merge vào TanStack Query cache (v5)
// LƯU Ý cú pháp: setQueryData nhận queryKey TRỰC TIẾP (mảng), KHÔNG phải object.
// Chỉ các hàm nhận "filters" (invalidateQueries, refetchQueries, removeQueries…)
// mới dùng dạng object { queryKey: [...] }.
queryClient.setQueryData<SlotsData>(['slots', venueId, date], (old) => ({
  ...old,
  courts: old!.courts.map(court =>
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
  // Đồng bộ lại toàn bộ trạng thái (invalidateQueries nhận filters → dùng dạng object)
  queryClient.invalidateQueries({ queryKey: ['slots', venueId, date] });
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
- [ ] **BOOKING-TEST-04:** Cron expire chạy và expire đúng hold quá hạn; **đồng thời** `payments` tương ứng chuyển `expired` (hai bảng không lệch).
- [ ] **BOOKING-TEST-05:** **[QUAN TRỌNG]** N request đồng thời đặt cùng một block → chỉ 1 thành công (201), N-1 nhận 409.
- [ ] **BOOKING-TEST-06:** Giá tính đúng theo pricing_rules (khung giờ, thứ, ngày lễ); rule ngày lễ thắng rule chung dù rule chung có `priority` cao hơn.
- [ ] **BOOKING-TEST-07:** Thiếu rule giá phủ khung giờ → ném `PRICING_RULE_NOT_FOUND`, **không** trả giá 0.
- [ ] **BOOKING-TEST-08:** Chuyển trạng thái không hợp lệ → nhận lỗi `INVALID_STATUS_TRANSITION`; đặc biệt `completed → cancelled` bị từ chối.
- [ ] **BOOKING-TEST-09:** Blackout period chặn booking trong khoảng thời gian đó.
- [ ] **BOOKING-TEST-10:** WebSocket emit đúng payload sau khi tạo hold, và đúng room (`venue:{venueId}:date:{date}`).
- [ ] **BOOKING-TEST-11:** Người đặt gửi ảnh xác nhận chuyển khoản → booking sang `pending_payment`, `expires_at` bị xoá, cron expire không huỷ.
- [ ] **BOOKING-TEST-12:** Owner của venue khác duyệt/từ chối → 403 `NOT_VENUE_OWNER`.
- [ ] **BOOKING-TEST-13:** Quá `OWNER_REVIEW_TIMEOUT` chưa duyệt → cron chuyển `cancelled`, slot trả về available, và `payments` cũng chuyển `cancelled` (**không** phải `refunded`).
- [ ] **BOOKING-TEST-14:** `deposit_amount` tính đúng theo `deposit_percent`, bỏ qua giá từ client.
- [ ] **BOOKING-TEST-15:** Duyệt thanh toán idempotent (Owner approve 2 lần chỉ xử lý 1 lần, không lỗi) — lần 2 trả 200.
- [ ] **BOOKING-TEST-16:** Cùng một khách gửi lại hold cho cùng `courtId + during` → 200 kèm đúng hold cũ, **không** tạo hold mới; khác khách → 409.
- [ ] **BOOKING-TEST-17:** Cron `autoCompleteBookings` chuyển `confirmed → completed` sau khi qua `during.upper` cộng `AUTOCOMPLETE_GRACE`, và **không** đụng tới booking chưa tới giờ.
- [ ] **BOOKING-TEST-18:** Cron nhắc lịch gửi đúng một lần cho mỗi booking (chạy lại không gửi trùng nhờ `reminders_sent_at`).
- [ ] **BOOKING-TEST-19:** Vượt `HOLD_LIMIT` (3 hold đồng thời) → 422 `HOLD_LIMIT_EXCEEDED`.
- [ ] **BOOKING-TEST-20:** `completed` là terminal: mọi nỗ lực đổi trạng thái từ `completed` đều thất bại.
