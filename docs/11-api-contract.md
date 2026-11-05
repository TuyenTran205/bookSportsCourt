# 11 – Hợp đồng API

> **Phiên bản:** 1.9.0 | **Cập nhật lần cuối:** 2026-10-31
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
| 400 | `INVALID_STATUS_TRANSITION` | Chuyển trạng thái booking hoặc Venue không hợp lệ |
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
| 409 | `ALREADY_EXISTS` | Trùng giá trị duy nhất (ID/slug Venue, slug danh mục, đánh giá của một booking, hồ sơ chủ sân đang chờ duyệt) |
| 409 | `RESOURCE_IN_USE` | Danh mục đang dùng hoặc Venue còn booking held/pending_payment/confirmed |
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
PATCH  /api/v1/venues/:id/status      [Admin] Duyệt/từ chối/đình chỉ/đưa lại hàng đợi (body: status, reason?)
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

> **Quy ước tham số đường dẫn (áp dụng toàn bộ API):**
> - **`:id`** – id của tài nguyên được **nêu tên ở segment ngay trước**: `/venues/:id`, `/bookings/:id`, `/reviews/:id`, `/payments/:id`. Vì vậy các route con của venue cũng dùng `:id`: `/venues/:id/slots`, `/venues/:id/courts`, `/venues/:id/reviews`.
> - **`:venueId`** – id venue khi nó xuất hiện dưới một segment **không** tên là `venues`: `/favorites/:venueId`, query `?venueId=`.
> - **`:slug`** – chỉ dùng ở `GET /venues/:slug`, URL SEO công khai (chấp nhận cả slug lẫn UUID). Response trả kèm `id` để FE dùng UUID cho các lời gọi tiếp theo.
>
> Trước đây tài liệu trộn `:slug`, `:id` và `:venueId` cho cùng một tài nguyên venue.

#### Quy tắc Venue đã chốt — BSC-014 (2026-10-30)

Đây là hợp đồng cho bảy endpoint đã có handler và kiểm thử HTTP/PostgreSQL ngày 2026-10-31. OpenAPI riêng: [bsc-014.openapi.json](openapi/bsc-014.openapi.json). Giải thích quyết định: [Bước 2](bsc-014-step-02-business-rules.md); POST: [Bước 5](bsc-014-step-05-create-venue.md); đọc: [Bước 6](bsc-014-step-06-read-venues.md); sửa/xoá: [Bước 7](bsc-014-step-07-update-and-delete.md); Admin status: [Bước 8](bsc-014-step-08-admin-moderation.md). Chưa xác nhận deploy/CI/PR.

**Quyền và thứ tự kiểm tra**

- Create/update/delete và owner list chỉ Owner; duyệt và admin list chỉ Admin. Admin không bypass route Owner.
- Role lấy từ user đang hoạt động trong DB. Customer có hồ sơ Owner pending vẫn là Customer → 403 FORBIDDEN; không thêm cờ owner-approved. OWNER_NOT_APPROVED không phát sinh ở bảy route này.
- Mutation kiểm tra theo thứ tự: auth/role → UUID và tài nguyên chưa xoá/ownership → body → nghiệp vụ; kiểm tra lại tài khoản/quyền trong transaction. Route public không xác thực để mở rộng phạm vi.
- Venue đã xoá hoặc không tồn tại → 404 NOT_FOUND (kể cả DELETE lặp, Admin duyệt và PATCH). DELETE lặp bởi Owner khác cũng 404; Venue còn sống khác chủ → 403 NOT_VENUE_OWNER.

**Input, output và pagination**

- DTO aliases, query schema Owner/Admin, ZodValidationPipe và metadata Swagger trong `apps/api/src/modules/venues/dto` đã gắn vào controller/service thật ở Bước 5–7. Bước 4 có test contract riêng; các bước sau bổ sung HTTP/PostgreSQL thật.
- Query page/limit nhận JSON number nguyên dương an toàn hoặc chuỗi chỉ chứa chữ số 0–9; không nhận chuỗi rỗng, khoảng trắng, số mũ, số thập phân, boolean, array/object (kể cả query lặp). page tối đa Number.MAX_SAFE_INTEGER; limit tối đa 100. Schema query strict, status chỉ có ở Admin. q sau trim rỗng giữ "" và repository hiểu là không lọc. Đây là quy tắc parse chung dùng khi viết DTO/Swagger/test.

- POST: name trim 2–200, address trim 5–500, description tùy chọn tối đa 5000, provinceId/districtId UUID bắt buộc, lat/lng JSON number hữu hạn bắt buộc trong [-90,90]/[-180,180]; sportIds/amenityIds mặc định [].
- PATCH: chỉ các trường POST, tất cả tùy chọn; object phải có ít nhất một field. Mảng không gửi giữ nguyên, [] xoá liên kết; loại ID trùng trước ghi. Field ngoài allowlist (ownerId/status/slug/cache/deletedAt/coverUrl...) → 400 VALIDATION_ERROR. Không nhận null cho field input; description="" bỏ nội dung.
- Tỉnh/quận và danh mục phải tồn tại; quận thuộc tỉnh, đúng type; PATCH validate cặp cuối sau ghép dữ liệu. Toạ độ chuẩn hoá 7 chữ số thập phân trước so sánh/lưu; không ép null hoặc chuỗi rỗng thành 0.
- POST trả 201; PATCH/update-status và các GET trả 200; DELETE đầu tiên thành công trả 204 không body.
- Owner list: page/limit. Admin list: status/q/page/limit, status mặc định pending, q trim tối đa 200 ký tự tìm chuỗi con trong name không phân biệt hoa thường (không bỏ dấu), rỗng = không lọc. Không hỗ trợ status=all. Hai danh sách chỉ lấy deleted_at IS NULL; page mặc định 1, limit 20, tối đa 100; số nguyên dương; query lạ/sai → 400. Sort created_at DESC, id DESC.
- Response danh sách { data: [], meta: { page, limit, total, totalPages } }; totalPages=ceil(total/limit), total=0 thì totalPages=0. Trang vượt cuối trả [] nhưng giữ total/totalPages thực tế.

**Lý do từ chối**

- Body status chỉ nhận { status, reason? }. status thuộc approved/rejected/suspended/pending; phép chuyển phụ thuộc bảng bên dưới.
- reason bắt buộc chỉ khi đích rejected: trim, 1–500 ký tự; status khác không được gửi reason (kể cả null).
- Lưu venues.rejection_reason nullable, response riêng trả rejectionReason. Khi rời rejected qua gửi lại → pending, xoá reason. Approve cũng đặt null. Từ chối lặp chỉ 200 khi reason đã chuẩn hoá trùng reason đang lưu; reason khác → 400 INVALID_STATUS_TRANSITION.
- Dữ liệu rejected cũ chưa có lý do giữ null, không bịa lý do bằng migration. Khi Admin gửi rejected có reason cho hàng legacy rejected/null, cho phép bổ sung reason một lần và updatedAt thay đổi.
- Cột chỉ lưu lý do hiện tại, không phải lịch sử kiểm duyệt. Public tuyệt đối không trả rejectionReason.
- Audit BSC-014: thay đổi thực tế của Admin status (kể cả bổ sung legacy reason) ghi một `venue.status_changed` vào audit_logs cùng transaction. oldData/newData chỉ có status/hasRejectionReason; không lưu nội dung reason hoặc token/PII. No-op/thất bại không tạo log; lỗi audit rollback cả mutation. Middleware audit chung, API xem và retention thuộc phạm vi sau; xem AC-13/Bước 8.

**Máy trạng thái và gọi lại**

| Người gọi / thao tác | Trạng thái trước | Trạng thái sau | Kết quả |
|---|---|---|---|
| Owner tạo | Chưa có | pending | 201 |
| Admin status=approved | pending | approved | 200, reason=null |
| Admin status=rejected | pending | rejected | 200, lưu reason |
| Admin status=suspended | approved | suspended | 200, ngừng nhận đặt mới |
| Admin status=pending | suspended | pending | 200, đưa lại hàng đợi; cần duyệt lại mới công khai |
| Admin gửi đúng trạng thái hiện tại | approved/rejected/suspended/pending | Không đổi | 200 no-op; riêng rejected theo quy tắc reason phía trên |
| Owner PATCH có thay đổi thực tế | rejected/approved | pending | 200, reason=null |
| Owner PATCH có thay đổi thực tế | pending | pending | 200 |
| Owner PATCH có thay đổi thực tế | suspended | suspended | 200; Owner không tự gỡ đình chỉ |
| Owner PATCH không thay đổi thực tế | Bất kỳ trạng thái còn sống | Giữ nguyên | 200, không đổi updatedAt/reason |
| Mọi chuyển tiếp Admin khác | Bất kỳ | Không đổi | 400 INVALID_STATUS_TRANSITION |

- Owner gửi lại hồ sơ rejected bằng PATCH sửa ít nhất một giá trị thực tế, không nhận status trong PATCH và không có endpoint resubmit riêng.
- Mọi thay đổi thực tế ở name, description, address, provinceId, districtId, lat, lng, tập sportIds/amenityIds trên approved đều về pending. So sánh sau trim/chuẩn hoá toạ độ; so sánh mảng như tập hợp đã loại trùng (đổi thứ tự không tính thay đổi). PATCH description="" lưu chuỗi rỗng; null legacy khác chuỗi rỗng.
- Thay đổi do hệ thống ở ratingAvg/reviewCount/fromPrice không làm duyệt lại. Ảnh ngoài BSC-014: khi triển khai ghi ảnh phải áp dụng cùng nguyên tắc duyệt lại nếu nội dung ảnh thực sự thay đổi; không cho bypass kiểm duyệt qua coverUrl.
- Venue pending/rejected/suspended không công khai và không nhận hold/manual booking mới. Booking/payment có sẵn tiếp tục vòng đời bình thường; không tự huỷ, đổi giá hoặc hoàn tiền khi cơ sở bị sửa/đình chỉ. Đây là yêu cầu tích hợp Phase 2/3, chưa phải code đã có.

**Slug**

- Sinh một lần: base + "-" + toàn bộ UUID v7 của Venue dạng lowercase, giữ dấu gạch UUID. Base: trim, lowercase, NFD, bỏ combining marks, đổi đ→d, thay mỗi nhóm ký tự ngoài a-z0-9 bằng "-", bỏ "-" ở hai đầu, lấy tối đa 80 ký tự và bỏ "-" cuối; rỗng dùng "venue".
- Hai Venue cùng tên có UUID khác nên slug khác. Đổi tên không đổi slug; client không gửi slug. UUID public lookup ưu tiên khi path là UUID hợp lệ; nếu không thì tra exact slug.
- UNIQUE DB vẫn bảo vệ cuối cùng; vi phạm unique slug/ID trả 409 ALREADY_EXISTS, rollback toàn bộ; không dùng SELECT-trước-INSERT để chứng minh không trùng, không retry vô hạn.
- Slug của Venue đã xoá không tái sử dụng.

**Xoá mềm và cạnh tranh**

- Đúng Owner có thể xoá ở mọi trạng thái nếu không còn booking thuộc các Court của Venue ở held/pending_payment/confirmed, kể cả Court đã xoá mềm hoặc hold đã quá giờ nhưng cron chưa đổi trạng thái. Không tự expire booking trong DELETE.
- Có bất kỳ booking ở ba trạng thái đó → 409 RESOURCE_IN_USE. Không phụ thuộc start/end; booking đã hết giờ nhưng còn confirmed vẫn chặn cho tới khi vòng đời hoàn tất.
- Court active mà không còn booking chặn thì không cản xoá. Chỉ đặt venues.deleted_at/updated_at; giữ Court, liên kết, booking/payment và status/reason hiện tại, không cascade, không restore API.
- API public/ghi mới dưới Venue phải kiểm tra cha chưa xoá. Lịch sử booking của Customer/Owner và xử lý payment vẫn truy cập theo quyền booking qua JOIN không loại bỏ lịch sử chỉ vì Venue bị xoá.
- Transaction ghi Venue: khoá user để kiểm tra quyền, khoá Venue FOR UPDATE trước khi dùng assertOwnership(..., tx), rồi kiểm tra trạng thái/booking và ghi. Không nâng từ FOR SHARE của OwnershipService lên FOR UPDATE sau khi nhiều request cùng giữ SHARE (tránh deadlock nâng khoá).
- Luồng tạo hold/manual booking tương lai phải khoá user rồi Venue FOR SHARE, kiểm tra approved/chưa xoá trước khi ghi booking; luồng xoá/duyệt dùng FOR UPDATE trên cùng hàng. Như vậy nếu booking commit trước DELETE sẽ thấy và chặn; DELETE commit trước thì booking bị từ chối. EXCLUDE chống trùng lịch vẫn giữ nguyên.
- Hai Admin approve/reject cạnh tranh: khoá Venue tuần tự; request sau đọc trạng thái mới, kết quả theo bảng (khác đích bị 400, cùng đích hợp lệ 200 no-op). Mọi lỗi phải rollback, không emit trước commit.

**Projection và nullability**

- Public list/detail/map chỉ approved chưa xoá. Không có quyền đặc biệt cho Owner/Admin trên route public.
- VenueListItem: id, name, slug, address, province, district, lat, lng, status, coverUrl, ratingAvg, reviewCount, fromPrice, sports.
- VenueDetail thêm ownerId (ID công khai theo shared hiện tại, không hồ sơ user), description, provinceId, districtId, images, amenities, courts, cancellationPolicy. Không trả rejectionReason/createdAt/updatedAt/deletedAt, email, điện thoại chủ sân, tài khoản ngân hàng. Courts chỉ chưa xoá; images sắp sortOrder rồi id; mảng rỗng hợp lệ.
- OwnerVenueResponse và AdminVenueResponse có cùng allowlist: id, ownerId, slug, name, description, address, provinceId, districtId, lat, lng, sportIds, amenityIds, status, rejectionReason, createdAt, updatedAt. Admin list trả đầy đủ trường này để duyệt pending; không gọi public detail để xem pending.
- description/rejectionReason/lat/lng/coverUrl/fromPrice nullable theo schema DB; provinceId/districtId trong detail là UUID không null. ratingAvg/reviewCount luôn number, mặc định 0. Phản hồi numeric DB dưới dạng number, giữ null trước khi Number(...).
- VenueMapPoint bỏ Venue thiếu lat hoặc lng (không đặt ghim 0,0); lat/lng của point không null, fromPrice vẫn nullable. Đây là yêu cầu BSC-017/map.
- Request không nhận null cho toạ độ nhưng response có thể null cho dữ liệu legacy; không backfill dữ liệu giả.

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
GET    /api/v1/owner/bookings            [Owner] Xem bookings của venue mình (query: venueId, courtId, status, from, to, page, limit)
POST   /api/v1/owner/bookings/manual     [Owner] Tạo booking thủ công (body: courtId, start, end, customerId hoặc guestName + guestPhone); tạo thẳng `confirmed`, thanh toán `cash`
```

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
