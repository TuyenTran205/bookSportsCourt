# Tổng hợp API đã triển khai

> **Phiên bản:** 1.4.0 | **Cập nhật lần cuối:** 2026-11-01

## Phạm vi

Hiện có **16 endpoint HTTP** trong controller được đăng ký qua AppModule: 7 Auth, 1 Users, 1 Health, 7 Venues. Đủ bảy Venue API, gồm Admin status; đã có kiểm thử HTTP/PostgreSQL. Không phải xác nhận deploy/CI/PR.

- Base URL local mặc định: `http://localhost:3001/api/v1` (port theo cấu hình).
- Body JSON; tên trường camelCase. Xác thực bằng cookie httpOnly, không bằng Bearer header.
- Swagger UI: `/api/docs`, chỉ bật ở development/staging.
- Response thành công có body được bọc `{ "data": ... }`; HTTP 204 không có body.
- Lỗi: `{ "error": { "code": "...", "message": "...", "httpStatus": 400, "details": {} } }`; `details` tuỳ chọn.

## Danh sách đầy đủ

Các đường dẫn dưới đây đã bao gồm prefix `/api/v1`. Hai danh sách Venue nhận query phân trang; public detail nhận slug/UUID.

| Method | Endpoint | X?c th?c / quy?n | Input | Th?nh c?ng |
|---|---|---|---|---|
| POST | `/api/v1/auth/register` | Công khai | `fullName`, `email`, `phone`, `password`, `confirmPassword` | 201, hồ sơ Customer; không tự đăng nhập |
| POST | `/api/v1/auth/login` | Công khai | `email`, `password`, `rememberMe?` | 200, hồ sơ user + hai cookie |
| POST | `/api/v1/auth/refresh` | Cookie `refresh_token` hợp lệ | Không cần body | 200, hồ sơ user + cặp cookie mới |
| POST | `/api/v1/auth/logout` | Không bắt buộc có phiên hợp lệ | Cookie `refresh_token` nếu có | 204, revoke refresh token hiện tại và xoá cookie |
| POST | `/api/v1/auth/forgot-password` | Công khai | `email` | 204, xử lý gửi email nền |
| POST | `/api/v1/auth/reset-password` | Token đặt lại mật khẩu | `token`, `password`, `confirmPassword` | 204, đổi mật khẩu và xoá cookie |
| POST | `/api/v1/auth/verify-email` | Token xác thực email | `token` | 204, cập nhật thời điểm xác thực email |
| GET | `/api/v1/users/me` | Cookie `access_token`; tài khoản active, cả ba role | Không có | 200, hồ sơ hiện tại từ DB |
| GET | `/api/v1/health` | Công khai | Không có | 200, trạng thái API và kết nối DB |
| POST | `/api/v1/venues` | Cookie `access_token`; Owner active | `name`, `address`, `provinceId`, `districtId`, `lat`, `lng`, `description?`, `sportIds?`, `amenityIds?` | 201, OwnerVenueResponse với status pending |
| GET | `/api/v1/owner/venues` | Cookie; Owner active | Query page/limit | 200, danh sách của mình và meta; có trạng thái/reason |
| GET | `/api/v1/admin/venues` | Cookie; Admin active | Query status/q/page/limit, mặc định pending | 200, private projection đủ duyệt và meta |
| GET | `/api/v1/venues/:slug` | Công khai | Exact slug hoặc UUID | 200 VenueDetail approved/chưa xoá; còn lại 404 |
| PATCH | `/api/v1/venues/:id` | Cookie; Owner active đúng chủ | UUID, body updateVenueSchema strict không rỗng | 200 OwnerVenueResponse; thay đổi approved/rejected về pending |
| DELETE | `/api/v1/venues/:id` | Cookie; Owner active đúng chủ | UUID | 204 không body; 409 nếu còn booking chặn, gọi lại 404 |
| PATCH | `/api/v1/venues/:id/status` | Cookie; Admin active | UUID, status và reason chỉ khi rejected | 200 AdminVenueResponse; transition sai 400; audit thay đổi cùng transaction |
| PATCH | `/api/v1/users/me` | Cookie `access_token`; tài khoản active | `fullName`, `phone?`, `avatarUrl?` | 200, hồ sơ user sau cập nhật |
| PATCH | `/api/v1/users/me/password` | Cookie `access_token`; tài khoản active | `currentPassword`, `newPassword`, `confirmPassword` | 204, đổi mật khẩu và xoá cookie |
| GET | `/api/v1/sports` | Công khai | Không có | 200, danh sách môn thể thao |
| POST | `/api/v1/sports` | Admin | `name`, `slug`, `icon?` | 201, môn thể thao mới tạo |
| PATCH | `/api/v1/sports/:id` | Admin | Partial `SportInput` | 200, môn thể thao sau khi sửa |
| DELETE | `/api/v1/sports/:id` | Admin | Không có | 204, xoá môn thể thao (409 nếu đang dùng) |
| GET | `/api/v1/amenities` | Công khai | Không có | 200, danh sách tiện ích |
| POST | `/api/v1/amenities` | Admin | `name`, `slug`, `icon?` | 201, tiện ích mới tạo |
| PATCH | `/api/v1/amenities/:id` | Admin | Partial `AmenityInput` | 200, tiện ích sau khi sửa |
| DELETE | `/api/v1/amenities/:id` | Admin | Không có | 204, xoá tiện ích (409 nếu đang dùng) |
| GET | `/api/v1/areas` | Công khai | Query `type?`, `parentId?` | 200, danh sách khu vực |
| POST | `/api/v1/areas` | Admin | `name`, `slug`, `type`, `parentId?` | 201, khu vực mới tạo |
| PATCH | `/api/v1/areas/:id` | Admin | Partial `AreaInput` | 200, khu vực sau khi sửa |
| DELETE | `/api/v1/areas/:id` | Admin | Không có | 204, xoá khu vực (409 nếu đang dùng) |
| POST | `/api/v1/owner-applications` | Customer | `businessName`, `phone`, `address`, `note?` | 201, hồ sơ đăng ký chủ sân |
| GET | `/api/v1/owner-applications/me` | Customer / Owner | Không có | 200, hồ sơ mới nhất của tài khoản |
| GET | `/api/v1/admin/owner-applications` | Admin | Query `status?`, `page`, `limit` | 200, danh sách hồ sơ kèm phân trang |
| PATCH | `/api/v1/admin/owner-applications/:id` | Admin | `status: 'approved'|'rejected'`, `reviewNote?` | 200, hồ sơ sau duyệt (tự động nâng role lên owner) |
| GET | `/api/v1/venues` | Công khai | Query lọc & phân trang | 200, danh sách sân kèm phân trang |
| GET | `/api/v1/venues/map` | Công khai | Query lọc theo toạ độ bbox | 200, danh sách sân nhẹ cho bản đồ |
| POST | `/api/v1/venues/:id/images` | Owner (chính chủ) | `url`, `sortOrder?` | 201, thêm ảnh cơ sở |
| PATCH | `/api/v1/venues/:id/images/order` | Owner (chính chủ) | `imageIds: string[]` | 200, danh sách ảnh sau sắp xếp |
| DELETE | `/api/v1/venues/:id/images/:imageId` | Owner (chính chủ) | Không có | 204, xoá ảnh |
| GET | `/api/v1/owner/venues/:id/cancellation-policy` | Owner (chính chủ) | Không có | 200, chính sách huỷ và cọc |
| PUT | `/api/v1/owner/venues/:id/cancellation-policy` | Owner (chính chủ) | `CancellationPolicyInput` | 200, cập nhật chính sách huỷ |
| GET | `/api/v1/owner/venues/:id/payment-account` | Owner (chính chủ) | Không có | 200, thông tin tài khoản nhận tiền |
| PUT | `/api/v1/owner/venues/:id/payment-account` | Owner (chính chủ) | `BankAccountInput` | 200, cập nhật tài khoản nhận tiền |
| GET | `/api/v1/venues/:id/courts` | Công khai | Param `id` của cơ sở | 200, danh sách sân con |
| POST | `/api/v1/venues/:id/courts` | Owner (chủ cơ sở) | `name`, `description?`, `sportId?` | 201, tạo sân con + giờ mở cửa mặc định |
| PATCH | `/api/v1/courts/:id` | Owner (chủ sân) | `UpdateCourtInput` | 200, cập nhật sân con |
| DELETE | `/api/v1/courts/:id` | Owner (chủ sân) | Không có | 204, xoá mềm sân con |
| GET | `/api/v1/courts/:id/opening-hours` | Công khai | Không có | 200, giờ mở cửa 7 ngày |
| PUT | `/api/v1/courts/:id/opening-hours` | Owner (chủ sân) | Array `OpeningHourInput` | 200, cập nhật giờ mở cửa |
| GET | `/api/v1/courts/:id/pricing-rules` | Công khai/Owner | Không có | 200, danh sách bảng giá |
| POST | `/api/v1/courts/:id/pricing-rules` | Owner (chủ sân) | `PricingRuleInput` | 201, tạo khung giá theo block 30 phút |
| PATCH | `/api/v1/courts/:id/pricing-rules/:ruleId` | Owner (chủ sân) | Partial `PricingRuleInput` | 200, cập nhật khung giá |
| DELETE | `/api/v1/courts/:id/pricing-rules/:ruleId` | Owner (chủ sân) | Không có | 204, xoá khung giá |
| GET | `/api/v1/provinces` | Công khai | Không có | 200, 34 tỉnh/thành phố (danh mục dùng chung `packages/shared`) |
| GET | `/api/v1/provinces/:codeOrId/wards` | Công khai | Param nhận `code` (2 số) hoặc `id`; query `q?`, `limit?` | 200, phường/xã/đặc khu của tỉnh; tỉnh không tồn tại trả mảng rỗng |
| GET | `/api/v1/provinces/:provinceId/districts` | Công khai | Param | 200, luôn `[]` – cấp huyện đã bỏ từ 01/07/2025 |
| GET | `/api/v1/wards/search` | Công khai | Query `q`, `provinceCode?`, `limit?` | 200, autocomplete không dấu, tối đa 50 kết quả |
| GET | `/api/v1/owner/venues/:id/opening-hours` | Owner (chính chủ) | Không có | 200, đủ 7 `OpeningHour` cấp cơ sở (`courtId: null`) |
| PUT | `/api/v1/owner/venues/:id/opening-hours` | Owner (chính chủ) | `{ hours: OpeningHourInput[] }` | 200, ghi cho toàn bộ sân con của cơ sở |
| GET | `/api/v1/owner/venues/:id/pricing-rules` | Owner (chính chủ) | Không có | 200, `PricingRule[]` cấp cơ sở |
| POST | `/api/v1/owner/venues/:id/pricing-rules` | Owner (chính chủ) | `PricingRuleInput` | 201, tạo khung giá cho toàn bộ sân con |
| DELETE | `/api/v1/owner/pricing-rules/:ruleId` | Owner/Admin | Không có | 204, xoá khung giá ở mọi sân con cùng cơ sở |

> **Ghi chú đồng bộ FE ↔ BE (2026-11-09)**
> - `POST /sports`, `POST /amenities`, `POST /areas`: `slug` **không bắt buộc** – bỏ trống thì BE tự sinh từ `name`.
> - Danh mục admin nằm ở gốc `/sports`, `/amenities`, `/areas` (không có tiền tố `/admin`).
> - Kiểm duyệt cơ sở dùng `PATCH /venues/:id/status` với `{ status, reason? }`.
> - `GET /users/me`, `POST /auth/login`, `POST /auth/register`, `PATCH /users/me` trả **trực tiếp hồ sơ** trong `data` (không bọc `{ user }`) và **không** kèm `ownerProfile`.
> - `GET /venues` nhận thêm `provinceCode`/`wardCode` (mã địa danh) và tự quy đổi sang `provinceId`/`districtId`.

POST Venue dùng strict allowlist; ownerId/status/slug do server quyết định. Kiểm tra địa lý và danh mục, tạo Venue cùng liên kết trong một transaction; lỗi 400 VALIDATION_ERROR, 401 UNAUTHORIZED/TOKEN_EXPIRED, 403 FORBIDDEN/ACCOUNT_SUSPENDED, 409 ALREADY_EXISTS. Giải thích: [Bước 5](bsc-014-step-05-create-venue.md), [Bước 6](bsc-014-step-06-read-venues.md), [Bước 7](bsc-014-step-07-update-and-delete.md), [Bước 8](bsc-014-step-08-admin-moderation.md). Public search/map chưa triển khai.

## Input và hành vi từng API

### 1. Đăng ký

```json
{
  "fullName": "Nguyễn Văn An",
  "email": "an@example.com",
  "phone": "0901234567",
  "password": "MatKhauMau123",
  "confirmPassword": "MatKhauMau123"
}
```

- `fullName`: 2–100 ký tự; schema trim sau kiểm tra độ dài.
- `email`: đúng định dạng, tối đa 255 ký tự; chuẩn hoá chữ thường và trim theo schema.
- `phone`: loại khoảng trắng, dấu chấm/gạch nối; kết quả 10 chữ số, bắt đầu bằng 0.
- `password`: 8–72 ký tự; `confirmPassword` phải khớp.
- Server luôn tạo role `customer`, status `active`; client không chọn role.
- Token xác thực email dùng một lần, hạn 24 giờ; email chứa link FE `/verify-email?token=...`.
- Lỗi chính: 400 `VALIDATION_ERROR`, 409 `EMAIL_ALREADY_EXISTS`, 503 `SERVICE_UNAVAILABLE` khi email chưa cấu hình/gửi thất bại.
- Việc tạo tài khoản commit trước khi gửi email; lỗi gửi email không có nghĩa tài khoản chưa được tạo.

### 2. Đăng nhập

```json
{ "email": "an@example.com", "password": "MatKhauMau123", "rememberMe": true }
```

`rememberMe` là boolean, mặc định false. Password đăng nhập chỉ yêu cầu chuỗi không rỗng. Kiểm tra mật khẩu và trạng thái tài khoản ở BE; hiện không bắt buộc email đã xác thực để login.

Lỗi chính: 400 `VALIDATION_ERROR`, 401 `INVALID_CREDENTIALS` hoặc `UNAUTHORIZED`, 403 `ACCOUNT_SUSPENDED`/`FORBIDDEN`.

### 3. Refresh

Đọc cookie `refresh_token`, kiểm tra JWT và bản ghi token trong DB. Thành công thu hồi token cũ và cấp cặp token mới. Nếu dùng lại token đã revoke, thu hồi toàn bộ refresh token của user. Khi refresh thất bại, controller xoá cả hai cookie.

Lỗi chính: 401 `UNAUTHORIZED`/`TOKEN_EXPIRED`, 403 `ACCOUNT_SUSPENDED`/`FORBIDDEN`.

### 4. Logout

Thu hồi refresh token được gửi lên và xoá hai cookie. Gọi lại hoặc thiếu token vẫn trả 204 nếu không bị chặn bởi origin/rate limit. Không thu hồi toàn bộ phiên trên thiết bị khác.

### 5. Quên mật khẩu

```json
{ "email": "an@example.com" }
```

Email hợp lệ nhận cùng response 204 dù tài khoản không tồn tại, không active hoặc gửi email nền thất bại. Token mới hết hạn sau 1 giờ; các token reset trước đó bị tiêu thụ. Link email dẫn đến FE `/reset-password?token=...`. Ngoài rate limit chung, hàng đợi nền đạt 100 tác vụ đang chờ có thể trả 429.

### 6. Đặt lại mật khẩu

```json
{ "token": "token-tu-email", "password": "MatKhauMoi123", "confirmPassword": "MatKhauMoi123" }
```

Token không rỗng, đúng loại, chưa dùng, chưa hết hạn và user còn active. Password 8–72 ký tự, xác nhận phải khớp. Thành công cập nhật hash, tiêu thụ token reset, revoke mọi refresh token và xoá cookie của request hiện tại. Không tự cấp phiên mới.

Lỗi chính: 400 `VALIDATION_ERROR`, 401 `INVALID_TOKEN`.

### 7. Xác thực email

```json
{ "token": "token-tu-email" }
```

Token không rỗng; kiểm tra loại, hạn, trạng thái đã dùng và tài khoản. Thành công cập nhật `emailVerifiedAt` và tiêu thụ các token xác thực email của user. Lỗi chính: 400 `VALIDATION_ERROR`, 401 `INVALID_TOKEN`.

### 8. Hồ sơ hiện tại

JwtAuthGuard đọc access cookie, xác minh JWT rồi đọc lại user từ DB. Trả cùng cấu trúc hồ sơ như register/login/refresh, không trả hash hoặc token:

| Trường trong `data` | Kiểu |
|---|---|
| `id`, `email`, `fullName` | string |
| `phone`, `avatarUrl` | string hoặc null |
| `role` | `customer`, `owner`, `admin` |
| `status` | trạng thái user; API me chỉ cho tài khoản active |
| `emailVerifiedAt` | ISO datetime hoặc null |
| `createdAt`, `updatedAt` | ISO datetime |

Lỗi chính: 401 `UNAUTHORIZED`/`TOKEN_EXPIRED`, 403 `ACCOUNT_SUSPENDED`/`FORBIDDEN`. Đây là API đọc hồ sơ; chưa có API sửa hồ sơ.

### 9. Health

Chạy `SELECT 1` để kiểm tra kết nối DB.

```json
{ "data": { "status": "ok", "database": "ok" } }
```

DB không sẵn sàng: HTTP 503 với code `DATABASE_UNAVAILABLE`.

## Cookie, CORS và giới hạn request

- Access JWT hạn 15 phút; refresh JWT hạn 30 ngày.
- Cookie có `HttpOnly`, `SameSite=Lax`, `Path=/api/v1`; `Secure` bật ở staging/production.
- `rememberMe=true`: cookie có Max-Age tương ứng 15 phút/30 ngày; false: session cookie, hạn JWT vẫn giữ nguyên.
- FE gọi API với `credentials: 'include'`; origin phải thuộc `ALLOWED_ORIGINS`. Request có Origin ngoài danh sách bị 403 `FORBIDDEN`; request không có Origin không bị chặn chỉ vì thiếu header này.
- Bảy endpoint `/auth/*` dùng chung giới hạn **10 request/IP/5 phút**, lưu trong bộ nhớ một instance. Vượt giới hạn trả 429 `RATE_LIMIT_EXCEEDED`.
- `/users/me` và `/health` không dùng AuthRequestGuard này. Không suy ra đã có global limiter từ limiter auth.
- `/auth/*` và `/users/me` có `Cache-Control: no-store`.
- Lỗi ngoài dự kiến có thể trả 500 `INTERNAL_ERROR`.

## Phần chưa có endpoint thực tế

Google OAuth, slots, booking, xử lý payment/proof, upload multipart/R2, notifications, reviews, favorites, reports và các API Admin khác ngoài danh sách trên vẫn cần triển khai controller/module nghiệp vụ. Socket.IO cũng chưa có gateway nghiệp vụ trong AppModule. Hồ sơ cá nhân, danh mục, hồ sơ Owner, search/map, Court/giá và cấu hình nhận tiền/chính sách/ảnh Venue đã được ghép; kiểm thử khởi động cơ bản không thay thế nghiệm thu đầy đủ từng issue.

Guards và OwnershipService đã có là nền tảng phân quyền, không phải các endpoint độc lập. Các route kiểm thử trong `scripts/` không nằm trong danh sách API chạy thật.

## Nguồn đối chiếu

- [Bootstrap và prefix](../apps/api/src/main.ts), [AppModule](../apps/api/src/app.module.ts)
- [Auth và Users controller](../apps/api/src/modules/auth/auth.controller.ts), [AuthService](../apps/api/src/modules/auth/auth.service.ts)
- [Cookie và rate limit](../apps/api/src/modules/auth/auth-http.ts), [JWT](../apps/api/src/modules/auth/auth-jwt.service.ts), [HTTP security](../apps/api/src/config/http-security.ts)
- [Health](../apps/api/src/modules/health/health.service.ts), [schema input](../packages/shared/src/schemas.ts), [shared types](../packages/shared/src/types.ts)
- [API contract dự kiến](11-api-contract.md), [lộ trình BE](backend-roadmap.md)
