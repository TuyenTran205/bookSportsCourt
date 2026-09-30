# 11 – Hợp đồng API

> **Phiên bản:** 1.0.0 | **Cập nhật lần cuối:** 2026-09-30
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
| 401 | `UNAUTHORIZED` | Chưa đăng nhập |
| 401 | `TOKEN_EXPIRED` | Access token hết hạn |
| 403 | `FORBIDDEN` | Không có quyền |
| 403 | `NOT_VENUE_OWNER` | Không phải chủ venue |
| 404 | `NOT_FOUND` | Resource không tồn tại |
| 409 | `BOOKING_CONFLICT` | Slot đã được giữ/đặt |
| 409 | `EMAIL_ALREADY_EXISTS` | Email đã được đăng ký |
| 409 | `CONFLICT_WITH_EXISTING_BOOKING` | Blackout trùng booking đã confirmed |
| 422 | `HOLD_LIMIT_EXCEEDED` | Quá giới hạn hold đồng thời |
| 429 | `RATE_LIMIT_EXCEEDED` | Quá số request cho phép |
| 500 | `INTERNAL_ERROR` | Lỗi server |

## Phân trang

```
GET /api/v1/venues?page=1&limit=20&sort=created_at&order=desc
```

Response luôn kèm `meta.total` và `meta.totalPages`.

## Idempotency

- `POST /api/v1/bookings/hold`: gửi cùng `courtId + during` trong 10 phút → trả về hold hiện tại (không tạo mới).
- `POST /api/v1/payments/webhook`: phải xử lý idempotency qua `idempotency_key`.

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
```

### Users
```
GET    /api/v1/users/me               Hồ sơ cá nhân
PATCH  /api/v1/users/me               Cập nhật hồ sơ
GET    /api/v1/users/:id              [Admin] Xem user
PATCH  /api/v1/users/:id/status       [Admin] Khoá/mở tài khoản
```

### Venues
```
GET    /api/v1/venues                 Tìm kiếm venue (public)
GET    /api/v1/venues/:slug           Chi tiết venue (public)
POST   /api/v1/venues                 [Owner] Tạo venue
PATCH  /api/v1/venues/:id             [Owner] Cập nhật venue
DELETE /api/v1/venues/:id             [Owner] Xoá venue
PATCH  /api/v1/venues/:id/status      [Admin] Duyệt/từ chối venue
GET    /api/v1/venues/:id/slots       Lấy trạng thái slots theo ngày
```

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
DELETE /api/v1/courts/:id/blackouts/:blackoutId  [Owner] Xoá blackout
```

### Bookings
```
GET    /api/v1/bookings                  [Customer] Lịch sử của tôi
GET    /api/v1/bookings/:id              Chi tiết booking
POST   /api/v1/bookings/hold             [Customer] Tạo hold
POST   /api/v1/bookings/:id/confirm      [Internal] Xác nhận sau thanh toán
PATCH  /api/v1/bookings/:id/cancel       Huỷ booking
PATCH  /api/v1/bookings/:id/no-show      [Owner] Đánh dấu no-show
GET    /api/v1/owner/bookings            [Owner] Xem bookings của venue mình
POST   /api/v1/owner/bookings/manual     [Owner] Tạo booking thủ công
```

### Payments
```
POST   /api/v1/payments/:bookingId/initiate   Khởi tạo thanh toán VietQR
POST   /api/v1/payments/webhook               Webhook xác nhận (idempotent)
GET    /api/v1/payments/:bookingId/status      Kiểm tra trạng thái
```

### Reviews
```
GET    /api/v1/venues/:venueId/reviews   Danh sách review
POST   /api/v1/reviews                   [Customer] Đánh giá (cần booking completed)
PATCH  /api/v1/reviews/:id/visibility    [Admin] Ẩn/hiện review
```

### Admin
```
GET    /api/v1/admin/users               Danh sách user
GET    /api/v1/admin/venues              Danh sách venue chờ duyệt
GET    /api/v1/admin/bookings            Toàn bộ booking
GET    /api/v1/admin/stats               Thống kê tổng quan
GET    /api/v1/admin/audit-logs          Audit log
```

## Sự kiện WebSocket (Socket.IO)

| Sự kiện | Hướng | Payload | Mô tả |
|---------|-------|---------|-------|
| `join_venue` | Client → Server | `{ venueId, date }` | Tham gia room theo venue+ngày |
| `leave_venue` | Client → Server | `{ venueId, date }` | Rời room |
| `slot_updated` | Server → Client | `SlotUpdatedPayload` | Cập nhật trạng thái slot |
| `hold_expired` | Server → Client | `{ courtId, bookingId }` | Thông báo hold hết hạn |
| `booking_confirmed` | Server → Client (user room) | `{ bookingId }` | Booking được xác nhận |
