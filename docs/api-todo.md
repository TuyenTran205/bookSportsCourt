# Danh mục API cần triển khai (API To-Do)

> **Phiên bản:** 1.2.0 | **Cập nhật lần cuối:** 2026-11-21 | **Đối chiếu nguồn:** `docs/11-api-contract.md` (v1.20.0), `docs/implemented-apis.md` (v1.17.0), `docs/05-booking-and-realtime.md`

Tài liệu này tổng hợp và theo dõi toàn bộ tiến độ triển khai API trong `apps/api` dựa trên đối chiếu nghiêm ngặt với **Hợp đồng API chuẩn** ([docs/11-api-contract.md](11-api-contract.md)), bảng tính năng hệ thống ([docs/02-features-by-role.md](02-features-by-role.md)), hiện trạng Backend ([docs/implemented-apis.md](implemented-apis.md)) và mã nguồn Frontend ([apps/web/lib/api/endpoints/](../apps/web/lib/api/endpoints/)).

---

## 1. Tổng quan hiện trạng và quy ước chung

- **Backend hiện đã triển khai (`apps/api`):** **125 route handlers** trải rộng trên đầy đủ các module (`auth`, `users`, `venues`, `courts`, `bookings`, `payments`, `owner`, `owner-applications`, `catalogs`, `favorites`, `notifications`, `reports`, `reviews`, `admin`, `audit`, `health`) cùng **Socket.IO `RealtimeGateway` (namespace `/ws`)** và **4 Cron schedules + Outbox/Cleanup workers**.
- **Backend còn thiếu cần triển khai:** Chỉ còn **2 endpoint thuộc hợp đồng** chưa có handler (`PATCH /owner/payments/:id/refund`, `POST /auth/resend-verification`), **1 endpoint bổ sung** ngoài hợp đồng (`GET /venues/:id/reviews/summary`) và **1 cron dọn dữ liệu** (`cleanup-expired-data.schedule.ts`).
- **Database Schema:** Toàn bộ các bảng nghiệp vụ và hạ tầng đã được khai báo hoàn chỉnh trong `apps/api/src/database/schema/schema.ts` qua migrations `0001`–`0016`. Tuyến phòng thủ cuối chống trùng lịch là PostgreSQL `EXCLUDE` constraint (`during WITH && WHERE status IN ('held', 'pending_payment', 'confirmed')`).
- **Quy ước Base URL & Path Parameters:**
  - Base URL: `/api/v1` (toàn bộ route khai báo dưới prefix này).
  - `:id` đại diện cho ID của tài nguyên được nêu tên ở segment ngay trước (ví dụ `/venues/:id/slots`, `/bookings/:id`, `/courts/:id/blackouts`).
  - `:venueId` đại diện cho ID cơ sở khi xuất hiện dưới segment khác tên `venues` (ví dụ `/favorites/:venueId`).
  - `:slug` dùng cho URL SEO công khai `GET /venues/:slug` (chấp nhận cả slug lẫn UUID).
- **Định dạng Response chuẩn (Envelope):**
  - Thành công có body: bọc `{ "data": ... }`. Nếu có phân trang, kèm thêm `meta: { page, limit, total, totalPages }`.
  - Thành công không body: HTTP `204` No Content (ví dụ logout, verify-email, resend-verification, delete).
  - Lỗi chuẩn: `{ "error": { "code": "...", "message": "...", "httpStatus": number, "details": {} } }`.
- **Bảng mã lỗi chuẩn áp dụng theo contract:**
  - `400`: `VALIDATION_ERROR`, `INVALID_TIME_RANGE`, `INVALID_STATUS_TRANSITION`, `UNSUPPORTED_FILE_TYPE`.
  - `401`: `UNAUTHORIZED`, `TOKEN_EXPIRED`, `INVALID_CREDENTIALS`, `INVALID_TOKEN`.
  - `403`: `FORBIDDEN`, `NOT_VENUE_OWNER`, `ACCOUNT_SUSPENDED`, `OWNER_NOT_APPROVED`.
  - `404`: `NOT_FOUND`.
  - `409`: `BOOKING_CONFLICT`, `SLOT_TAKEN` (dùng trong mục Idempotency của contract khi người dùng khác tranh block đã bị giữ), `EMAIL_ALREADY_EXISTS`, `CONFLICT_WITH_EXISTING_BOOKING`, `ALREADY_EXISTS`, `RESOURCE_IN_USE`, `PAYMENT_DATA_INCOMPLETE`, `PAYMENT_REVIEW_EXPIRED`, `PAYMENT_STATE_CONFLICT`, `RESOURCE_STATE_CONFLICT`.
  - `413`: `FILE_TOO_LARGE`.
  - `422`: `HOLD_LIMIT_EXCEEDED` (tối đa 3 hold đồng thời, hằng số `HOLD_LIMIT`), `CANCELLATION_NOT_ALLOWED`, `PAYMENT_ACCOUNT_MISSING`, `HOLD_EXPIRED`, `REVIEW_NOT_ALLOWED`.
  - `429`: `RATE_LIMIT_EXCEEDED`, `HOLD_RATE_LIMITED` (giữ rồi thả cùng court quá 5 lần/giờ, hằng số `HOLD_RATE_LIMIT_PER_HOUR`).
  - `500`: `INTERNAL_ERROR`.
  - `503`: `SERVICE_UNAVAILABLE` (provider/config chưa sẵn sàng, hết retry transaction, dữ liệu tổng hợp vượt miền integer an toàn).

---

## 2. Chi tiết 31 API cần triển khai theo nhóm nghiệp vụ

### 2.1. Nhóm Booking & Slots (P0 — Cốt lõi hệ thống — **ĐÃ TRIỂN KHAI ĐỢT 1**)

Phục vụ module `bookings` (`apps/api/src/modules/bookings/`). Bảng DB: `bookings`, `courts`, `venues`, `payments`, `cancellation_policies`, `pricing_rules`, `opening_hours`, `blackout_periods`.

| # | Method | Endpoint (`/api/v1`) | Quyền / Auth | Mã | Input chính | Output chính | Trạng thái & Ghi chú kỹ thuật |
|---|---|---|---|---|---|---|---|
| 1 | `POST` | `/bookings/hold` | Customer | CUS-08 | Hỗ trợ cả 3 định dạng: `{ courtId, start, end }`, `{ courtId, slots: [{ start, end }] }`, `{ courtId, startAt, blocks }` + `Idempotency-Key` | `201` `{ data: { booking, payment } }`: `booking.status = 'held'`, `expiresAt` (10 phút), `payment` gồm `amount`, `transferCode`, `bankAccount { bankBin, accountNo, accountName }` | **Đã triển khai.** Advisory lock theo `courtId` + GiST `EXCLUDE` constraint. Idempotent theo user (`200`), trùng lịch trả `409 BOOKING_CONFLICT` / `SLOT_TAKEN`. |
| 2 | `GET` | `/venues/:id/slots` | Public (Optional JWT) | CUS-07 | Param: `id` (venueId). Query: `date=YYYY-MM-DD`, `courtId?`, `tz?` | `200` `{ data: { date, courts: [{ courtId, slots: [{ start, end, status, price, mine?, holdExpiresAt?, bookingId? }] }] } }` | **Đã triển khai.** Chạy lazy-expire hold quá hạn trước khi dựng lưới. Header `Cache-Control: no-store` & `X-Grid-Version`. Không lộ danh tính người đặt khác. |
| 3 | `GET` | `/bookings` | Customer | CUS-10 | Query: `status?`, `from?`, `to?`, `page`, `limit`/`pageSize`, `sort?` | `200` `{ data: BookingDetail[], meta }` | **Đã triển khai.** Danh sách lịch sử đặt sân của chính user đang đăng nhập. |
| 4 | `GET` | `/bookings/:id` | Customer / Owner / Admin | CUS-10 | Param: `id` (bookingId) | `200` `{ data: BookingDetail }` | **Đã triển khai.** Chống dò ID: trả `404 NOT_FOUND` nếu booking không thuộc Customer hiện tại. |
| 5 | `PATCH` / `POST` | `/bookings/:id/cancel` | Customer / Owner / Admin | CUS-11 | Param: `id`, Body: `{ reason? }` | `200` `{ data: BookingDetail }` | **Đã triển khai.** Áp dụng chính sách huỷ 24h (`cancellation_policies`). Trả `422 CANCELLATION_NOT_ALLOWED` nếu quá hạn huỷ của khách. |
| 6 | `GET` | `/bookings/:id/cancellation-preview` | Customer / Owner / Admin | CUS-11 | Param: `id` | `200` `{ data: { canCancel, refundPercent, refundAmount, cancelBeforeHours, deadline } }` | **Đã triển khai.** Tính toán số tiền hoàn dựa trên `deposit_amount`, thời gian bắt đầu đơn đặt và `cancellation_policies`. |
| 7 | `PATCH` | `/bookings/:id/no-show` | Owner / Admin | OWN-09 | Param: `id` | `200` `{ data: BookingDetail }` | **Đã triển khai.** Áp dụng khi booking `confirmed` và giờ bắt đầu đã qua. |
| 7a | `DELETE` | `/bookings/holds/:holdId` (và `/bookings/hold/:id`) | Customer | CUS-08 | Param: `holdId` | `204` No Content | **Đã triển khai.** Chủ hold chủ động nhả giữ chỗ ngay lập tức trong transaction. |
| 7b | `POST` | `/bookings/:id/confirm` | Customer | CUS-08 | Param: `id` + `Idempotency-Key` | `200` `{ data: BookingDetail }` | **Đã triển khai.** Xác nhận trực tiếp từ `held` -> `confirmed`, xóa `expires_at = NULL`, hoặc trả `410 HOLD_EXPIRED` nếu đã hết hạn. |
| 7c | `POST` | `/bookings/quote` | Public | CUS-08 | Body: tương tự `/bookings/hold` | `200` `{ data: { total, deposit, depositPercent, ranges, unavailable } }` | **Đã triển khai.** Xem trước báo giá và tiền cọc tính từ server. |

---

### 2.2. Nhóm Vận hành lịch & Khoá sân Owner (P0 — **ĐÃ TRIỂN KHAI 100%**)

Phục vụ màn hình Timeline, đặt sân vãng lai tại quầy và quản lý bảo trì sân (`BookingsModule` & `OwnerModule`). Bảng DB: `blackout_periods`, `bookings`, `courts`, `venues`.

| # | Method | Endpoint (`/api/v1`) | Quyền / Auth | Mã | Input chính | Output chính | Trạng thái & Ghi chú kỹ thuật |
|---|---|---|---|---|---|---|---|
| 8 | `GET` | `/owner/timeline` | Owner / Admin | OWN-06 | Query: `venueId`, `date=YYYY-MM-DD` | `200` `{ data: OwnerTimelineDay }` | **Đã triển khai.** Trả toàn bộ court của venue kèm block đã đặt, hold, blackout và opening hours trong ngày cụ thể. Realtime dùng room `venue:{venueId}:date:{yyyy-mm-dd}`. |
| 9 | `POST` | `/owner/bookings/manual` | Owner / Admin | OWN-07 | Body: `{ courtId, start, end, guestName?, guestPhone?, customerId?, note?, totalPrice? }` | `201` `{ data: BookingDetail }` | **Đã triển khai.** Tạo booking thủ công cho khách vãng lai tại quầy: tạo thẳng `confirmed`, `source = 'manual'`, payment `cash` (`completed`). |
| 10 | `GET` | `/owner/bookings` | Owner / Admin | OWN-06 | Query: `venueId?`, `courtId?`, `status?`, `from?`, `to?`, `q?`, `page`, `limit` | `200` `{ data: OwnerBookingItem[], meta }` | **Đã triển khai.** Lọc trước phân trang theo ngày VN và từ khoá `q`. |
| 11 | `GET` | `/courts/:id/blackouts` | Owner (chủ sân) | OWN-08 | Param: `id` (courtId), Query: `from?`, `to?` | `200` `{ data: BlackoutPeriod[] }` | **Đã triển khai** (`CourtsController` & `BlackoutsController`). |
| 12 | `POST` | `/courts/:id/blackouts` | Owner (chủ sân) | OWN-08 | Param: `id` (courtId), Body: `{ start, end, reason? }` | `201` `{ data: BlackoutPeriod }` | **Đã triển khai.** Kiểm tra bội số 30 phút, chặn trùng booking hoạt động (`409`), phát Socket.IO `slot_updated`. |
| 13 | `DELETE` | `/courts/:id/blackouts/:blackoutId` | Owner (chủ sân) | OWN-08 | Param: `id` (courtId), `blackoutId` | `204` No Content | **Đã triển khai.** Xoá blackout và phát Socket.IO `slot_updated`. |

---

### 2.3. Nhóm Đơn vị hành chính 2 cấp (P0/P1 — **ĐÃ TRIỂN KHAI 100%** — ADR-022, ADR-023)

Hệ thống quản lý địa giới hành chính theo mô hình 34 Tỉnh/Thành phố trực thuộc TW và 3.321 Xã/Phường/Đặc khu (mốc 03/11/2026) trong `CatalogsController` & `LocationsController`. Bảng DB: `areas`.

| # | Method | Endpoint (`/api/v1`) | Quyền / Auth | Mã | Input chính | Output chính | Trạng thái & Ghi chú kỹ thuật |
|---|---|---|---|---|---|---|---|
| 14 | `GET` | `/provinces` | Public | CUS-04 | Không | `200` `{ data: Province[] }` | **Đã triển khai** (`LocationsController`). Danh sách 34 Tỉnh/TP TW. |
| 15 | `GET` | `/provinces/:code/wards` | Public | CUS-04 | Param: `code` (mã hoặc UUID tỉnh), Query: `q?`, `limit?` | `200` `{ data: Ward[] }` | **Đã triển khai.** Danh sách Xã/Phường thuộc một tỉnh/thành. |
| 16 | `GET` | `/wards/search` | Public | CUS-04 | Query: `q`, `provinceCode?`, `limit?` | `200` `{ data: Ward[] }` | **Đã triển khai.** Autocomplete xã/phường không dấu, tối đa 50 kết quả. |
| 17 | `GET` | `/provinces/:id/districts` | Public | Legacy | Param: `id` (provinceId) | `200` `{ data: District[] }` | **Đã triển khai.** Tương thích ngược dữ liệu legacy (trả `[]` cho 2 cấp). |

---

### 2.4. Nhóm Thông báo in-app (P1 — **ĐÃ TRIỂN KHAI 100%**)

Bảng DB: `notifications`. Triển khai tại `NotificationsModule` (`NotificationsController`).

| # | Method | Endpoint (`/api/v1`) | Quyền / Auth | Mã | Input chính | Output chính | Trạng thái & Ghi chú kỹ thuật |
|---|---|---|---|---|---|---|---|
| 18 | `GET` | `/notifications` | Authenticated | CUS-14 | Query: `unreadOnly?`, `type?`, `page`, `limit` | `200` `{ data: Notification[], meta }` | **Đã triển khai.** Hỗ trợ lọc `unreadOnly` và `type`. |
| 19 | `GET` | `/notifications/unread-count` | Authenticated | CUS-14 | Không | `200` `{ data: { count: number } }` | **Đã triển khai.** Đếm thông báo chưa đọc cho badge header. |
| 20 | `PATCH` | `/notifications/:id/read` | Authenticated | CUS-14 | Param: `id` (notificationId) | `200` `{ data: Notification }` | **Đã triển khai.** Đánh dấu đã đọc theo chủ sở hữu. |
| 21 | `POST` | `/notifications/read-all` | Authenticated | CUS-14 | Không | `200` `{ data: { updated: number } }` | **Đã triển khai.** Đánh dấu tất cả đã đọc. |

---

### 2.5. Nhóm Sân yêu thích (P1 — **ĐÃ TRIỂN KHAI 100%**)

Bảng DB: `favorites`, `venues`. Triển khai tại `FavoritesModule` (`FavoritesController`).

| # | Method | Endpoint (`/api/v1`) | Quyền / Auth | Mã | Input chính | Output chính | Trạng thái & Ghi chú kỹ thuật |
|---|---|---|---|---|---|---|---|
| 22 | `GET` | `/favorites` | Authenticated (`JwtAuthGuard`) | CUS-12 | Không | `200` `{ data: VenueListItem[] }` | **Đã triển khai.** Chỉ trả các venue approved và chưa xoá. |
| 23 | `PUT` | `/favorites/:venueId` | Authenticated (`JwtAuthGuard`) | CUS-12 | Param: `venueId` | `200` `{ data: { favorited: true } }` | **Đã triển khai.** Idempotent theo `(user_id, venue_id)`. |
| 24 | `DELETE` | `/favorites/:venueId` | Authenticated (`JwtAuthGuard`) | CUS-12 | Param: `venueId` | `200` `{ data: { favorited: false } }` | **Đã triển khai.** Idempotent. |

---

### 2.6. Nhóm Báo cáo, Đánh giá Owner & Kiểm duyệt báo cáo (P1)

Bảng DB: `bookings`, `payments`, `reviews`, `courts`, `venues`. Ngoài các mục bên dưới, đã triển khai thêm **2 endpoint báo cáo vi phạm đánh giá** (`POST /owner/reviews/:id/report` và `PATCH /admin/reviews/:id/report`).

| # | Method | Endpoint (`/api/v1`) | Quyền / Auth | Mã | Input chính | Output chính | Trạng thái & Ghi chú kỹ thuật |
|---|---|---|---|---|---|---|---|
| 25 | `GET` | `/owner/reports/revenue` | Owner / Admin | OWN-11 | Query: `from`, `to`, `groupBy=day/week/month`, `venueId?`, `courtId?` | `200` `{ data: RevenueReport }` | **Đã triển khai** (`OwnerReportsController` & `ReportsController`). |
| 26 | `GET` | `/owner/reports/occupancy` | Owner / Admin | OWN-12 | Query: `from`, `to`, `venueId?`, `courtId?`, `compareWith?` | `200` `{ data: OccupancyReport }` | **Đã triển khai.** Tỷ lệ lấp đầy block 30 phút & giờ cao điểm. |
| 27 | `GET` | `/owner/reviews` | Owner / Admin | OWN-13 | Query: `venueId?`, `replied?`, `page`, `limit` | `200` `{ data: OwnerReview[], meta }` | **Đã triển khai** (`ReviewsController`). Kèm `reportStatus`, `reportReason`, `reportImageUrl`. |
| 28 | `PATCH` | `/owner/reviews/:id/reply` | Owner / Admin | OWN-13 | Param: `id` (reviewId), Body: `{ ownerReply: string }` | `200` `{ data: Review }` | **Đã triển khai** (`ReviewsController`). |
| 28a | `POST` | `/owner/reviews/:id/report` | Owner / Admin | OWN-13 | Param: `id`, Body/Multipart: `reason` + `file?`/`imageUrl?` | `200/201` `{ data: ReviewAdmin }` | **Đã triển khai** (`ReviewsController` + migration `0016`). |
| 28b | `PATCH` | `/admin/reviews/:id/report` | Admin | ADM-10 | Param: `id`, Body: `{ action: 'approve' \| 'reject' }` | `200` `{ data: ReviewAdmin }` | **Đã triển khai** (`ReviewsController`). Duyệt ẩn hoặc từ chối báo cáo. |
| 29 | `PATCH` | `/owner/payments/:id/refund` | Owner | OWN-09 | Param: `id` (paymentId), Body: `{ note? }` | `200` `{ data: Payment }` | **Chưa triển khai ở BE.** MVP không có hoàn tiền tự động; đánh dấu hoàn tiền thủ công ngoài hệ thống hiện mới nằm ở contract thiết kế. |

---

### 2.7. Nhóm Auth, Uploads & Tiện ích bổ sung (P1)

Bảng DB: `users`, `auth_tokens`, `reviews`.

| # | Method | Endpoint (`/api/v1`) | Quyền / Auth | Mã | Input chính | Output chính | Trạng thái & Ghi chú kỹ thuật |
|---|---|---|---|---|---|---|---|
| 30 | `POST` | `/auth/resend-verification` | Public | CUS-01 | Body: `{ email }` | `204` No Content | **Chưa triển khai ở BE.** Dùng cho gửi lại email xác thực tài khoản. |
| 31 | `POST` | `/users/me/avatar` | Authenticated | CUS-15 | `multipart/form-data`, field: `file` | `200` `{ data: User }` | **Đã triển khai** (`CurrentUserController` trong `auth.controller.ts` + `avatar-image.ts` + `PublicStorage`). |
| 31a | `POST` | `/auth/ws-token` | Cookie `access_token` | Realtime | Không | `200` `{ data: { token, ... } }` | **Đã triển khai** (`AuthController`). Cấp token WS ngắn hạn cho Socket.IO. |
| 31b | `GET` | `/health/ping` | Public | Infra | Không | `200` `{ status, timestamp }` | **Đã triển khai** (`HealthController`). Liveness không chạm DB. |
| * | `GET` | `/venues/:id/reviews/summary` | Public | CUS-06 | Param: `id` (venueId/slug) | `200` `{ data: ReviewSummary }` | **Chưa triển khai ở BE** (endpoint bổ sung ngoài hợp đồng cho biểu đồ tóm tắt sao). |

---

## 3. Realtime WebSocket Gateway (Socket.IO – namespace `/ws` — **ĐÃ TRIỂN KHAI**)

Đã triển khai `RealtimeGateway` (`apps/api/src/modules/realtime/realtime.gateway.ts`, namespace `/ws`) kết hợp chặt chẽ với `RealtimeSessionsService` (`apps/api/src/modules/auth/realtime-sessions.service.ts`) và `RealtimeOutboxService` (`@Interval(5000)` khi `REALTIME_OUTBOX_ENABLED=true`).

### 3.1. Các Room đã triển khai

| Tên Room | Loại | Cơ chế tham gia | Mục đích |
|---|---|---|---|
| `venue:{venueId}:date:{yyyy-mm-dd}` | Công khai | Client emit `join_venue` kèm `{ venueId, date }` (hỗ trợ cả `{ guest: true }` lẫn user đăng nhập) | Lắng nghe cập nhật slot theo ngày khi đang xem lịch sân hoặc timeline |
| `user:{userId}` | Cá nhân | Server **tự động gán** sau khi xác thực token (`ws-token` / `access_token`) thành công | Nhận sự kiện booking, huỷ đơn, trạng thái thanh toán, thông báo cá nhân |
| `owner:{userId}` | Chủ sân | Server **tự động gán** nếu user có role `owner` | Nhận đơn giữ chỗ mới, thông báo khách đã gửi uỷ nhiệm chi |

### 3.2. 10 Sự kiện Realtime theo Hợp đồng

| Tên sự kiện | Hướng | Room nhận | Payload | Khi nào kích hoạt |
|---|---|---|---|---|
| `join_venue` | Client → Server | — | `{ venueId, date }` | Khách mở trang chi tiết sân, chọn ngày xem lịch hoặc Owner mở Timeline |
| `leave_venue` | Client → Server | — | `{ venueId, date }` | Khách rời trang hoặc chuyển sang ngày khác |
| `slot_updated` | Server → Client | `venue:{venueId}:date:{date}` | `{ courtId, start, end, status: 'available' / 'held' / 'booked' / 'blocked' }` | Khi có hold mới, huỷ đơn, duyệt thanh toán xong, hoặc tạo/xoá blackout |
| `hold_expired` | Server → Client | `user:{userId}` | `{ courtId, bookingId }` | Hết 10 phút giữ chỗ mà khách chưa tải uỷ nhiệm chi |
| `booking_confirmed` | Server → Client | `user:{userId}` | `{ bookingId }` | Chủ sân duyệt thanh toán thành công |
| `booking_cancelled` | Server → Client | `user:{userId}` | `{ bookingId, reason }` | Đơn bị huỷ (bởi khách, bởi chủ sân, hoặc do cron quá hạn đối soát) |
| `booking_created` | Server → Client | `owner:{userId}` | `{ bookingId, venueId, courtId }` | Có lượt giữ chỗ mới tại cơ sở thuộc quyền sở hữu của chủ sân |
| `payment_submitted` | Server → Client | `owner:{userId}` | `{ paymentId, bookingId, venueId }` | Khách hàng đã gửi ảnh xác nhận chuyển khoản, chờ chủ sân đối soát duyệt |
| `payment_rejected` | Server → Client | `user:{userId}` | `{ bookingId, reason }` | Chủ sân từ chối biên lai thanh toán (kèm lý do) |
| `notification_created` | Server → Client | `user:{userId}` | `{ id, type, title }` | Bắn thông báo in-app mới vào chuông thông báo header |

---

## 4. Kế hoạch phân đợt triển khai (Implementation Batches)

```
┌────────────────────────────────────────────────────────┐
│ Đợt 1: Cốt lõi Đặt sân & Lưới giờ (Core Booking)       │
│ [HOÀN THÀNH 100%]                                      │
│ - Module: apps/api/src/modules/bookings/               │
│ - REST APIs (hold, slots, cancel, confirm, list,       │
│   detail, no-show, quote...)                           │
│ - Advisory Lock theo courtId + PostgreSQL GiST EXCLUDE │
│ - Unit test (booking-rules) & Concurrency 20-way test  │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ Đợt 2: Realtime Socket.IO & Vận hành Owner             │
│ [HOÀN THÀNH 100%]                                      │
│ - Socket.IO RealtimeGateway (/ws, 3 rooms, 10 events)  │
│ - Module: owner timeline, blackouts, manual booking    │
│ - Cron huỷ hold / hoàn tất / quá hạn thanh toán        │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ Đợt 3: Đơn vị hành chính, Tương tác & Báo cáo          │
│ [HOÀN THÀNH GẦN ĐỦ — còn 2 route thiết kế + 1 bổ sung] │
│ - Module: provinces/wards (ADR-022 ĐVHC 2 cấp)         │
│ - Module: notifications, favorites, reports, reviews   │
│ - Upload avatar, báo cáo review xấu, admin analytics   │
└────────────────────────────────────────────────────────┘
```

---

## 5. Bảng chuẩn hoá & Đồng bộ giữa Frontend, Backend và Hợp đồng API

### 5.1. Các đường dẫn đã chuẩn hoá xong

Đối chiếu giữa `apps/web/lib/api/endpoints/` và `docs/11-api-contract.md` cho thấy một số hàm Frontend trước đây gọi đường dẫn hoặc phương thức chưa khớp với REST contract chuẩn của Backend. Dưới đây là các mục đã hoàn tất chuẩn hóa:

| Hàm ở Frontend (`apps/web`) | Đường dẫn FE cũ | Đường dẫn chuẩn theo Backend Contract | Tình trạng chuẩn hoá |
|---|---|---|---|
| `reviewVenue` | `PATCH /admin/venues/:id` | `PATCH /venues/:id/status` | **Đã chuẩn hoá** trong `admin.ts`: gọi `PATCH /venues/:id/status` với body `{ status, reason }`. |
| `setUserStatus` | `PATCH /admin/users/:id/status` | `PATCH /users/:id/status` | **Đã chuẩn hoá** trong `admin.ts`: gọi `PATCH /users/:id/status`. |
| `setReviewVisibility` | `PATCH /admin/reviews/:id/visibility` | `PATCH /reviews/:id/visibility` | **Đã chuẩn hoá** trong `admin.ts`: gọi `PATCH /reviews/:id/visibility`. |
| `createSport` | `POST /admin/sports` | `POST /sports` | **Đã chuẩn hoá** trong `admin.ts`: gọi `POST /sports`. |
| `deleteSport` | `DELETE /admin/sports/:id` | `DELETE /sports/:id` | **Đã chuẩn hoá** trong `admin.ts`: gọi `DELETE /sports/:id`. |
| `createArea` | `POST /admin/areas` | `POST /areas` | **Đã chuẩn hoá** trong `admin.ts`: gọi `POST /areas`. |
| `cancelBooking` | `POST /bookings/:id/cancel` | `PATCH /bookings/:id/cancel` | **Đã chuẩn hoá** trong `bookings.ts` (BE hỗ trợ cả `PATCH` và `POST`). |
| `forceCancelBooking` | `PATCH /admin/bookings/:id/cancel` | `PATCH /bookings/:id/cancel` | **Đã chuẩn hoá** trong `admin.ts`: chuyển sang dùng chung `PATCH /bookings/:id/cancel`. |
| `createReview` | `POST /bookings/:bookingId/review` | `POST /reviews` | **Đã chuẩn hoá** trong `bookings.ts`: gọi `POST /reviews` với body `{ bookingId, rating, comment? }`. |
| `addFavorite` | `POST /favorites/:venueId` | `PUT /favorites/:venueId` | **Đã chuẩn hoá** trong `venues.ts`: chuyển method thành `PUT` (idempotent). |
| `markBookingNoShow` | `POST /owner/bookings/:bookingId/no-show` | `PATCH /bookings/:id/no-show` | **Đã chuẩn hoá** trong `owner.ts`: chuyển method thành `PATCH` và path `/bookings/:id/no-show`. |
| `getBankAccount` | `GET /owner/venues/:venueId/payment-account` | `GET /owner/venues/:id/payment-account` | **Đã khớp**: segment `:id` đại diện venueId. |
| `getCancellationPolicy` | `GET /owner/venues/:venueId/cancellation-policy` | `GET /owner/venues/:id/cancellation-policy` | **Đã khớp**: segment `:id` đại diện venueId. |
| `quoteBooking` | `POST /bookings/quote` | `POST /bookings/quote` | **Đã triển khai** ở Backend tại Đợt 1 để FE tính trước tổng tiền/tiền cọc mà không tin cậy client. |
| `getHold` | `GET /bookings/hold/:id` | `GET /bookings/:id` | **Đã hỗ trợ cả hai:** route chuẩn `GET /bookings/:id` và alias `GET /bookings/hold/:id` trả kèm trường `remainingMs`. |

### 5.2. Danh sách các điểm lệch giữa FE, BE và Hợp đồng API đã đồng bộ xong

| # | Hạng mục | Hợp đồng API (`11-api-contract.md`) | Hiện trạng Backend (`apps/api`) | Hiện trạng Frontend (`apps/web`) | Trạng thái đồng bộ |
|---|---|---|---|---|---|
| 1 | **Header bảo mật `X-Request-Origin`** | Bắt buộc trên các thao tác thanh toán nhạy cảm | `RequestOriginGuard` bắt buộc header `X-Request-Origin` khớp `ALLOWED_ORIGINS` trên: `POST /bookings/:id/payment/proof`, `PATCH /owner/payments/:id/approve`, `PATCH /owner/payments/:id/reject`, `PUT /owner/venues/:id/payment-account`. | `apiFetchWithMeta` trong `apps/web/lib/api/client.ts` tự động đính kèm `'X-Request-Origin': window.location.origin` khi chạy trên trình duyệt. | **Đã hoàn thành** trong `apps/web/lib/api/client.ts`. |
| 2 | **Giờ mở cửa (`Opening Hours`)** | Theo từng sân con (`Court`): `GET /courts/:id/opening-hours`, `PUT /courts/:id/opening-hours` | `CourtsController` hỗ trợ đầy đủ cả `/courts/:id/opening-hours` và alias cấp Venue `/owner/venues/:id/opening-hours`, chuẩn hoá cấu trúc 7 ngày trong tuần. | `owner.ts` cung cấp cả `getCourtOpeningHours` / `replaceCourtOpeningHours` (`/courts/:id/opening-hours`) và `getOpeningHours` / `replaceOpeningHours` (`/owner/venues/:id/opening-hours`). | **Đã hoàn thành** ở cả FE (`owner.ts`, `mocks/handlers/owner.ts`) và BE (`courts.controller.ts`, `courts.service.ts`, `courts.repository.ts`). |
| 3 | **Bảng giá (`Pricing Rules`)** | Theo từng sân con (`Court`): `GET /courts/:id/pricing-rules`, `POST /courts/:id/pricing-rules`, `PATCH /courts/:id/pricing-rules/:ruleId`, `DELETE /courts/:id/pricing-rules/:ruleId` | `CourtsController` hỗ trợ đầy đủ cả `/courts/:id/pricing-rules...` và alias cấp Venue `/owner/venues/:id/pricing-rules`, `DELETE /owner/pricing-rules/:ruleId`, đồng thời ánh xạ `label`/`weekdays`. | `owner.ts` cung cấp cả hàm theo Court và theo Venue; `deletePricingRule(ruleId, courtId)` tự động gọi `/courts/:courtId/pricing-rules/:ruleId` khi có `courtId`. | **Đã hoàn thành** ở cả FE (`owner.ts`, `OwnerPricingScreen.tsx`, `mocks/handlers/owner.ts`) và BE (`courts.controller.ts`, `courts.service.ts`, `courts.repository.ts`). |
| 4 | **Upload ảnh cơ sở (`POST /venues/:id/images`)** | `multipart/form-data` (field `file`, tối đa 10 ảnh/venue, <= 5 MB) | `VenueExtensionsController` sử dụng `FileInterceptor('file')` hỗ trợ cả `multipart/form-data` (field `file`) lẫn JSON `{ url, sortOrder }`, kiểm tra giới hạn tối đa 10 ảnh/cơ sở. | `uploadVenueImage` trong `owner.ts` gửi `FormData` với `formData.append('file', optimizedImage)`. | **Đã hoàn thành** trong `venues-extensions.controller.ts` và `venues.service.ts`. |
| 5 | **Upload Avatar (`POST /users/me/avatar`)** | `multipart/form-data` với field `file` | `CurrentUserController` (`auth.controller.ts`) nhận `FileInterceptor('file')`, kiểm tra/chuẩn hoá ảnh (`avatar-image.ts`) và lưu qua `PublicStorage`. | `uploadAvatar` trong `auth.ts` gửi `form.append('file', file)`; MSW mock chấp nhận cả `file` lẫn `avatar`. | **Đã hoàn thành** ở cả BE và FE. |
| 6 | **Google OAuth (`GET /auth/google`)** | Trả `302 Redirect` sang Google kèm cookie `google_oauth_binding` | `GoogleOAuthController` thực hiện `res.redirect(302, url)`. | `googleAuthUrl()` trong `auth.ts` trả URL điều hướng trực tiếp `${API_BASE_URL}${API_PREFIX}/auth/google`, dùng trong `LoginForm.tsx` và `RegisterForm.tsx`. | **Đã hoàn thành** trong `auth.ts`, `LoginForm.tsx`, `RegisterForm.tsx`. |
| 7 | **Query params của Admin Bookings & Reviews** | `GET /admin/bookings`: `status, venueId, customerId, from, to, q, page, limit`<br>`GET /admin/reviews`: `venueId, isVisible, reportStatus, rating, q, page, limit` | `adminBookingQuerySchema` và `adminReviewQuerySchema` nhận `q`, `rating`, `reportStatus`, đồng thời `AdminReportingRepository` và `ReviewsRepository` thực thi lọc tương ứng. | `admin.ts` truyền `q`, `rating`, `reportStatus` đồng bộ với schema Backend. | **Đã hoàn thành** trong `phase4-schemas.ts`, `admin-reporting.repository.ts`, `reviews.repository.ts`. |
| 8 | **Cấu trúc trả về `GET /admin/stats` & `GET /admin/analytics`** | Trả về `AdminStats` (`{ summary, population, series, dataQuality }`) và `AdminAnalytics` (`{ byStatus: [{ status, count }], bySport: [{ sport, bookings }], byVenue: [{ venueId, name, bookings, revenue }] }`, không nhận query params) | `AdminReportingController` trả `AdminStats` và triển khai `GET /admin/analytics` tổng hợp từ DB theo trạng thái, môn thể thao và cơ sở. | `getAdminStats` trong `admin.ts` chuẩn hoá dữ liệu KPI; `getAdminAnalytics` gọi trực tiếp `GET /admin/analytics` từ Backend thật kèm cơ chế fallback tự tổng hợp từ bookings/venues. | **Đã hoàn thành** ở cả BE (`admin-reporting.controller.ts`, `admin-reporting.service.ts`, `admin-reporting.repository.ts`) và FE (`apps/web/lib/api/endpoints/admin.ts`). |
| 9 | **Payload tạo booking thủ công (`POST /owner/bookings/manual`)** | Body: `{ courtId, start, end, guestName?, guestPhone?, customerId?, note?, totalPrice? }` | `OwnerBookingsController` (`owner-bookings.controller.ts`) và `BookingsService`/`OwnerReportingService` hỗ trợ `{ courtId, start, end, guestName?, guestPhone?, customerId?, note?, totalPrice? }`. | `createManualBooking` trong `owner.ts` tương thích payload hợp đồng BE. | **Đã hoàn thành** ở cả BE và FE. |
| 10 | **Query lọc loại thông báo (`GET /notifications`)** | Query: `unreadOnly?`, `type?`, `page`, `limit` | `NotificationsController` (`notifications.controller.ts`) đã hỗ trợ query param `type?: string`. | `listNotifications` trong `notifications.ts` truyền thêm `type?: string`. | **Đã hoàn thành** ở cả BE (`notifications.controller.ts`) và FE (`notifications.ts`). |

### 5.3. Các hàm chỉ dùng riêng cho chế độ Mock ở Frontend (Không nằm trong Hợp đồng API)

- `setUserRole` (`PATCH /admin/users/:id/role` trong `admin.ts`): Hợp đồng quy định nâng quyền Owner thông qua luồng duyệt hồ sơ `PATCH /admin/owner-applications/:id`.
- `resetMockData` (`POST /admin/reset-mock` trong `admin.ts`): Nút reset dữ liệu MSW mock trên trình duyệt.
- *(Lưu ý: `getAdminAnalytics` trước đây chỉ dùng cho mock, nay đã được chuẩn hoá thành API chính thức `GET /api/v1/admin/analytics` ở Backend NestJS).*

---

## 6. Tiêu chí nghiệm thu hoàn thành (Definition of Done)

1. Mọi API mới phải có **Unit test** và **E2E/Integration test** chạy trên PostgreSQL test container.
2. Không nhận giá hoặc tính toán cọc từ Client — mọi số tiền bắt buộc tính từ `pricing_rules` và `cancellation_policies` tại Backend.
3. Tuyệt đối tuân thủ `EXCLUDE` constraint chống trùng lịch của bảng `bookings` tại database.
4. Mọi response trả về tuân thủ envelope `{ "data": ... }` hoặc HTTP `204` No Content theo quy ước dự án.
5. Swagger `/api/docs` tự động cập nhật schema và DTO đầy đủ cho các endpoint mới.
