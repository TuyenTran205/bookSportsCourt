# Tổng hợp API đã triển khai

> **Phiên bản:** 1.15.1 | **Cập nhật lần cuối:** 2026-11-08

## Phạm vi

Danh sách Auth/Users/Health/Venue CRUD dưới đây ghi nhận mốc 16 endpoint BSC-014. Sau tích hợp đã có thêm Catalogs/Courts/Owner applications/Venue extensions; Swagger runtime là nơi tra cứu toàn bộ route hiện tại. Bước 3 Phase 4 bổ sung API audit Admin bên dưới, đã kiểm thử HTTP/PostgreSQL; không phải xác nhận deploy/CI/PR.

- Base URL local mặc định: `http://localhost:3001/api/v1` (port theo cấu hình).
- Body JSON, riêng POST proof dùng multipart/form-data; tên trường camelCase. Xác thực bằng cookie httpOnly, không bằng Bearer header.
- Swagger UI: `/api/docs`, chỉ bật ở development/staging.
- Response thành công có body được bọc `{ "data": ... }`; HTTP 204 không có body.
- Lỗi: `{ "error": { "code": "...", "message": "...", "httpStatus": 400, "details": {} } }`; `details` tuỳ chọn.

## Nghiệm thu Bước15 và snapshot Phase4

Runtime OpenAPI candidate chứa24 paths/25 operations đã tồn tại; report không còn chênh lệch metadata trong phạm vi kiểm tra, còn pending refund. Bộ Postman và bằng chứng backend275/275/shared14/14/typecheck/compiler build ở Bước15. Chưa gọi OpenAPI-3 final, lint/remote CI/Phase2/Gateway/provider/FE còn mở. PATCH /owner/payments/:id/refund chỉ có thiết kế, không được ghi thành API đã triển khai.

## Khôi phục mật khẩu – BSC-076

POST /auth/forgot-password và POST /auth/reset-password dùng lại API hiện có. Forgot 204 rỗng trước DB/provider, không tiết lộ tài khoản; invalid input400, rate/cap429. Reset token SHA-256/hạn1 giờ/một lần; invalid/expired/used/inactive/OAuth-only401; thành công204 xoá cookie và thu hồi mọi phiên trong cùng transaction, lỗi DB chung500. Auth limiter chung10/IP/5 phút, tối đa100 forgot đang chờ/process. Code và 14 test HTTP/PostgreSQL đạt. Smoke AuthMail/Resend thật tới inbox đã được người dùng xác nhận; token smoke không có hiệu lực với tài khoản thật. FE/reset end-to-end còn chờ, chưa đóng toàn bộ issue.

## Google OAuth – BSC-047

| Method | Endpoint (/api/v1) | Hành vi |
|---|---|---|
| GET | /auth/google | Không query; tạo state/binding/nonce10 phút và PKCE, binding cookie httpOnly/Lax;302 tới Google; chưa cấu hình503 |
| GET | /auth/google/callback | state + code XOR error và metadata hữu hạn theo shared; xác minh RS256/JWKS/claims tại BE;302 root frontend allowlist, app tokens chỉ trong cookie |

Không auto-link theo email; trùng email chưa liên kết409, provider đã liên kết đọc role/status/version DB, user mới chỉ Customer. State tiêu thụ trước network, code lỗi/deny cần bắt đầu lại; invalid state400, token401, email/status403, provider503. No-store/no-referrer; rate guard429, PKCE mã hoá key riêng, user/account/refresh nguyên tử. Code, test và cấu hình/smoke còn thiếu. Chưa thử Google Cloud/account thật; không có explicit account linking trong MVP.

## Đánh giá – BSC-046/072

| Method | Endpoint (/api/v1) | Hành vi |
|---|---|---|
| POST | /reviews | Customer active; strict bookingId/rating1–5/comment?; chỉ completed đúng chủ; 201 ReviewAdmin, 422 REVIEW_NOT_ALLOWED, 409 ALREADY_EXISTS |
| GET | /venues/:id/reviews | Public UUID Venue approved/chưa xoá; chỉ visible, page/limit; 200 ReviewPublic[]+meta, không có dữ liệu định danh Customer/booking |
| GET | /admin/reviews | Admin active; venueId/isVisible/page/limit strict, gồm review ẩn; 200 ReviewAdmin[]+meta |
| PATCH | /reviews/:id/visibility | Chỉ Admin, body isVisible boolean; 200 ReviewAdmin, retry cùng giá trị no-op, audit/cache nguyên tử |

Cookie auth cho private, no-store tất cả response. BE suy venue/customer, map comment→content/null; Venue UPDATE lock trước mutation, trigger tính visible average2 chữ số/count. Owner không ẩn/hiện; Owner list/reply BSC-067 chưa có trong lượt này. Code/test/FE handoff; Swagger/OpenAPI thiết kế0.7.0, chưa phải nghiệm thu toàn Phase4 hoặc FE.

## Booking và thống kê Admin – BSC-068/069

Email background BSC-045 đã có MailTransport dùng chung Auth, worker email outbox và cron reminder BSC-078. Không thêm HTTP endpoint; mặc định BUSINESS_MAIL_ENABLED=false. Migration0010 local và test PostgreSQL/transport giả đã có; chưa gửi Resend thật hoặc nghiệm thu consumer realtime/hold Phase2. Giải thích và subtask notifications.

| Method | Endpoint (/api/v1) | Hành vi |
|---|---|---|
| GET | /admin/bookings | Admin active; status/venueId/customerId/from/to/page/limit strict; ngày Việt Nam lọc start; 200 BookingAdmin[]+meta, lịch sử qua Venue/Court xoá mềm |
| GET | /admin/stats | Admin active; from/to/groupBy day/week/month; 200 AdminStats, booking/population/thu/hoàn/series/data quality theo contract |

Hai response no-store, shared projection/nullability. Ngày inclusive≤366, mặc định tháng Việt Nam; snapshot count/series nhất quán. Gross theo payment.amount/paidAt, refund theo refundAmount/refundedAt, gồm cash, không dùng tổng giá booking; net âm hợp lệ. Population và legacy excludedPaymentCount toàn cục; không bịa dữ liệu thiếu. Guest401, sai role403, query400, unsafe integer503. Giải thích code và kiểm thử. Migration0009 thêm ba index, đã áp dụng vào DB local; không coi FE Dashboard/Phase2 integration đã nghiệm thu.

## Admin quản lý user – BSC-070, API phục vụ BSC-041

| Method | Endpoint (/api/v1) | Hành vi |
|---|---|---|
| GET | /admin/users | Admin active; role/status/q/page/limit strict, q tìm literal tên/email, list phoneMasked, snapshot count/page |
| GET | /users/:id | Admin active; detail có phone/emailVerifiedAt, không hash/token/sessionVersion/bank/proof; soft-deleted404 |
| PATCH | /users/:id/status | Admin active; strict active/suspended; cấm target Admin; user locks/recheck, audit/status/version/revoke refresh nguyên tử, no-op không ghi lại |

Response200 UserListItem[]+meta hoặc UserAdminDetail, no-store. Suspend khiến token cũ bị chặn, activate không hồi sinh phiên; reset/change-password cũng tăng version. Mutation kiểm tra lại version theo request scope, không chỉ guard/status. Giải thích và kiểm thử Bước 7. Adapter socket đã có, Gateway production và FE BSC-041 chưa nghiệm thu.

## Hồ sơ Owner và Admin duyệt – Phase 4 Bước 6

| Method | Endpoint (/api/v1) | Hành vi đã hoàn thiện |
|---|---|---|
| POST | /owner-applications | Customer active; strict businessName/phone/address/note?/taxCode?; 201 pending, user lock chống submit trùng; rejected gửi lại ID mới |
| GET | /owner-applications/me | Customer/Owner active, no query; 200 hồ sơ mới nhất, chưa có404 |
| GET | /admin/owner-applications | Admin active; strict status/page/limit, mặc định pending/1/20, limit≤100; 200 list/meta, totalPages0 khi rỗng |
| PATCH | /admin/owner-applications/:id | Admin active; strict status/reviewNote, rejected cần note trim1–500; khoá user+hồ sơ, recheck, role/hồ sơ/audit nguyên tử, retry đúng200 no-op |

OwnerApplicationView đủ taxCode/null/timestamp, không applicant/email/avatar/hash/token/giấy tờ; response no-store. Sai role403; target inactive/deleted/sai role khi pending409; quyết định/note terminal khác400; không tồn tại404. Promotion áp dụng quyền Owner qua DB cho phiên hợp lệ hiện có, không đăng nhập hộ applicant. Giải thích code/test. Không coi FE Dashboard BSC-040 hoặc Gateway/sessionVersion đã hoàn thành.

## Payment/proof – BSC-042

| Method | Endpoint (/api/v1) | Hành vi đã triển khai/test độc lập |
|---|---|---|
| GET | /bookings/:id/payment | Customer đúng booking hoặc Owner đúng Venue; 200 PaymentView từ snapshot, URL private300s, no-store; không mở Admin |
| POST | /bookings/:id/payment/proof | Customer đúng chủ, X-Request-Origin; đúng một file JPEG/PNG/WebP5 MiB, decode/chuẩn hoá; 200 lần đầu/thay ảnh, transaction/deadline/orphan/outbox |
| GET/PUT | /owner/venues/:id/payment-account | Dùng lại API đã có; PUT nay bắt buộc X-Request-Origin và body strict ba field tài khoản, không thay snapshot hold cũ |

Sai chủ Customer404, Owner403; role sai403/Guest401; file giả400 UNSUPPORTED_FILE_TYPE, quá lớn413 FILE_TOO_LARGE; hết hold422 HOLD_EXPIRED, hết review409 PAYMENT_REVIEW_EXPIRED, thiếu legacy data409 PAYMENT_DATA_INCOMPLETE. Storage/config lỗi503. Test DB thật không thay nghiệm thu R2 thật/hold/realtime consumer. Giải thích Bước 4.

## Owner duyệt payment và cron – BSC-043

| Method | Endpoint (/api/v1) | Hành vi triển khai |
|---|---|---|
| GET | /owner/payments | Owner active, status mặc định submitted/venueId/page/limit; lọc đúng chủ trước count/page; lịch sử Venue suspended/deleted vẫn đọc được |
| PATCH | /owner/payments/:id/approve | Owner đúng Venue, X-Request-Origin, body bỏ trống hoặc {}; submitted/pending_payment → completed/confirmed trong một transaction; retry hợp lệ200 no-op |
| PATCH | /owner/payments/:id/reject | Owner đúng Venue, X-Request-Origin, reason trim1–500; rejected/cancelled và metadata đồng bộ; retry cùng reason200 no-op |

Cron mỗi5 phút huỷ review quá hạn thành cancelled/cancelled, không refunded. Tất cả dùng chung lock/recheck/deadline/audit/outbox; không gửi email/socket trong transaction. Response200 dùng PaymentView hoặc OwnerPaymentItem + meta; no-store, private proof URL300s. Giải thích code và kiểm thử Bước 5. Nghiệm thu tích hợp hold/realtime/email còn ở cuối Phase 4; refund chưa thuộc các handler này.

## API audit Admin – BSC-071

`GET /api/v1/admin/audit-logs` — cookie Admin active; query actorId/action/entityType/from/to/page/limit strict. Mặc định 30 ngày, timestamp ISO có offset, from inclusive/to exclusive; tối đa 366 ngày, page/limit mặc định 1/20 và limit tối đa100. Trả200 `{data:AuditView[],meta}`, sort createdAt DESC/id DESC, không IP/token/bank/proof/reason text. Guest401, sai role/suspended403, query sai400. Không có route sửa/xoá audit. Giải thích code và test.

## Danh sách Auth và Venue CRUD

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
| POST | `/api/v1/owner-applications` | Customer | `businessName`, `phone`, `address`, `note?`, `taxCode?` | 201, OwnerApplicationView pending |
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

### 6. Bookings & Slots (9 endpoints)
| Method | Endpoint | Xác thực / quyền | Input | Thành công |
|---|---|---|---|---|
| GET | `/api/v1/venues/:id/slots` | Công khai (tuỳ chọn cookie) | Query `date=YYYY-MM-DD` | 200, ma trận slot 30 phút theo ngày (`available/past/blocked/booked/held`, `mine: true/false`, giá) |
| POST | `/api/v1/bookings/hold` | Customer | `CreateHoldInput` (`courtId`, `slots`, `idempotencyKey`, `note?`) | 201 (hoặc 200 nếu idempotent), booking `held` 10 phút + `transferCode` + thông tin ngân hàng |
| GET | `/api/v1/bookings` | Customer | Query `status?`, `page`, `limit` | 200, danh sách booking của khách kèm phân trang |
| GET | `/api/v1/bookings/:id` | Customer (chính chủ) / Owner / Admin | Không có | 200, chi tiết booking (court, venue, customer mask phone, payment) |
| GET | `/api/v1/bookings/:id/cancellation-preview` | Customer / Owner | Không có | 200, xem trước điều kiện huỷ và số tiền cọc được hoàn |
| PATCH | `/api/v1/bookings/:id/cancel` | Customer (chính chủ) / Owner | `CancelBookingInput` (`reason?`) | 200, huỷ booking (cập nhật payments sang `cancelled` hoặc `refunded`) |
| GET | `/api/v1/owner/bookings` | Owner | Query `venueId?`, `courtId?`, `status?`, `from?`, `to?`, `page`, `limit` | 200, danh sách booking tại các sân của chủ sân |
| POST | `/api/v1/owner/bookings/manual` | Owner | `CreateManualBookingInput` (`courtId`, `slots`, `guestName`, `guestPhone`, `note?`) | 201, tạo booking `confirmed`, thanh toán `cash` completed |
| PATCH | `/api/v1/bookings/:id/no-show` | Owner | Không có | 200, đánh dấu khách không đến (sau giờ bắt đầu) |

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

Slots/hold, refund payment, upload ảnh Venue R2, API notifications, Owner review list/reply, favorites, reports và các API Admin khác ngoài danh sách trên vẫn cần triển khai/nghiệm thu nghiệp vụ. Payment GET/proof/Owner approve/reject/cron đã có. Email MVP/cron reminder có worker/test độc lập; consumer realtime, provider email và R2 thật chưa nghiệm thu. Socket.IO chưa có gateway nghiệp vụ trong AppModule. Hồ sơ cá nhân, danh mục, hồ sơ Owner, search/map, Court/giá và cấu hình nhận tiền/chính sách/ảnh Venue đã được ghép; kiểm thử khởi động cơ bản không thay thế nghiệm thu đầy đủ từng issue.

Guards và OwnershipService đã có là nền tảng phân quyền, không phải các endpoint độc lập. Các route kiểm thử trong `scripts/` không nằm trong danh sách API chạy thật.

## Nguồn đối chiếu

- [Bootstrap và prefix](../apps/api/src/main.ts), [AppModule](../apps/api/src/app.module.ts)
- [Auth và Users controller](../apps/api/src/modules/auth/auth.controller.ts), [AuthService](../apps/api/src/modules/auth/auth.service.ts)
- [Cookie và rate limit](../apps/api/src/modules/auth/auth-http.ts), [JWT](../apps/api/src/modules/auth/auth-jwt.service.ts), [HTTP security](../apps/api/src/config/http-security.ts)
- [Health](../apps/api/src/modules/health/health.service.ts), [schema input](../packages/shared/src/schemas.ts), [shared types](../packages/shared/src/types.ts)
- [API contract dự kiến](11-api-contract.md), [lộ trình BE](backend-roadmap.md)
