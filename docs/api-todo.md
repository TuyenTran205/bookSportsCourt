# Danh mục API cần triển khai (API To-Do)

> **Phiên bản:** 1.1.0 | **Cập nhật lần cuối:** 2026-11-09 | **Đối chiếu nguồn:** `docs/11-api-contract.md` (v1.19.1), `docs/implemented-apis.md` (v1.15.1), `docs/05-booking-and-realtime.md`

Tài liệu này tổng hợp và chuẩn hóa toàn bộ các API backend còn thiếu cần triển khai trong `apps/api` dựa trên đối chiếu nghiêm ngặt với **Hợp đồng API chuẩn** ([docs/11-api-contract.md](11-api-contract.md)), bảng tính năng hệ thống ([docs/02-features-by-role.md](02-features-by-role.md)), hiện trạng Backend ([docs/implemented-apis.md](implemented-apis.md)) và mã nguồn Frontend ([apps/web/lib/api/endpoints/](../apps/web/lib/api/endpoints/)).

---

## 1. Tổng quan hiện trạng và quy ước chung

- **Tổng endpoint REST theo Hợp đồng API:** **101 endpoints** + **1 WebSocket Gateway** (10 sự kiện realtime).
- **Backend hiện đã triển khai (`apps/api`):** **77 endpoints** (bao gồm Auth, Users, Catalogs cơ bản, Venues CRUD, Courts CRUD, Reviews cơ bản, Owner Applications, Payments review, Admin reporting & stats, Audit logs, và **toàn bộ Nhóm 2.1 Core Booking & Slots** vừa hoàn thành ở Đợt 1).
- **Backend còn thiếu cần triển khai:** **24 endpoint** thuộc 101 endpoint hợp đồng + **1 endpoint bổ sung** ngoài hợp đồng (`GET /venues/:id/reviews/summary`, phục vụ component rating trang chi tiết sân) + **1 WebSocket Gateway** (3 room, 10 sự kiện realtime) + **5 module còn lại** (`favorites`, `notifications`, `pricing`, `realtime`, `reports`). Module `bookings` đã triển khai hoàn tất 100%.
- **Database Schema:** Toàn bộ 24 bảng phục vụ các API này đã được khai báo hoàn chỉnh trong `apps/api/src/database/schema/schema.ts` qua migrations `0001`–`0010`. Tuyến phòng thủ cuối chống trùng lịch là PostgreSQL `EXCLUDE` constraint (`during WITH && WHERE status IN ('held', 'pending_payment', 'confirmed')`).
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
| 7c | `POST` | `/bookings/quote` | Authenticated | CUS-08 | Body: tương tự `/bookings/hold` | `200` `{ data: { courtId, start, end, totalPrice, depositAmount, slots } }` | **Đã triển khai.** Xem trước báo giá và tiền cọc tính từ server. |

---

### 2.2. Nhóm Vận hành lịch & Khoá sân Owner (P0)

Phục vụ màn hình Timeline, đặt sân vãng lai tại quầy và quản lý bảo trì sân. Bảng DB: `blackout_periods`, `bookings`, `courts`, `venues`.

| # | Method | Endpoint (`/api/v1`) | Quyền / Auth | Mã | Input chính | Output chính | Ghi chú kỹ thuật & Mã lỗi |
|---|---|---|---|---|---|---|---|
| 8 | `GET` | `/owner/timeline` | Owner | OWN-06 | Query: `venueId`, `date=YYYY-MM-DD` | `200` `{ data: OwnerTimelineDay }` | Trả toàn bộ court của venue kèm các block 30 phút đã đặt, hold, blackout và opening hours trong ngày cụ thể. Dữ liệu realtime dùng chung room socket `venue:{venueId}:date:{yyyy-mm-dd}`. |
| 9 | `POST` | `/owner/bookings/manual` | Owner | OWN-07 | Body: `{ courtId, start, end, guestName, guestPhone, note? }` (hoặc `customerId`) | `201` `{ data: BookingDetail }` | Tạo booking thủ công cho khách vãng lai tại quầy. Bỏ qua bước hold và cổng thanh toán online: tạo thẳng `bookings.status = 'confirmed'`, `source = 'manual'`, tạo payment kèm theo với `provider = 'cash'`, `status = 'completed'`. |
| 10 | `GET` | `/owner/bookings` | Owner | OWN-06 | Query: `venueId?`, `courtId?`, `status?`, `from?`, `to?`, `q?`, `page`, `limit` | `200` `{ data: OwnerBookingItem[], meta }` | Danh sách đặt sân tại các cơ sở do Owner sở hữu. `from`, `to` theo ngày Việt Nam `YYYY-MM-DD`. `q` tìm kiếm không phân biệt hoa/thường theo mã đơn, tên/sđt khách, tên sân con. Lọc áp dụng trước phân trang. |
| 11 | `GET` | `/courts/:id/blackouts` | Owner | OWN-08 | Param: `id` (courtId), Query: `from?`, `to?` | `200` `{ data: BlackoutPeriod[] }` | Danh sách các khoảng khoá bảo trì của sân con. Owner phải là chủ sở hữu cơ sở chứa sân con này. |
| 12 | `POST` | `/courts/:id/blackouts` | Owner | OWN-08 | Param: `id` (courtId), Body: `{ start, end, reason? }` | `201` `{ data: BlackoutPeriod }` | Khoá bảo trì sân con. Block bắt buộc là bội số 30 phút (`400 INVALID_TIME_RANGE`). Không được đè lên booking đang hoạt động (`held`, `pending_payment`, `confirmed`) — nếu trùng trả `409 CONFLICT_WITH_EXISTING_BOOKING`. Phát Socket.IO `slot_updated: blocked`. |
| 13 | `DELETE` | `/courts/:id/blackouts/:blackoutId` | Owner | OWN-08 | Param: `id` (courtId), `blackoutId` | `204` No Content | Mở lại sân đã khoá bảo trì. Trả các block trong khoảng về `available` (nếu trong giờ mở cửa và chưa qua giờ hiện tại). Phát Socket.IO `slot_updated: available`. |

---

### 2.3. Nhóm Đơn vị hành chính 2 cấp (P0/P1 — ADR-022, ADR-023)

Hệ thống quản lý địa giới hành chính theo mô hình 34 Tỉnh/Thành phố trực thuộc TW và 3.321 Xã/Phường/Đặc khu (mốc 03/11/2026). Bảng DB: `areas`.

| # | Method | Endpoint (`/api/v1`) | Quyền / Auth | Mã | Input chính | Output chính | Ghi chú kỹ thuật & Mã lỗi |
|---|---|---|---|---|---|---|---|
| 14 | `GET` | `/provinces` | Public | CUS-04 | Không | `200` `{ data: Province[] }` | Danh sách 34 Tỉnh/TP TW (có `id`, `code`, `name`, `slug`). Phục vụ bộ lọc địa lý của khách và form tạo cơ sở của chủ sân. |
| 15 | `GET` | `/provinces/:code/wards` | Public | CUS-04 | Param: `code` (mã hoặc UUID tỉnh), Query: `q?`, `limit?` | `200` `{ data: Ward[] }` | Danh sách Xã/Phường thuộc một tỉnh/thành. `code` nhận cả mã định danh (ví dụ `79`) lẫn UUID. |
| 16 | `GET` | `/wards/search` | Public | CUS-04 | Query: `q`, `provinceCode?`, `limit?` | `200` `{ data: Ward[] }` | Tìm kiếm autocomplete xã/phường trên toàn quốc hoặc trong phạm vi một tỉnh. Hỗ trợ tìm kiếm unaccent không dấu tiếng Việt. |
| 17 | `GET` | `/provinces/:id/districts` | Public | Legacy | Param: `id` (provinceId) | `200` `{ data: District[] }` | Endpoint tương thích ngược hệ thống 3 cấp cũ cho các dữ liệu/bản ghi legacy chưa chuyển đổi sang ĐVHC 2 cấp. |

---

### 2.4. Nhóm Thông báo in-app (P1)

Bảng DB: `notifications`. Phục vụ chuông thông báo header và trung tâm thông báo người dùng.

| # | Method | Endpoint (`/api/v1`) | Quyền / Auth | Mã | Input chính | Output chính | Ghi chú kỹ thuật & Mã lỗi |
|---|---|---|---|---|---|---|---|
| 18 | `GET` | `/notifications` | Authenticated | CUS-14 | Query: `unreadOnly?`, `page`, `limit` | `200` `{ data: Notification[], meta }` | Danh sách thông báo của tài khoản đang đăng nhập. Sort `createdAt DESC, id DESC`. Hỗ trợ lọc chỉ lấy thông báo chưa đọc. |
| 19 | `GET` | `/notifications/unread-count` | Authenticated | CUS-14 | Không | `200` `{ data: { count: number } }` | Đếm số lượng thông báo chưa đọc phục vụ hiển thị badge đỏ trên chuông header. Phản hồi nhanh, tối ưu query count. |
| 20 | `PATCH` | `/notifications/:id/read` | Authenticated | CUS-14 | Param: `id` (notificationId) | `200` `{ data: Notification }` | Đánh dấu 1 thông báo là đã đọc (`readAt = now()`). User chỉ được đánh dấu thông báo thuộc sở hữu của chính mình (`404 NOT_FOUND` nếu không tồn tại hoặc sai chủ). |
| 21 | `POST` | `/notifications/read-all` | Authenticated | CUS-14 | Không | `200` `{ data: { updated: number } }` | Đánh dấu tất cả thông báo chưa đọc của user hiện tại thành đã đọc trong một thao tác. Trả về số lượng bản ghi đã cập nhật. |

---

### 2.5. Nhóm Sân yêu thích (P1)

Bảng DB: `favorites`, `venues`. Khách hàng lưu và quản lý các cơ sở thể thao quan tâm.

| # | Method | Endpoint (`/api/v1`) | Quyền / Auth | Mã | Input chính | Output chính | Ghi chú kỹ thuật & Mã lỗi |
|---|---|---|---|---|---|---|---|
| 22 | `GET` | `/favorites` | Customer | CUS-12 | Không (contract không quy định phân trang) | `200` `{ data: VenueListItem[] }` | Danh sách cơ sở yêu thích của khách hàng. Chỉ hiển thị các venue còn hoạt động (`deleted_at IS NULL`) và đã được duyệt (`approved`). |
| 23 | `PUT` | `/favorites/:venueId` | Customer | CUS-12 | Param: `venueId` | `200` `{ data: { favorited: true } }` | Thêm cơ sở vào danh sách yêu thích. **Idempotent:** gọi nhiều lần vẫn trả `200` thành công, không tạo trùng khóa nhờ ràng buộc `(user_id, venue_id)`. FE hiện gọi `POST /favorites/:venueId` — cần thống nhất `PUT` theo contract. |
| 24 | `DELETE` | `/favorites/:venueId` | Customer | CUS-12 | Param: `venueId` | `200` `{ data: { favorited: false } }` | Xoá cơ sở khỏi danh sách yêu thích. **Idempotent:** gọi lại khi đã xoá hoặc chưa từng thích vẫn trả `200` an toàn. |

---

### 2.6. Nhóm Báo cáo & Đánh giá Owner (P1)

Bảng DB: `bookings`, `payments`, `reviews`, `courts`, `venues`.

| # | Method | Endpoint (`/api/v1`) | Quyền / Auth | Mã | Input chính | Output chính | Ghi chú kỹ thuật & Mã lỗi |
|---|---|---|---|---|---|---|---|
| 25 | `GET` | `/owner/reports/revenue` | Owner | OWN-11 | Query: `from`, `to`, `groupBy=day/week/month`, `venueId?`, `courtId?` | `200` `{ data: RevenueReport }` | Báo cáo doanh thu theo dải ngày Việt Nam (`YYYY-MM-DD`, inclusive). Mặc định `groupBy=day`. Trả về `summary` (`totalRevenue`, `totalBookings`, `from`, `to`) và mảng `series: [{ date, revenue, bookings }]` (lấp đầy số 0 cho các ngày không có đơn). |
| 26 | `GET` | `/owner/reports/occupancy` | Owner | OWN-12 | Query: `from`, `to`, `venueId?`, `courtId?`, `compareWith?` | `200` `{ data: OccupancyReport }` | Báo cáo tỷ lệ lấp đầy theo công suất block 30 phút. Trả `summary.occupancyRate` (từ 0..1), tổng `bookedSlots`, `availableSlots`, danh sách `peakHours: [{ startTime, endTime, bookedSlots }]` và `series: [{ date, occupancyRate, bookedSlots, availableSlots }]`. |
| 27 | `GET` | `/owner/reviews` | Owner | OWN-13 | Query: `venueId?`, `replied?`, `page`, `limit` | `200` `{ data: OwnerReview[], meta }` | Danh sách đánh giá tại các cơ sở của Owner. `replied` nhận boolean string (`true`/`false`) để lọc đánh giá đã phản hồi hoặc chưa phản hồi. Sắp xếp `createdAt DESC, id DESC`. |
| 28 | `PATCH` | `/owner/reviews/:id/reply` | Owner | OWN-13 | Param: `id` (reviewId), Body: `{ ownerReply: string }` | `200` `{ data: Review }` | Chủ cơ sở tạo hoặc sửa phản hồi cho đánh giá của khách hàng. `ownerReply` sau khi trim có độ dài 1–2.000 ký tự. Chỉ chủ cơ sở chứa review mới có quyền thao tác (`404 NOT_FOUND` hoặc `403 FORBIDDEN`). |
| 29 | `PATCH` | `/owner/payments/:id/refund` | Owner | OWN-09 | Param: `id` (paymentId), Body: `{ note? }` | `200` `{ data: Payment }` | Đánh dấu đã hoàn trả tiền cọc cho khách qua chuyển khoản ngoài hệ thống. Chuyển `payments.status -> refunded`. **Lưu ý:** MVP không tích hợp API hoàn tiền tự động qua ngân hàng; cron hệ thống không bao giờ tự đặt `refunded`. |

---

### 2.7. Nhóm Auth, Uploads & Tiện ích bổ sung (P1)

Bảng DB: `users`, `auth_tokens`, `reviews`.

| # | Method | Endpoint (`/api/v1`) | Quyền / Auth | Mã | Input chính | Output chính | Ghi chú kỹ thuật & Mã lỗi |
|---|---|---|---|---|---|---|---|
| 30 | `POST` | `/auth/resend-verification` | Public | CUS-01 | Body: `{ email }` | `204` No Content | Gửi lại email xác thực tài khoản qua Resend. Kiểm tra email hợp lệ, bảo mật không tiết lộ email có tồn tại hay không, áp dụng rate limiter chống spam. |
| 31 | `POST` | `/users/me/avatar` | Authenticated | CUS-15 | `multipart/form-data`, field: `file` | `200` `{ data: { id, url } }` hoặc `{ data: User }` | Upload ảnh đại diện người dùng lên Cloudflare R2 / local storage. Dung lượng tối đa 5 MB, định dạng cho phép: `image/jpeg`, `image/png`, `image/webp` (lỗi `400 UNSUPPORTED_FILE_TYPE`, `413 FILE_TOO_LARGE`). Cập nhật `avatarUrl` vào tài khoản. |
| * | `GET` | `/venues/:id/reviews/summary` | Public | CUS-06 | Param: `id` (venueId/slug) | `200` `{ data: ReviewSummary }` | Thống kê phân bố sao đánh giá (`average`, `total`, `buckets: [{ star, count }]`) phục vụ component Header/Rating của trang chi tiết sân phía Frontend. |

---

## 3. Realtime WebSocket Gateway (Socket.IO — P0)

Xây dựng `EventsGateway` (namespace `/api/v1/realtime` hoặc root `/`) tích hợp chặt chẽ với `RealtimeSessionsService` (`apps/api/src/modules/auth/realtime-sessions.service.ts`).

### 3.1. Các Room bắt buộc

| Tên Room | Loại | Cơ chế tham gia | Mục đích |
|---|---|---|---|
| `venue:{venueId}:date:{yyyy-mm-dd}` | Công khai | Client emit `join_venue` kèm `{ venueId, date }` | Lắng nghe cập nhật slot theo ngày khi đang xem lịch sân hoặc timeline |
| `user:{userId}` | Cá nhân | Server **tự động gán** sau khi decode JWT thành công | Nhận sự kiện booking, huỷ đơn, trạng thái thanh toán, thông báo cá nhân |
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
│ - 7 REST APIs chuẩn + 3 APIs bổ trợ (hold, slots,      │
│   cancel, confirm, list, detail, no-show, quote...)    │
│ - Advisory Lock theo courtId + PostgreSQL GiST EXCLUDE │
│ - Unit test (booking-rules) & Concurrency 20-way test  │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ Đợt 2: Realtime Socket.IO & Vận hành Owner             │
│ [TIẾP THEO]                                            │
│ - Socket.IO EventsGateway (3 rooms, 10 events)         │
│ - Module: owner timeline, blackouts, manual booking    │
│ - 6 REST APIs + Cron huỷ hold / quá hạn thanh toán     │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ Đợt 3: Đơn vị hành chính, Tương tác & Báo cáo          │
│ - Module: provinces/wards (ADR-022 ĐVHC 2 cấp)         │
│ - Module: notifications, favorites, reports, reviews   │
│ - 18 REST APIs còn lại + upload avatar R2             │
└────────────────────────────────────────────────────────┘
```

---

## 5. Bảng chuẩn hoá đường dẫn giữa Frontend và Backend

Đối chiếu giữa `apps/web/lib/api/endpoints/` và `docs/11-api-contract.md` cho thấy một số hàm Frontend trước đây gọi đường dẫn hoặc phương thức chưa khớp với REST contract chuẩn của Backend. Dưới đây là tình trạng rà soát và chuẩn hóa:

| Hàm ở Frontend (`apps/web`) | Đường dẫn FE cũ | Đường dẫn chuẩn theo Backend Contract | Tình trạng chuẩn hoá |
|---|---|---|---|
| `reviewVenue` | `PATCH /admin/venues/:id` | `PATCH /venues/:id/status` | **Đã chuẩn hoá** trong `admin.ts`: gọi `PATCH /venues/:id/status` với body `{ status, reason }`. |
| `setUserStatus` | `PATCH /admin/users/:id/status` | `PATCH /users/:id/status` | **Đã chuẩn hoá** trong `admin.ts`: gọi `PATCH /users/:id/status`. |
| `setReviewVisibility` | `PATCH /admin/reviews/:id/visibility` | `PATCH /reviews/:id/visibility` | **Đã chuẩn hoá** trong `admin.ts`: gọi `PATCH /reviews/:id/visibility`. |
| `createSport` | `POST /admin/sports` | `POST /sports` | **Đã chuẩn hoá** trong `admin.ts`: gọi `POST /sports`. |
| `deleteSport` | `DELETE /admin/sports/:id` | `DELETE /sports/:id` | **Đã chuẩn hoá** trong `admin.ts`: gọi `DELETE /sports/:id`. |
| `createArea` | `POST /admin/areas` | `POST /areas` | **Đã chuẩn hoá** trong `admin.ts`: gọi `POST /areas`. |
| `cancelBooking` | `POST /bookings/:id/cancel` | `PATCH /bookings/:id/cancel` | **Đã chuẩn hoá** trong `bookings.ts`: chuyển method thành `PATCH`. |
| `forceCancelBooking` | `PATCH /admin/bookings/:id/cancel` | `PATCH /bookings/:id/cancel` | **Đã chuẩn hoá** trong `admin.ts`: chuyển sang dùng chung `PATCH /bookings/:id/cancel`. |
| `createReview` | `POST /bookings/:bookingId/review` | `POST /reviews` | **Đã chuẩn hoá** trong `bookings.ts`: gọi `POST /reviews` với body `{ bookingId, rating, comment? }`. |
| `addFavorite` | `POST /favorites/:venueId` | `PUT /favorites/:venueId` | **Đã chuẩn hoá** trong `bookings.ts`: chuyển method thành `PUT` (idempotent). |
| `markBookingNoShow` | `POST /owner/bookings/:bookingId/no-show` | `PATCH /bookings/:id/no-show` | **Đã chuẩn hoá** trong `owner.ts`: chuyển method thành `PATCH` và path `/bookings/:id/no-show`. |
| `getBankAccount` | `GET /owner/venues/:venueId/payment-account` | `GET /owner/venues/:id/payment-account` | **Đã khớp**: segment `:id` đại diện venueId. |
| `getCancellationPolicy` | `GET /owner/venues/:venueId/cancellation-policy` | `GET /owner/venues/:id/cancellation-policy` | **Đã khớp**: segment `:id` đại diện venueId. |
| `getOpeningHours` | `GET /owner/venues/:id/opening-hours` | `GET /courts/:id/opening-hours` | Giờ mở cửa DB và Contract gắn với từng sân con (`courts`). Backend hỗ trợ thêm endpoint cấp Venue hoặc FE đổi sang gọi theo Court. |
| `replaceOpeningHours` | `PUT /owner/venues/:id/opening-hours` | `PUT /courts/:id/opening-hours` | Tương tự; chuẩn hóa theo Court hoặc thêm alias cấp Venue để cập nhật hàng loạt. |
| `listPricingRules` | `GET /owner/venues/:id/pricing-rules` | `GET /courts/:id/pricing-rules` | Bảng giá gắn với từng sân con (`courts`). |
| `createPricingRule` | `POST /owner/venues/:id/pricing-rules` | `POST /courts/:id/pricing-rules` | Chuẩn hóa theo Court. |
| `deletePricingRule` | `DELETE /owner/pricing-rules/:id` | `DELETE /courts/:id/pricing-rules/:ruleId` | Chuẩn hoá param gồm `courtId` và `ruleId`. |
| `setUserRole` | `PATCH /admin/users/:id/role` | Chưa có trong contract | Nâng quyền Owner thực hiện qua luồng duyệt hồ sơ `PATCH /admin/owner-applications/:id`; không mở route đổi role tuỳ tiện. |
| `quoteBooking` | `POST /bookings/quote` | `POST /bookings/quote` | **Đã triển khai** ở Backend tại Đợt 1 để FE tính trước tổng tiền/tiền cọc mà không tin cậy client. |
| `getHold` | `GET /bookings/hold/:id` | `GET /bookings/:id` | **Đã hỗ trợ cả hai:** route chuẩn `GET /bookings/:id` và alias `GET /bookings/hold/:id` trả kèm trường `remainingMs`. |

---

## 6. Tiêu chí nghiệm thu hoàn thành (Definition of Done)

1. Mọi API mới phải có **Unit test** và **E2E/Integration test** chạy trên PostgreSQL test container.
2. Không nhận giá hoặc tính toán cọc từ Client — mọi số tiền bắt buộc tính từ `pricing_rules` và `cancellation_policies` tại Backend.
3. Tuyệt đối tuân thủ `EXCLUDE` constraint chống trùng lịch của bảng `bookings` tại database.
4. Mọi response trả về tuân thủ envelope `{ "data": ... }` hoặc HTTP `204` No Content theo quy ước dự án.
5. Swagger `/api/docs` tự động cập nhật schema và DTO đầy đủ cho các endpoint mới.
