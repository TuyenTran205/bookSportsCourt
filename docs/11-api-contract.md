# 11 – Hợp đồng API

> **Phiên bản:** 1.2.0 | **Cập nhật lần cuối:** 2026-10-07
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
| 422 | `HOLD_LIMIT_EXCEEDED` | Quá giới hạn hold đồng thời |
| 422 | `CANCELLATION_NOT_ALLOWED` | Booking không còn được huỷ theo chính sách huỷ |
| 422 | `PAYMENT_ACCOUNT_MISSING` | Venue chưa cấu hình tài khoản nhận tiền nên chưa thể tạo hold |
| 422 | `HOLD_EXPIRED` | Hold đã hết hạn, không thể tải ảnh chứng minh |
| 422 | `REVIEW_NOT_ALLOWED` | Booking chưa `completed` hoặc không thuộc về người dùng |
| 429 | `RATE_LIMIT_EXCEEDED` | Quá số request cho phép |
| 500 | `INTERNAL_ERROR` | Lỗi server |

## Phân trang

```
GET /api/v1/venues?page=1&limit=20&sort=created_at&order=desc
```

Response luôn kèm `meta.total` và `meta.totalPages`.

## Idempotency

- `POST /api/v1/bookings/hold`: gửi cùng `courtId + during` trong 10 phút → trả về hold hiện tại (không tạo mới).
- `PATCH /api/v1/owner/payments/:id/approve`: gọi lại trên payment đã `completed` → 200 với trạng thái hiện tại, không đổi dữ liệu.
- `POST /api/v1/bookings/:id/payment/proof`: tải lại ảnh khi payment đang `submitted` → thay ảnh, không tạo payment mới.

## Danh sách Endpoint theo Module

### Auth
```
POST   /api/v1/auth/register          Đăng ký tài khoản
POST   /api/v1/auth/login             Đăng nhập
POST   /api/v1/auth/logout            Đăng xuất (revoke token)
POST   /api/v1/auth/refresh           Làm mới access token
GET    /api/v1/auth/google            Bắt đầu OAuth Google
GET    /api/v1/auth/google/callback   OAuth callback
GET    /api/v1/auth/me                Lấy thông tin user hiện tại
POST   /api/v1/auth/forgot-password   Gửi email đặt lại mật khẩu (luôn trả 204, không lộ email có tồn tại)
POST   /api/v1/auth/reset-password    Đặt mật khẩu mới bằng token trong email
POST   /api/v1/auth/verify-email      Xác thực email bằng token (CUS-01)
POST   /api/v1/auth/resend-verification  Gửi lại email xác thực
```

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
GET    /api/v1/venues/:slug           Chi tiết venue (public)
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

`GET /venues` nhận query: `provinceId`, `districtId`, `sportId`, `amenityIds` (CSV), `maxPrice`, `q`, `page`, `limit`, `sort` (`rating|price|created_at`). `POST/PATCH /venues` nhận `provinceId` và `districtId` (400 nếu quận không thuộc tỉnh).

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

### Courts
```
GET    /api/v1/venues/:venueId/courts            Danh sách courts
POST   /api/v1/venues/:venueId/courts            [Owner] Tạo court
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

`GET /owner/timeline?venueId=&date=YYYY-MM-DD` trả mọi court của venue kèm block đã đặt, hold, blackout và giờ mở cửa của ngày đó. Realtime dùng chung room `join_venue`.

### Bookings
```
GET    /api/v1/bookings                  [Customer] Lịch sử của tôi (query: status, page, limit)
GET    /api/v1/bookings/:id              Chi tiết booking
POST   /api/v1/bookings/hold             [Customer] Tạo hold (body: courtId, start, end)
PATCH  /api/v1/bookings/:id/cancel       Huỷ booking (body: reason)
GET    /api/v1/bookings/:id/cancellation-preview  [Customer] Xem điều kiện huỷ và số tiền hoàn trước khi xác nhận (CUS-11)
PATCH  /api/v1/bookings/:id/no-show      [Owner] Đánh dấu no-show
GET    /api/v1/owner/bookings            [Owner] Xem bookings của venue mình (query: venueId, courtId, status, from, to, page, limit)
POST   /api/v1/owner/bookings/manual     [Owner] Tạo booking thủ công (body: courtId, start, end, customerId hoặc guestName + guestPhone); tạo thẳng `confirmed`, thanh toán `cash`
```

`POST /bookings/hold` trả `booking` ở trạng thái `held` kèm `expiresAt` (FE đếm ngược 10 phút, CUS-08) và `payment` gồm `amount`, `transferCode`, `bankAccount` (`bankBin`, `accountNo`, `accountName`) để FE dựng mã VietQR.

### Payments (chuyển khoản QR, ADR-006)
```
POST   /api/v1/bookings/:id/payment/proof   [Customer] Tải ảnh chuyển khoản (multipart, field `file`); booking → pending_payment
GET    /api/v1/bookings/:id/payment         [Customer/Owner] Trạng thái thanh toán và ảnh chứng minh
GET    /api/v1/owner/payments               [Owner] Danh sách chờ duyệt (query: status=submitted, venueId, page, limit)
PATCH  /api/v1/owner/payments/:id/approve   [Owner] Duyệt đã nhận tiền; booking → confirmed
PATCH  /api/v1/owner/payments/:id/reject    [Owner] Từ chối (body: reason); booking → cancelled
GET    /api/v1/owner/venues/:id/payment-account  [Owner] Tài khoản nhận tiền của venue
PUT    /api/v1/owner/venues/:id/payment-account  [Owner] Cập nhật tài khoản nhận tiền (bankBin, accountNo, accountName)
```

Quá `OWNER_REVIEW_TIMEOUT` (2 giờ) kể từ lúc khách tải ảnh mà Owner chưa xử lý, hệ thống tự huỷ booking. Không có webhook ngân hàng ở MVP.

### Reviews
```
GET    /api/v1/venues/:venueId/reviews   Danh sách review (public, chỉ review đang hiển thị)
POST   /api/v1/reviews                   [Customer] Đánh giá (cần booking completed)
PATCH  /api/v1/reviews/:id/visibility    [Admin] Ẩn/hiện review
POST   /api/v1/reviews/:id/reply         [Owner] Phản hồi đánh giá (OWN-13)
GET    /api/v1/owner/reviews             [Owner] Đánh giá của các venue mình (query: venueId, page, limit)
GET    /api/v1/admin/reviews             [Admin] Mọi review kể cả đang ẩn (query: venueId, isVisible, page, limit)
```

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

| Sự kiện | Hướng | Payload | Mô tả |
|---------|-------|---------|-------|
| `join_venue` | Client → Server | `{ venueId, date }` | Tham gia room theo venue+ngày |
| `leave_venue` | Client → Server | `{ venueId, date }` | Rời room |
| `slot_updated` | Server → Client | `SlotUpdatedPayload` | Cập nhật trạng thái slot |
| `hold_expired` | Server → Client | `{ courtId, bookingId }` | Thông báo hold hết hạn |
| `booking_confirmed` | Server → Client (user room) | `{ bookingId }` | Booking được xác nhận |
| `booking_cancelled` | Server → Client (user room) | `{ bookingId, reason }` | Booking bị huỷ (bởi khách, Owner hoặc hết hạn thanh toán) |
| `booking_created` | Server → Client (owner room) | `{ bookingId, venueId, courtId }` | Có hold mới tại venue của Owner (OWN-14) |
| `payment_submitted` | Server → Client (owner room) | `{ paymentId, bookingId, venueId }` | Khách đã tải ảnh chuyển khoản, chờ Owner duyệt |
| `payment_rejected` | Server → Client (user room) | `{ bookingId, reason }` | Owner từ chối thanh toán |
| `notification_created` | Server → Client (user room) | `{ id, type, title }` | Có thông báo mới, FE tăng badge chưa đọc |
