# 11 – Hợp đồng API

> **Phiên bản:** 1.8.0 | **Cập nhật lần cuối:** 2026-10-17
>
> **Quy tắc:** Cập nhật tài liệu này TRƯỚC khi chia việc FE/BE. OpenAPI spec là nguồn sự thật.

## Quy ước REST

- Base URL: `/api/v1`
- Versioning: `/api/v1/` (tăng lên `v2` khi breaking change)
- Resource: danh từ số nhiều, snake_case: `/venues`, `/courts`, `/pricing-rules`
- HTTP Methods: `GET` (đọc), `POST` (tạo), `PATCH` (cập nhật một phần), `DELETE` (xoá mềm)
- Auth: Cookie httpOnly (access token), không Bearer token trong header
- Content-Type: `application/json`

## Định dạng Response chuẩn

### Thành công

```json
{
  "data": { /* hoặc array */ },
  "meta": {             // Chỉ có khi pagination
    "page": 1,
    "limit": 20,
    "total": 145,
    "totalPages": 8
  }
}
```

### Lỗi chuẩn

```json
{
  "error": {
    "code":       "BOOKING_CONFLICT",
    "message":    "Slot này vừa được đặt bởi người khác. Vui lòng chọn slot khác.",
    "httpStatus": 409,
    "details":    {}    // Tuỳ chọn: thông tin bổ sung
  }
}
```

## Bảng mã lỗi chuẩn

| HTTP | Code | Mô tả |
|------|------|-------|
| 400 | `VALIDATION_ERROR` | Input không hợp lệ |
| 400 | `INVALID_TIME_RANGE` | Block không phải bội số 30 phút |
| 400 | `INVALID_STATUS_TRANSITION` | Chuyển trạng thái booking không hợp lệ |
| 400 | `UNSUPPORTED_FILE_TYPE` | Định dạng file upload không được hỗ trợ |
| 401 | `UNAUTHORIZED` | Chưa đăng nhập |
| 401 | `TOKEN_EXPIRED` | Access token hết hạn |
| 401 | `INVALID_CREDENTIALS` | Sai email hoặc mật khẩu |
| 401 | `INVALID_TOKEN` | Token đặt lại mật khẩu / xác thực email không hợp lệ hoặc hết hạn |
| 403 | `FORBIDDEN` | Không có quyền |
| 403 | `NOT_VENUE_OWNER` | Không phải chủ venue |
| 403 | `ACCOUNT_SUSPENDED` | Tài khoản đang bị khoá |
| 403 | `OWNER_NOT_APPROVED` | Chủ sân chưa được Admin duyệt hồ sơ |
| 404 | `NOT_FOUND` | Resource không tồn tại |
| 409 | `BOOKING_CONFLICT` | Slot đã được giữ/đặt |
| 409 | `EMAIL_ALREADY_EXISTS` | Email đã được đăng ký |
| 409 | `CONFLICT_WITH_EXISTING_BOOKING` | Blackout trùng booking đã confirmed |
| 409 | `ALREADY_EXISTS` | Trùng giá trị duy nhất (slug môn, tiện ích, khu vực, đánh giá của một booking, hồ sơ chủ sân đang chờ duyệt) |
| 409 | `RESOURCE_IN_USE` | Không xoá được vì còn được tham chiếu (môn, tiện ích, khu vực đang dùng) |
| 413 | `FILE_TOO_LARGE` | File upload vượt dung lượng cho phép |
| 422 | `HOLD_LIMIT_EXCEEDED` | Quá giới hạn hold đồng thời: mỗi khách tối đa **3** booking ở trạng thái `held` (hằng số `HOLD_LIMIT`, cấu hình qua env). Chi tiết quy tắc ở [06-security-and-permissions.md](06-security-and-permissions.md) |
| 422 | `CANCELLATION_NOT_ALLOWED` | Booking không còn được huỷ theo chính sách huỷ |
| 422 | `PAYMENT_ACCOUNT_MISSING` | Venue chưa cấu hình tài khoản nhận tiền nên chưa thể tạo hold |
| 422 | `HOLD_EXPIRED` | Hold đã hết hạn, không thể gửi ảnh xác nhận chuyển khoản |
| 422 | `REVIEW_NOT_ALLOWED` | Booking chưa `completed` hoặc không thuộc về người dùng |
| 429 | `RATE_LIMIT_EXCEEDED` | Quá số request cho phép |
| 429 | `HOLD_RATE_LIMITED` | Giữ rồi thả cùng một court quá **5 lần/giờ** (cửa sổ trượt 60 phút, hằng số `HOLD_RATE_LIMIT_PER_HOUR`) — chi tiết cách đếm ở [06-security-and-permissions.md](06-security-and-permissions.md) |
| 500 | `INTERNAL_ERROR` | Lỗi server |

## Phân trang

```
GET /api/v1/venues?page=1&limit=20&sort=created_at&order=desc
```

Response luôn kèm `meta.total` và `meta.totalPages`.

## Idempotency

- `POST /api/v1/bookings/hold`: **chỉ idempotent theo từng người dùng.** Gửi lại cùng `courtId + during` khi **chính người dùng đó** đang có hold còn hiệu lực → trả **200** kèm hold hiện tại, không tạo mới. Người dùng **khác** tranh cùng block đã bị giữ → **409 `SLOT_TAKEN`**. Tạo hold mới thành công → **201**.
- `PATCH /api/v1/owner/payments/:id/approve`: gọi lại trên payment đã `completed` → 200 với trạng thái hiện tại, không đổi dữ liệu.
- `POST /api/v1/bookings/:id/payment/proof`: tải lại ảnh khi payment đang `submitted` → thay ảnh, không tạo payment mới.

> **Vì sao phân biệt 201/200/409:** tính idempotent bảo vệ **một** người dùng khỏi double-submit (bấm hai lần, mạng chập chờn) — họ nhận lại đúng hold cũ. Nó **không** được phép biến việc tranh chấp giữa nhiều người thành thành công: hai người khác nhau không thể cùng giữ một block. Ràng buộc `EXCLUDE` ở tầng DB là nơi thực thi điều này; `409` chỉ là cách báo lại. Xem test tương ứng ở [12-coding-standards.md](12-coding-standards.md#api-test-supertest).

## Danh sách Endpoint theo Module

### Auth
```
POST   /api/v1/auth/register          Đăng ký tài khoản
POST   /api/v1/auth/login             Đăng nhập
POST   /api/v1/auth/logout            Đăng xuất (revoke token)
POST   /api/v1/auth/refresh           Làm mới access token
GET    /api/v1/auth/google            Bắt đầu OAuth Google
GET    /api/v1/auth/google/callback   OAuth callback
POST   /api/v1/auth/forgot-password   Gửi email đặt lại mật khẩu (luôn trả 204, không lộ email có tồn tại)
POST   /api/v1/auth/reset-password    Đặt mật khẩu mới bằng token trong email
POST   /api/v1/auth/verify-email      Xác thực email bằng token (CUS-01)
POST   /api/v1/auth/resend-verification  Gửi lại email xác thực
```

> **Thông tin user hiện tại:** dùng `GET /api/v1/users/me` (mục Users), **không** có `GET /auth/me` — trước đây tài liệu liệt kê cả hai cho cùng một chức năng. `/auth/*` chỉ còn các endpoint xác thực/phiên, không trả hồ sơ.

### Users
```
GET    /api/v1/users/me               Hồ sơ cá nhân
PATCH  /api/v1/users/me               Cập nhật hồ sơ
GET    /api/v1/users/:id              [Admin] Xem user
PATCH  /api/v1/users/:id/status       [Admin] Khoá/mở tài khoản
POST   /api/v1/users/me/avatar        Upload ảnh đại diện (multipart, xem mục Uploads)
PATCH  /api/v1/users/me/password      Đổi mật khẩu (cần mật khẩu cũ)
```

### Venues
```
GET    /api/v1/venues                 Tìm kiếm venue (public)
GET    /api/v1/venues/map             Venue cho bản đồ (public, GST-02): chỉ id, slug, name, lat, lng, giá thấp nhất, điểm TB; lọc cùng bộ lọc /venues + `bbox`
GET    /api/v1/venues/:slug           Chi tiết venue (public, URL SEO — nhận cả slug lẫn UUID)
POST   /api/v1/venues                 [Owner] Tạo venue
PATCH  /api/v1/venues/:id             [Owner] Cập nhật venue (gồm sportIds, amenityIds)
DELETE /api/v1/venues/:id             [Owner] Xoá venue
PATCH  /api/v1/venues/:id/status      [Admin] Duyệt/từ chối venue (body: status, reason)
GET    /api/v1/venues/:id/slots       Lấy trạng thái slots theo ngày
POST   /api/v1/venues/:id/images      [Owner] Upload ảnh venue (multipart, xem mục Uploads)
PATCH  /api/v1/venues/:id/images/order  [Owner] Sắp xếp lại ảnh (body: imageIds theo thứ tự)
DELETE /api/v1/venues/:id/images/:imageId  [Owner] Xoá ảnh
GET    /api/v1/owner/venues           [Owner] Venue của tôi (mọi trạng thái, kèm lý do bị từ chối)
GET    /api/v1/owner/venues/:id/cancellation-policy  [Owner] Chính sách huỷ và cọc (OWN-10)
PUT    /api/v1/owner/venues/:id/cancellation-policy  [Owner] Cập nhật chính sách huỷ và cọc
```

`GET /venues` nhận query: `provinceId`, `districtId`, `sportId`, `amenityIds` (CSV), `maxPrice`, `q`, `page`, `limit`, `sort` (`rating|price|created_at`). `POST/PATCH /venues` nhận `provinceId` và `districtId` (400 nếu quận không thuộc tỉnh). `POST /venues` bắt buộc có `lat` và `lng` do Owner ghim trên bản đồ; `PATCH /venues/:id` nhận cặp tọa độ này khi cập nhật vị trí.

`GET /venues/:id/slots?date=YYYY-MM-DD` trả về theo từng court:

```json
{
  "data": {
    "date": "2026-10-15",
    "courts": [
      {
        "courtId": "uuid",
        "slots": [
          { "start": "2026-10-15T08:00:00+07:00", "end": "2026-10-15T08:30:00+07:00",
            "status": "available", "price": 80000 }
        ]
      }
    ]
  }
}
```

`status` ∈ `available | held | booked | blocked | past` (khớp token màu slot ở `07-design-system.md`). Slot `held` của chính người gọi trả thêm `mine: true`.

> **Quy ước tham số đường dẫn (áp dụng toàn bộ API):**
> - **`:id`** – id của tài nguyên được **nêu tên ở segment ngay trước**: `/venues/:id`, `/bookings/:id`, `/reviews/:id`, `/payments/:id`. Vì vậy các route con của venue cũng dùng `:id`: `/venues/:id/slots`, `/venues/:id/courts`, `/venues/:id/reviews`.
> - **`:venueId`** – id venue khi nó xuất hiện dưới một segment **không** tên là `venues`: `/favorites/:venueId`, query `?venueId=`.
> - **`:slug`** – chỉ dùng ở `GET /venues/:slug`, URL SEO công khai (chấp nhận cả slug lẫn UUID). Response trả kèm `id` để FE dùng UUID cho các lời gọi tiếp theo.
>
> Trước đây tài liệu trộn `:slug`, `:id` và `:venueId` cho cùng một tài nguyên venue.

### Courts
```
GET    /api/v1/venues/:id/courts                 Danh sách courts
POST   /api/v1/venues/:id/courts                 [Owner] Tạo court
PATCH  /api/v1/courts/:id                        [Owner] Cập nhật court
DELETE /api/v1/courts/:id                        [Owner] Xoá court
GET    /api/v1/courts/:id/opening-hours          Giờ mở cửa
PUT    /api/v1/courts/:id/opening-hours          [Owner] Cập nhật giờ mở cửa
GET    /api/v1/courts/:id/pricing-rules          Pricing rules
POST   /api/v1/courts/:id/pricing-rules          [Owner] Tạo pricing rule
PATCH  /api/v1/courts/:id/pricing-rules/:ruleId  [Owner] Cập nhật rule
DELETE /api/v1/courts/:id/pricing-rules/:ruleId  [Owner] Xoá rule
POST   /api/v1/courts/:id/blackouts              [Owner] Tạo blackout
GET    /api/v1/courts/:id/blackouts              [Owner] Danh sách blackout (query: from, to)
DELETE /api/v1/courts/:id/blackouts/:blackoutId  [Owner] Xoá blackout
GET    /api/v1/owner/timeline                    [Owner] Dữ liệu OwnerTimeline (OWN-06)
```

`GET /owner/timeline?venueId=&date=YYYY-MM-DD` trả mọi court của venue kèm block đã đặt, hold, blackout và giờ mở cửa của ngày đó (blackout được lọc theo ngày truy vấn để không ảnh hưởng các ngày khác). Realtime dùng chung room `join_venue`.

Quản lý khoảng khoá sân (Blackout Period – OWN-08):
- `POST /api/v1/courts/:id/blackouts` (body: `{ start, end, reason? }`): Tạo khoảng khoá bảo trì trên sân. Các block 30 phút tương ứng chuyển sang `blocked`, emit sự kiện Socket.IO `slot_updated` (`status: 'blocked'`) tới room `venue:{venueId}:date:{yyyy-mm-dd}`.
- `DELETE /api/v1/courts/:id/blackouts/:blackoutId`: Mở khoá sân (xoá blackout). Trả các block trong khoảng về trạng thái `available` (nếu trong giờ mở cửa và chưa qua giờ hiện tại), emit sự kiện Socket.IO `slot_updated` (`status: 'available'`) tới room `venue:{venueId}:date:{yyyy-mm-dd}`.

### Bookings
```
GET    /api/v1/bookings                  [Customer] Lịch sử của tôi (query: status, page, limit)
GET    /api/v1/bookings/:id              Chi tiết booking
POST   /api/v1/bookings/hold             [Customer] Tạo hold (body: courtId, start, end)
PATCH  /api/v1/bookings/:id/cancel       Huỷ booking (body: reason)
GET    /api/v1/bookings/:id/cancellation-preview  [Customer] Xem điều kiện huỷ và số tiền hoàn trước khi xác nhận (CUS-11)
PATCH  /api/v1/bookings/:id/no-show      [Owner] Đánh dấu no-show
GET    /api/v1/owner/bookings            [Owner] Xem bookings của venue mình (query: venueId, courtId, status, from, to, q, page, limit)
POST   /api/v1/owner/bookings/manual     [Owner] Tạo booking thủ công (body: courtId, start, end, customerId hoặc guestName + guestPhone); tạo thẳng `confirmed`, thanh toán `cash`
```

`GET /owner/bookings` nhận `q` tuỳ chọn để tìm không phân biệt hoa/thường theo mã booking, tên/số điện thoại khách và tên court; bộ lọc được áp dụng trước phân trang.

`POST /bookings/hold` trả `booking` ở trạng thái `held` kèm `expiresAt` (FE đếm ngược 10 phút, CUS-08) và `payment` gồm `amount`, `transferCode`, `bankAccount` (`bankBin`, `accountNo`, `accountName`) để FE tự dựng mã QR chuyển khoản của chủ sân phía client (không có endpoint sinh QR, server không lưu ảnh QR). Lúc xác nhận thanh toán, người đặt gửi ảnh đã chuyển khoản lên để chủ sân đối soát xác nhận.

### Payments (chuyển khoản QR, ADR-006)
```
POST   /api/v1/bookings/:id/payment/proof   [Customer] Gửi ảnh đã chuyển khoản (multipart, field `file`); booking → pending_payment
GET    /api/v1/bookings/:id/payment         [Customer/Owner] Trạng thái thanh toán và ảnh xác nhận chuyển khoản
GET    /api/v1/owner/payments               [Owner] Danh sách chờ duyệt (đối soát ảnh xác nhận, query: status=submitted, venueId, page, limit)
PATCH  /api/v1/owner/payments/:id/approve   [Owner] Duyệt đã nhận tiền; booking → confirmed
PATCH  /api/v1/owner/payments/:id/reject    [Owner] Từ chối (body: reason); booking → cancelled
GET    /api/v1/owner/venues/:id/payment-account  [Owner] Tài khoản nhận tiền của venue
PUT    /api/v1/owner/venues/:id/payment-account  [Owner] Cập nhật tài khoản nhận tiền (bankBin, accountNo, accountName)
```

`GET /owner/venues/:id/payment-account` trả `data: null` nếu venue chưa cấu hình tài khoản; nếu đã cấu hình, trả `{ bankBin, accountNo, accountName }`. `PUT` nhận cùng shape và chỉ áp dụng cho venue thuộc Owner hiện tại.

Quá `OWNER_REVIEW_TIMEOUT` (2 giờ) kể từ lúc khách gửi ảnh mà Owner chưa xử lý, hệ thống tự huỷ booking. Không có webhook ngân hàng ở MVP.

**Hoàn tiền (refund):** MVP **không** có endpoint hoàn tiền tự động và **không** gọi API ngân hàng. Khi booking đã thanh toán (`payments.status = 'completed'`) bị huỷ theo chính sách, Owner chuyển khoản lại cho khách **ngoài hệ thống**, rồi đánh dấu để đóng sổ:

```
PATCH  /api/v1/owner/payments/:id/refund   [Owner] Đánh dấu đã hoàn tiền (body: note?); payments.status → 'refunded'
```

> Ai đặt `payments.status = 'refunded'`? **Chỉ endpoint này** (do Owner bấm sau khi đã chuyển tiền thật). Các cron tự động **không** bao giờ đặt `refunded` — cron huỷ hold hết hạn và booking quá hạn duyệt chỉ đặt `expired`/`cancelled`, vì lúc đó Owner chưa xác nhận nhận tiền nên hệ thống không ghi nhận đã thu. Xem bảng ánh xạ trạng thái ở [05-booking-and-realtime.md](05-booking-and-realtime.md#trạng-thái-thanh-toán-đi-kèm).

> **`PAYMENT_ACCOUNT_MISSING` là lỗi cấu hình, không phải lỗi dữ liệu người dùng.** Nó chỉ phát sinh ở `POST /bookings/hold` (bước đầu của luồng thanh toán) khi venue chưa cấu hình tài khoản nhận tiền — không phát sinh ở các endpoint trong mục Payments này, vì chúng chỉ chạy sau khi hold đã tồn tại.

### Reviews
```
GET    /api/v1/venues/:id/reviews        Danh sách review (public, chỉ review đang hiển thị)
POST   /api/v1/reviews                   [Customer] Đánh giá (cần booking completed)
PATCH  /api/v1/reviews/:id/visibility    [Admin] Ẩn/hiện review
GET    /api/v1/owner/reviews             [Owner] Đánh giá tại venue mình (query: venueId, replied, page, limit)
PATCH  /api/v1/owner/reviews/:id/reply   [Owner] Tạo hoặc sửa phản hồi (body: ownerReply)
GET    /api/v1/admin/reviews             [Admin] Mọi review kể cả đang ẩn (query: venueId, isVisible, page, limit)
```

`replied` lọc theo trạng thái phản hồi (`true` đã phản hồi, `false` chưa phản hồi). Danh sách Owner chỉ trả review thuộc venue của Owner hiện tại; lọc venue và trạng thái phải thực hiện trước phân trang. Phản hồi dài 1–2000 ký tự sau khi trim. API chỉ cho Owner sở hữu venue chứa review tạo/sửa phản hồi; Admin có thể quản lý review trên mọi venue. Venue ngoài quyền hoặc review không tồn tại trả `404 NOT_FOUND`.

> **Schema:** `reviews.owner_reply` và `reviews.owner_replied_at` đã có trong `04-database-schema.md`.

### Favorites
```
GET    /api/v1/favorites                 [Customer] Danh sách venue yêu thích
PUT    /api/v1/favorites/:venueId        [Customer] Thêm yêu thích (idempotent)
DELETE /api/v1/favorites/:venueId        [Customer] Bỏ yêu thích (idempotent)
```

### Notifications
```
GET    /api/v1/notifications             Thông báo của tôi (query: unreadOnly, page, limit)
GET    /api/v1/notifications/unread-count  Số thông báo chưa đọc
PATCH  /api/v1/notifications/:id/read    Đánh dấu đã đọc
POST   /api/v1/notifications/read-all    Đánh dấu tất cả đã đọc
```

### Owner Registration
```
POST   /api/v1/owner-applications        [Customer] Gửi hồ sơ làm chủ sân (OWN-01)
GET    /api/v1/owner-applications/me     [Customer/Owner] Trạng thái hồ sơ của tôi
```

`POST /owner-applications` nhận JSON:
```json
{
  "businessName": "Sân thể thao Phú Nhuận",
  "phone": "0901234567",
  "address": "12 Nguyễn Văn Trỗi, Phường 8, Phú Nhuận, TP. Hồ Chí Minh",
  "taxCode": "0312345678",
  "bankBin": "970436",
  "bankName": "Vietcombank",
  "accountNo": "0123456789",
  "accountName": "NGUYEN VAN A",
  "note": "Cơ sở có sân cầu lông và bóng đá.",
  "idCardUrl": "https://example.com/owner-document.jpg"
}
```
`taxCode`, `note` và `idCardUrl` không bắt buộc. `phone` phải là số Việt Nam 10 chữ số; `bankBin` là mã BIN ngân hàng VietQR. Endpoint trả `OwnerApplication` kèm trạng thái hồ sơ. Các trường ngân hàng, mã số thuế và giấy tờ cần được bổ sung vào database bằng migration có version trước khi backend triển khai hợp đồng này; mock FE lưu hồ sơ trong trình duyệt để phục vụ demo.
Chỉ tài khoản `customer` được gửi hồ sơ; request của Guest trả `401 UNAUTHORIZED`, request của Owner/Admin trả `403 FORBIDDEN`.

> **Schema:** bảng `owner_applications` đã có trong `04-database-schema.md`. Khi Admin duyệt, `users.role` đổi từ `customer` sang `owner` trong cùng transaction.

### Catalogs (danh mục)
```
GET    /api/v1/sports                    Danh sách môn (public)
GET    /api/v1/amenities                 Danh sách tiện ích (public)
GET    /api/v1/areas                     Tỉnh/thành và quận/huyện (public)
POST   /api/v1/sports                    [Admin] Tạo môn
PATCH  /api/v1/sports/:id                [Admin] Sửa môn
DELETE /api/v1/sports/:id                [Admin] Xoá môn (409 RESOURCE_IN_USE nếu đang dùng)
POST   /api/v1/amenities                 [Admin] Tạo tiện ích
PATCH  /api/v1/amenities/:id             [Admin] Sửa tiện ích
DELETE /api/v1/amenities/:id             [Admin] Xoá tiện ích
POST   /api/v1/areas                     [Admin] Tạo khu vực
PATCH  /api/v1/areas/:id                 [Admin] Sửa khu vực
DELETE /api/v1/areas/:id                 [Admin] Xoá khu vực
```

> **Schema:** bảng `areas` (tỉnh/quận hai cấp) đã có, `venues` dùng `province_id` và `district_id` (ADR-009). `GET /areas?type=province` hoặc `?parentId=` để lọc; `POST /areas` với `type=district` bắt buộc `parentId`.

### Owner Reports
```
GET    /api/v1/owner/reports/revenue     [Owner] Doanh thu (OWN-11): query from, to, groupBy=day|week|month, venueId, courtId
GET    /api/v1/owner/reports/occupancy   [Owner] Tỷ lệ lấp đầy và giờ cao điểm (OWN-12): query from, to, venueId, courtId, compareWith=previous
```

`from` và `to` là ngày `YYYY-MM-DD` theo múi giờ `Asia/Ho_Chi_Minh`, bao gồm cả hai đầu mút. Báo cáo doanh thu mặc định nhóm theo ngày và trả:

```json
{
  "data": {
    "summary": {
      "totalRevenue": 1250000,
      "totalBookings": 8,
      "from": "2026-10-10",
      "to": "2026-10-16"
    },
    "series": [
      { "date": "2026-10-10", "revenue": 250000, "bookings": 2 }
    ]
  }
}
```

`totalRevenue` là VND; `series` bao gồm cả ngày không có đơn. `groupBy=week|month` trả `date` là ngày bắt đầu tuần hoặc tháng. Báo cáo lấp đầy trả `summary.occupancyRate` trong khoảng `0..1`, tổng `bookedSlots` và `availableSlots`, danh sách `peakHours` gồm `{ startTime, endTime, bookedSlots }`, cùng chuỗi theo ngày `{ date, occupancyRate, bookedSlots, availableSlots }`. `availableSlots` là số block 30 phút còn trống trong giờ mở cửa; không bao gồm giờ đóng cửa hoặc giờ bị khoá. Khi không có công suất, `occupancyRate` là `0`.

### Uploads
```
Upload ảnh dùng multipart/form-data, field `file`, tối đa 5 MB, chỉ nhận image/jpeg, image/png, image/webp.
Lỗi: 400 UNSUPPORTED_FILE_TYPE, 413 FILE_TOO_LARGE.
Response: { "data": { "id": "uuid", "url": "https://..." } }
```

### Health
```
GET    /api/v1/health                    Kiểm tra sống (public, không cần đăng nhập)
```

### Admin
```
GET    /api/v1/admin/users               Danh sách user (query: role, status, q, page, limit)
GET    /api/v1/admin/venues              Danh sách venue (query: status, q, page, limit; mặc định status=pending)
GET    /api/v1/admin/owner-applications  Hồ sơ chủ sân (query: status, page, limit)
PATCH  /api/v1/admin/owner-applications/:id  Duyệt/từ chối hồ sơ (body: status, reviewNote)
GET    /api/v1/admin/bookings            Toàn bộ booking (query: status, venueId, customerId, from, to, page, limit)
GET    /api/v1/admin/stats               Thống kê tổng quan (query: from, to, groupBy=day|week|month)
GET    /api/v1/admin/audit-logs          Audit log (query: actorId, action, entityType, from, to, page, limit)
```

`GET /admin/stats` trả: tổng booking theo trạng thái, doanh thu, số venue theo trạng thái, số user theo vai trò, và chuỗi theo thời gian cho biểu đồ (ADM-08). Audit log chỉ có `GET`, không có endpoint sửa hoặc xoá (ADM-09).

## Sự kiện WebSocket (Socket.IO)

Tên room dùng đúng quy ước ở [05-booking-and-realtime.md](05-booking-and-realtime.md#kênh-channelroom):
`venue:{venueId}:date:{yyyy-mm-dd}`, `user:{userId}`, `owner:{userId}`.
Room `user:`/`owner:` do server gán sau khi xác thực JWT, client không tự join.

| Sự kiện | Hướng | Room nhận | Payload | Mô tả |
|---------|-------|-----------|---------|-------|
| `join_venue` | Client → Server | – | `{ venueId, date }` | Tham gia room venue+ngày (sai định dạng → `INVALID_ROOM`) |
| `leave_venue` | Client → Server | – | `{ venueId, date }` | Rời room venue+ngày |
| `slot_updated` | Server → Client | `venue:{venueId}:date:{date}` | `SlotUpdatedPayload` | Cập nhật trạng thái slot |
| `hold_expired` | Server → Client | `user:{userId}` | `{ courtId, bookingId }` | Hold của khách hết hạn |
| `booking_confirmed` | Server → Client | `user:{userId}` | `{ bookingId }` | Booking được xác nhận |
| `booking_cancelled` | Server → Client | `user:{userId}` | `{ bookingId, reason }` | Booking bị huỷ (bởi khách, Owner hoặc hết hạn thanh toán) |
| `booking_created` | Server → Client | `owner:{userId}` | `{ bookingId, venueId, courtId }` | Có hold mới tại venue của Owner (OWN-14) |
| `payment_submitted` | Server → Client | `owner:{userId}` | `{ paymentId, bookingId, venueId }` | Khách đã tải ảnh chuyển khoản, chờ Owner duyệt |
| `payment_rejected` | Server → Client | `user:{userId}` | `{ bookingId, reason }` | Owner từ chối thanh toán |
| `notification_created` | Server → Client | `user:{userId}` | `{ id, type, title }` | Có thông báo mới, FE tăng badge chưa đọc |

**Xác thực socket:** JWT gửi qua `handshake.auth.token`. Token sai/hết hạn → server ngắt kết nối với lỗi `UNAUTHORIZED`, **không** gán room nào. Không có kết nối ẩn danh cho realtime (khác với xem lịch công khai qua REST).
