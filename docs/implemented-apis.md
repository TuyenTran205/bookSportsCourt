# Tổng hợp API đã triển khai

> **Phiên bản:** 1.0.0 | **Cập nhật lần cuối:** 2026-10-29

## Phạm vi

Hiện có **9 endpoint HTTP** trong controller được đăng ký qua AppModule: 7 Auth, 1 Users, 1 Health. Danh sách được đối chiếu mã nguồn; không phải xác nhận đã deploy hoặc kết quả chạy test mới.

- Base URL local mặc định: `http://localhost:3001/api/v1` (port theo cấu hình).
- Body JSON; tên trường camelCase. Xác thực bằng cookie httpOnly, không bằng Bearer header.
- Swagger UI: `/api/docs`, chỉ bật ở development/staging.
- Response thành công có body được bọc `{ "data": ... }`; HTTP 204 không có body.
- Lỗi: `{ "error": { "code": "...", "message": "...", "httpStatus": 400, "details": {} } }`; `details` tuỳ chọn.

## Danh sách đầy đủ

Các đường dẫn dưới đây đã bao gồm prefix `/api/v1`. Các endpoint hiện tại không yêu cầu path parameter hay query parameter.

| Method | Endpoint | Xác thực / quyền | Input | Thành công |
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

Google OAuth, cập nhật hồ sơ/đổi mật khẩu khi đang đăng nhập, danh mục, Owner applications, Venue/Court, giá, slots, booking, thanh toán, upload, notifications, reviews, favorites, reports và Admin vẫn cần triển khai controller/module nghiệp vụ. Socket.IO cũng chưa có gateway nghiệp vụ trong AppModule.

Guards và OwnershipService đã có là nền tảng phân quyền, không phải các endpoint độc lập. Các route kiểm thử trong `scripts/` không nằm trong danh sách API chạy thật.

## Nguồn đối chiếu

- [Bootstrap và prefix](../apps/api/src/main.ts), [AppModule](../apps/api/src/app.module.ts)
- [Auth và Users controller](../apps/api/src/modules/auth/auth.controller.ts), [AuthService](../apps/api/src/modules/auth/auth.service.ts)
- [Cookie và rate limit](../apps/api/src/modules/auth/auth-http.ts), [JWT](../apps/api/src/modules/auth/auth-jwt.service.ts), [HTTP security](../apps/api/src/config/http-security.ts)
- [Health](../apps/api/src/modules/health/health.service.ts), [schema input](../packages/shared/src/schemas.ts), [shared types](../packages/shared/src/types.ts)
- [API contract dự kiến](11-api-contract.md), [lộ trình BE](backend-roadmap.md)
