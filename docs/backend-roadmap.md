# Lộ trình triển khai Backend BookSportsCourt

> **Phiên bản:** 1.2.0 | **Cập nhật lần cuối:** 2026-10-29

## Checklist theo dõi tiến độ BE

Đổi `- [ ]` thành `- [x]` khi hoàn thành phần BE của mục tương ứng. Với issue gồm cả API và FE, dấu tick ở đây chỉ theo dõi BE, không thay thế trạng thái issue/PR. Auth, refresh và phân quyền được đánh dấu theo xác nhận của bạn trong phiên làm việc; các mục khác chưa tick có thể đã có một phần code nhưng chưa được xác nhận hoàn thành. Khi cập nhật, có thể ghi thêm `— PR: …; kiểm thử: …; ngày: …` vào cuối dòng.

### Phase 0 – Nền tảng

- [ ] BSC-001, 003 — Monorepo và NestJS chạy được.
- [ ] BSC-004 — Shared types và validation schema.
- [ ] BSC-005, 006 — Lint, typecheck, test/build và CI.
- [ ] BSC-007, 008 — PostgreSQL local, Drizzle, migration chạy được trên DB mới.
- [ ] Cấu hình env, response/error chung và Swagger theo docs/10.

### Phase 1 – Auth, Venue, Search

- [ ] BSC-010, 053–058 — Kiểm chứng schema nền và các bảng bổ sung Phase 1.
- [x] BSC-011 — Auth đăng ký, đăng nhập, đăng xuất.
- [x] BSC-012 — Refresh token xoay vòng, revoke và xử lý reuse.
- [x] BSC-013 — JWT Guard, RolesGuard, OwnershipGuard và kiểm tra quyền sở hữu.
- [ ] BSC-014 — Venue CRUD và Admin duyệt Venue.
- [ ] BSC-015 — Court CRUD, giờ mở cửa và quy tắc giá.
- [ ] BSC-016 — Sports, Amenities, Areas: public read và Admin CRUD.
- [ ] BSC-017 — Tìm kiếm/lọc/phân trang Venue.
- [ ] BSC-062 — API đăng ký và xem hồ sơ chủ sân.
- [ ] BSC-063 — API xem và chỉnh sửa hồ sơ cá nhân (GET me đã có).
- [ ] BSC-073 — Nghiệm thu Health API và tình huống DB không sẵn sàng.
- [ ] BSC-074 — Upload R2 presigned URL.
- [ ] BSC-075 — Hoàn thiện rate limit theo phạm vi issue (auth đã có limiter).
- [ ] Nghiệm thu Phase 1 và chốt OpenAPI-1.

### Phase 2 – Booking và realtime

- [ ] BSC-023, 059–061 — Kiểm chứng schema booking/payment, các bảng bổ sung, EXCLUDE và trigger.
- [ ] BSC-024 — Hold trong transaction, giá/cọc do BE tính, idempotency và hạn mức.
- [ ] BSC-025 — Cron expire hold, đồng bộ payment.
- [ ] BSC-026 — Realtime Socket.IO, quyền join room và emit sau commit.
- [ ] BSC-027 — Slots API theo ngày.
- [ ] BSC-028 — Huỷ và chuyển trạng thái booking (P1).
- [ ] BSC-029 — Test đồng thời chống trùng lịch.
- [ ] BSC-064 — Favorites API (P1).
- [ ] BSC-077 — Cron auto-complete booking.
- [ ] BSC-078 — Cron nhắc lịch trước 24 giờ (P1).
- [ ] Chốt OpenAPI-2 theo mốc giữa Phase 2.
- [ ] Nghiệm thu Phase 2: hold, expire, slots, realtime và race condition.

### Phase 3 – Vận hành Owner

- [ ] BSC-036 — Booking thủ công, payment cash và chống trùng lịch.
- [ ] BSC-038 — Blackout: khoá/mở sân, kiểm tra quyền và cạnh tranh với booking.
- [ ] BSC-039 — Báo cáo doanh thu API (P1).
- [ ] BSC-065 — Chính sách huỷ/cọc và áp dụng tại BE (P1).
- [ ] BSC-066 — Báo cáo tỷ lệ lấp đầy API (P1).
- [ ] BSC-067 — Owner phản hồi/quản lý đánh giá theo quyền đã thống nhất (P1).
- [ ] Nghiệm thu phần BE phục vụ vận hành Owner.

### Phase 4 – Thanh toán, Admin, email

- [ ] BSC-042 — Thông tin chuyển khoản và nhận bằng chứng thanh toán.
- [ ] BSC-043 — Owner duyệt/từ chối idempotent, cron huỷ quá hạn.
- [ ] API Admin duyệt/từ chối hồ sơ Owner, phục vụ BSC-040.
- [ ] BSC-068 — Admin xem/lọc toàn bộ booking.
- [ ] BSC-069 — Thống kê toàn hệ thống.
- [ ] BSC-070 — Admin khoá/mở khoá tài khoản.
- [ ] BSC-071 — Ghi vết hành động và API audit log.
- [ ] BSC-045 — Email nghiệp vụ booking (P1).
- [ ] BSC-046 — Khách đánh giá sân sau booking completed (P1).
- [ ] BSC-047 — Google OAuth (P1).
- [ ] BSC-072 — Admin kiểm duyệt đánh giá (P1).
- [ ] BSC-076 — Nghiệm thu BE quên/đặt lại mật khẩu và gửi email (API đã có, P1).
- [ ] Nghiệm thu vòng đời booking/payment và chốt OpenAPI-3 cuối Phase 4.

### Các API trong contract chưa có issue BE riêng

Các mục này cần được gắn vào issue/Phase khi lập kế hoạch; không mặc định thuộc Phase 4 vì được đặt bên dưới Phase 4 trong checklist.

- [ ] API quản lý tài khoản nhận tiền Venue; dữ liệu hợp lệ phải sẵn sàng khi thử hold.
- [ ] API danh sách/chi tiết booking của khách, phục vụ BSC-033 ở Phase 2.
- [ ] API OwnerTimeline, phục vụ BSC-034 ở Phase 3.
- [ ] API Owner đánh dấu no-show đúng điều kiện chuyển trạng thái.
- [ ] Notifications trong app: danh sách, unread count, đọc một/tất cả và tạo thông báo nghiệp vụ.

### Phase 5 – Kiểm thử, triển khai, demo

- [ ] BSC-081 — Staging sẵn sàng trước nghiệm thu/production.
- [ ] BSC-048 — Phối hợp E2E toàn luồng với FE.
- [ ] Demo hai trình duyệt: tranh slot, realtime và kiểm tra quyền.
- [ ] BSC-050 — Deploy BE, cấu hình env/CORS/cookie, migration và health.
- [ ] BSC-051 — Seed dữ liệu demo.
- [ ] BSC-052 — Giám sát lỗi BE bằng Sentry (P1).
- [ ] BSC-079 — Cron cleanup dữ liệu hết hạn (P1).
- [ ] Chốt OpenAPI, hướng dẫn chạy/deploy và bằng chứng kiểm thử cho báo cáo.

### Phase 6 – Tuỳ chọn sau nộp bài

- [ ] Kiểm chứng API dùng lại được cho ứng dụng Mobile nếu nhóm triển khai Phase 6.

## 1. Sau auth và phân quyền nên làm gì?

**Theo thứ tự liệt kê trong backlog, công việc tiếp theo sau BSC-013 là BSC-014: Venue CRUD API (Owner tạo, Admin duyệt).** BSC-016 (Sports, Amenities, Areas) cũng chỉ phụ thuộc BSC-013, nên không có quy định bắt buộc phải làm BSC-016 trước BSC-014. Khuyến nghị làm danh mục trước trong bản cũ là lựa chọn triển khai, không phải thứ tự bắt buộc của tài liệu.

Các nhánh phụ thuộc chính được ghi trong [16-backlog.md](16-backlog.md):

```text
BSC-011 Auth → BSC-012 Refresh → BSC-013 Phân quyền
                                  ├─ BSC-014 Venue → BSC-015 Court/giờ/giá
                                  │                └→ BSC-017 Search
                                  └─ BSC-016 Danh mục

BSC-010 Schema nền → BSC-023 Schema booking → BSC-024 Hold
                                               ├─ BSC-025–029 Cron/realtime/slots/huỷ/test
                                               ├─ BSC-036 Booking thủ công
                                               ├─ BSC-042 Payment → BSC-043 Duyệt/từ chối
                                               └─ BSC-077–078 Auto-complete/nhắc lịch
```

Sơ đồ thể hiện phụ thuộc ghi trong backlog, không thay thế điều kiện nghiệp vụ: hold vẫn cần giờ mở cửa, giá và tài khoản nhận tiền hợp lệ theo docs/05. Thanh toán QR là **P0**, nằm ở Phase 4 và bắt buộc để đóng vòng đời MVP.

### Tổng quan Phase theo docs/15

| Phase | Tuần dự kiến | Milestone | Phạm vi BE |
|---|---|---|---|
| 0 | 1–2 | `phase-0-setup` | NestJS, shared, PostgreSQL, Drizzle, CI, env |
| 1 | 3–4 | `phase-1-auth-venue` | Auth, phân quyền, Venue/Court, giờ/giá, danh mục, search và các issue bổ sung phase:1 |
| 2 | 5–7 | `phase-2-booking-realtime` | Hold, slots, cron, realtime, chống trùng và các issue bổ sung phase:2 |
| 3 | 8 | `phase-3-owner` | Timeline, booking thủ công, blackout, chính sách và báo cáo Owner |
| 4 | 9–10 | `phase-4-admin-payment` | Admin, thanh toán, email, đánh giá, OAuth |
| 5 | 11–12 | `phase-5-finalize` | Staging, E2E, deploy, seed, giám sát và báo cáo |
| 6 | Sau nộp bài | `phase-6-mobile` | Tuỳ chọn; Mobile tái sử dụng API |

Tuần là giả định kế hoạch 12 tuần, không phải lịch tính từ hôm nay. P0/P1 và Phase của từng mã dưới đây lấy từ docs/16; các đầu việc chỉ có trong API contract được ghi riêng, không tự gán mã issue. Phân quyền tiếp tục dùng ba role cố định và ownership theo docs/06; không có yêu cầu bổ sung hệ thống permission động.

## 2. Hiện trạng kiểm tra trong mã nguồn

| Phần | Hiện trạng | Việc tiếp theo |
|---|---|---|
| NestJS, cấu hình, response/error, Swagger | Đã có bootstrap và hạ tầng HTTP | Tái sử dụng cho module mới |
| Database | Đã có migration `0001`–`0006`, gồm bảng nghiệp vụ, EXCLUDE và trigger | Đối chiếu schema, chạy kiểm chứng DB; chỉ thêm migration khi thực sự thiếu |
| Auth email/password | Đã có register, login, refresh, logout, forgot/reset password, verify email | Duy trì kiểm thử khi tích hợp module mới |
| Hồ sơ hiện tại | Đã có `GET /api/v1/users/me` | Chưa có API cập nhật hồ sơ |
| Phân quyền | Đã có JwtAuthGuard, RolesGuard, OwnershipGuard và OwnershipService | Áp dụng và kiểm thử trên từng endpoint nghiệp vụ mới |
| Health | Đã có `GET /api/v1/health`, kiểm tra `SELECT 1` | Dùng trong vận hành |
| Module nghiệp vụ còn lại | Chưa có controller được đăng ký trong AppModule | Triển khai theo các Phase bên dưới |

“Đã có” ở đây là có mã nguồn trong workspace tại ngày cập nhật; không đồng nghĩa đã deploy hoặc vừa được chạy lại toàn bộ test. Danh sách endpoint thực tế nằm trong [implemented-apis.md](implemented-apis.md). Thư mục `.gitkeep`, type/schema shared và controller chỉ dùng trong test không được tính là API đã triển khai.

## 3. Phase 0 – Nền tảng BE

**Mục tiêu:** API chạy được, kết nối PostgreSQL, có migration và kiểm tra chất lượng tự động.

| Công việc | Backlog liên quan | Đầu ra cần có |
|---|---|---|
| NestJS, shared types/schema, lint/typecheck, CI | BSC-001, 003–006 | Cấu trúc module, cấu hình môi trường, pipeline |
| PostgreSQL local, Drizzle và migration | BSC-007, 008 | DB tái tạo được bằng migration versioned |
| Response/error chung và Swagger | BSC-003, docs/10 | API nhất quán, `/api/docs` ở dev/staging |

**Tiêu chí hoàn thành:** ứng dụng khởi động, migration chạy trên DB mới và các check CI tương ứng đạt. Health được xếp Phase 1 trong backlog. Phần nền tảng đã có trong repo, không cần dựng lại từ đầu.

## 4. Phase 1 – Auth, phân quyền, dữ liệu sân và tìm kiếm

**Mục tiêu:** Owner quản lý được cơ sở/sân con; khách tìm và xem được sân hợp lệ.

| STT tra cứu | Công việc BE | Backlog | Phụ thuộc / lưu ý |
|---|---|---|---|
| 1 | Auth và refresh token | BSC-011, 012 | Đã có; không làm lại |
| 2 | JWT, role, ownership | BSC-013 | Đã có nền tảng; mỗi module vẫn cần test quyền riêng |
| 3 | Danh mục Sports, Amenities, Areas | BSC-016 | Phụ thuộc BSC-013; public read, Admin CRUD; không bắt buộc đứng trước Venue |
| 4 | Gửi/xem hồ sơ Owner, Admin duyệt/từ chối | BSC-062; phần BE phục vụ BSC-040 | Duyệt hồ sơ phải cập nhật quyền trong DB; không tin role client |
| 5 | Tạo, sửa, xoá mềm, xem Venue; Admin duyệt | BSC-014 | Danh mục và Owner hợp lệ; kiểm tra ownership |
| 6 | Upload ảnh qua R2 presigned URL | BSC-074 | Hỗ trợ ảnh Venue; chuẩn bị khả năng dùng cho bằng chứng thanh toán |
| 7 | Court, opening hours, pricing rules | BSC-015 | Venue tồn tại; giá tính tại BE, đơn vị block 30 phút |
| 8 | Chuẩn bị dữ liệu tài khoản nhận tiền Venue | Schema BSC-057 | Schema thuộc Phase 1; API quản lý tài khoản nằm trong contract nhưng chưa có issue/Phase riêng |
| 9 | Search/filter/phân trang và chi tiết Venue | BSC-017, phần API phục vụ BSC-022 | Phụ thuộc dữ liệu sân, môn, khu vực và giá |
| 10 | Cập nhật hồ sơ cá nhân | BSC-063 | GET me đã có; bổ sung phần cập nhật theo contract |
| 11 | Hoàn thiện giới hạn request | BSC-075 | Hiện auth có limiter in-memory; chưa coi global/hold limiter đã hoàn tất |
| 12 | Health endpoint | BSC-073 | P0; không auth, kiểm tra DB bằng SELECT 1 |

Schema liên quan: BSC-010, 053–058. Các bảng đã xuất hiện trong migration hiện tại; kiểm tra khả năng đáp ứng trước khi bổ sung.

**Tiêu chí hoàn thành:** tạo được dữ liệu danh mục → Owner → Venue được duyệt → Court có giờ và giá → khách tìm/xem sân. Có test Guest/Customer/Owner/Admin, Owner khác chủ, tài khoản bị khoá và ID không tồn tại. Chốt **OpenAPI-1: Auth, Venues, Courts** kèm các API nền liên quan.

### Phạm vi issue tiếp theo theo backlog: BSC-014

- Đối chiếu mục Venues trong [11-api-contract.md](11-api-contract.md), schema DB và schema shared.
- Triển khai module `venues` với controller mỏng, service và repository; đăng ký vào AppModule.
- Owner tạo/quản lý Venue của mình, Admin duyệt; API đọc công khai tuân thủ điều kiện hiển thị trong contract.
- Chuẩn bị dữ liệu danh mục/Owner hợp lệ để kiểm thử; đây không phải yêu cầu hoàn thành toàn bộ BSC-016/BSC-062 trước khi bắt đầu BSC-014.
- Kiểm thử phân quyền qua HTTP/DB: chưa đăng nhập, sai role, Owner khác chủ, ID không tồn tại và mutation có kiểm tra quyền trong transaction.
- Cập nhật OpenAPI, API contract nếu cần và danh sách API đã triển khai; mở PR về `develop` theo quy trình dự án.

## 5. Phase 2 – Booking và realtime

**Mục tiêu:** trả lịch trống đúng, giữ chỗ an toàn khi nhiều khách đặt đồng thời.

| Công việc BE | Backlog | Yêu cầu chính |
|---|---|---|
| Kiểm chứng schema booking/payment/blackout và constraint | BSC-023, 059–061 | EXCLUDE là tuyến chống trùng cuối cùng; kiểm chứng cả blackout |
| Tính giá và tạo hold | BSC-024 | Validate ở BE; expire hold cũ, tính giá/cọc, tạo booking và payment trong transaction |
| Slots API | BSC-027 | Tính theo ngày, giờ mở cửa, blackout, booking và trạng thái quá khứ |
| Cron expire hold | BSC-025 | Hết 10 phút; đồng bộ trạng thái payment |
| Hạn mức và chống lạm dụng hold | BSC-075, quy tắc docs/06 | Kiểm tra trong transaction để tránh vượt hạn mức khi request đồng thời |
| Socket.IO | BSC-026 | Kiểm tra quyền join room; phát sự kiện sau commit |
| Lịch sử và chi tiết booking của khách | API phục vụ BSC-033 | Chỉ trả booking trong phạm vi người gọi |
| Chuyển trạng thái và huỷ theo chính sách | BSC-028, 065 | Huỷ theo chính sách là P1; máy trạng thái nền là cần thiết cho luồng P0 |
| Auto-complete | BSC-077 | `confirmed → completed` sau giờ kết thúc và khoảng đệm quy định |
| Test đồng thời | BSC-029 | N request tranh cùng slot, idempotency, rollback và cạnh tranh với cron |
| Yêu thích sân | BSC-064, P1 | Theo người dùng; phụ thuộc BSC-059 |
| Cron nhắc lịch trước 24 giờ | BSC-078, P1 | Phase 2 theo backlog; phối hợp email BSC-045 ở Phase 4 |

**Điều kiện trước hold:** Court có giờ/giá hợp lệ, Venue có tài khoản nhận tiền, chính sách cọc có mặc định theo thiết kế. Không nhận giá thanh toán từ client.

**Tiêu chí hoàn thành:** request cạnh tranh không tạo hai booking chiếm cùng slot; hold hết hạn được giải phóng; booking/payment nhất quán; realtime không lộ thông tin riêng. Chốt **OpenAPI-2: Bookings và Slots**. Hoàn thành Phase này mới có giữ chỗ, chưa đủ luồng thanh toán MVP.

## 6. Phase 3 – Vận hành cho Owner

| Công việc BE | Backlog | Yêu cầu chính |
|---|---|---|
| API OwnerTimeline | API phục vụ BSC-034 | Lấy court, booking, hold, blackout và giờ mở cửa theo venue/ngày |
| Booking thủ công | BSC-036 | Owner đúng chủ; `source=manual`, booking confirmed, payment cash; vẫn chống trùng |
| Khoá/mở sân bảo trì | BSC-038 | Không đè booking đang hoạt động; test cạnh tranh với tạo booking |
| Chính sách huỷ và cọc | BSC-065, P1 | Cấu hình Owner, áp dụng tại BE, hoàn tiền thủ công theo thiết kế |
| Doanh thu và tỷ lệ lấp đầy | BSC-039, 066, P1 | Phạm vi Venue của Owner; cần dữ liệu trạng thái booking/payment đầy đủ |
| Owner phản hồi/quản lý đánh giá | BSC-067, P1 | Phase 3 theo backlog; quyền ẩn/hiện đang mâu thuẫn với contract, xem mục 9 |

**Tiêu chí hoàn thành:** Owner xem lịch và tạo booking tại quầy, khoá/mở giờ sân mà không gây trùng lịch. Kiểm thử Owner khác chủ và thao tác đồng thời. Báo cáo P1 có thể hoàn thiện sau thanh toán Phase 4.

## 7. Phase 4 – Thanh toán, Admin và thông báo

**Ưu tiên đóng vòng đời P0 trước các tiện ích P1.**

| Công việc BE | Backlog | Mức / yêu cầu |
|---|---|---|
| Thông tin chuyển khoản và nhận ảnh xác nhận | BSC-042 | P0; FE dựng QR, BE tính tiền và kiểm tra quyền/trạng thái/upload |
| Owner duyệt/từ chối payment, cron quá hạn | BSC-043 | P0; idempotent; cập nhật booking/payment cùng transaction |
| Owner đánh dấu no-show | OWN-09, nhóm Bookings trong contract | P0; từ confirmed và sau giờ bắt đầu, không từ completed |
| Hoàn thiện Admin duyệt Owner/Venue | BSC-014, 062; API phục vụ BSC-040 | P0; tái sử dụng phần đã làm ở Phase 1 |
| Quản lý user, khoá/mở khoá | BSC-070; API phục vụ BSC-041 | P0; quyền/trạng thái mới phải có hiệu lực khi truy cập API |
| Toàn bộ booking, thống kê, audit log | BSC-068–071 | P0; Admin-only; ghi vết không chứa secret |
| Thông báo trong app | CUS-14, OWN-14; schema BSC-059 | P0 theo phạm vi sản phẩm; cần API danh sách, unread count, đánh dấu đã đọc |
| Email nghiệp vụ | BSC-045 | P1; email auth hiện có không thay thế email booking; cron nhắc lịch BSC-078 thuộc Phase 2 |
| Khách tạo đánh giá và Admin kiểm duyệt | BSC-046, 072 | P1; chỉ khách có booking completed được đánh giá; Owner phản hồi BSC-067 thuộc Phase 3 |
| Google OAuth | BSC-047 | P1; chưa có endpoint thực tế |
| Quên/đặt lại mật khẩu | BSC-076 | Đã có API; kiểm tra tích hợp FE và email khi nghiệm thu |

Các việc chưa có issue BE riêng (timeline, tài khoản nhận tiền, notifications, no-show, đọc booking cá nhân) cần bổ sung acceptance criteria hoặc tách issue từ tính năng tương ứng trước khi triển khai, tránh bỏ sót vì backlog chủ yếu ghi tên màn hình FE.

**Tiêu chí hoàn thành P0:** chạy được `held → pending_payment → confirmed → completed`, các nhánh expired/rejected/cancelled/no-show đúng luật; gửi lại request và cạnh tranh với cron không làm lệch trạng thái. Chốt **OpenAPI-3 ở cuối Phase 4**, theo phần đính chính trong docs/15.

## 8. Phase 5 – Kiểm thử, triển khai và demo

| Công việc BE / phối hợp | Backlog | Đầu ra |
|---|---|---|
| E2E đặt sân và demo hai trình duyệt | BSC-048, 029 | Có bằng chứng chống trùng, realtime và quyền truy cập |
| Dựng staging trước nghiệm thu/deploy production | BSC-081 | DB/môi trường riêng để chạy E2E |
| Deploy API, env, migration và health | BSC-050 | Cookie/CORS phù hợp môi trường, không lộ secret |
| Seed dữ liệu demo | BSC-051 | Tài khoản ba role, venue/court/giá, booking/payment mẫu |
| Giám sát lỗi và dọn dữ liệu hết hạn | BSC-052, 079, P1 | Theo dõi lỗi và job cleanup theo chính sách lưu trữ |
| Chốt tài liệu và bằng chứng kiểm thử | docs/17 | OpenAPI, hướng dẫn chạy, dữ liệu demo, kết quả test |

**Tiêu chí hoàn thành:** các check bắt buộc đạt; E2E chạy trên staging; có quy trình migration/deploy tái lập; demo đủ vòng đời đặt sân. Phase 6 Mobile chỉ làm sau khi nộp bài, ưu tiên tái sử dụng API hiện có.

## 9. Các điểm chưa thống nhất trong tài liệu gốc

| Điểm cần lưu ý | Cách đọc roadmap này |
|---|---|
| Bảng mốc đầu docs/15 ghi OpenAPI-3 đầu Phase 4, phần đính chính ghi cuối Phase 4 | Dùng mốc **cuối Phase 4** theo đính chính; OpenAPI-1 cuối Phase 1, OpenAPI-2 giữa Phase 2 theo bảng mốc |
| BSC-081 phụ thuộc BSC-050 trong backlog, nhưng docs/15 yêu cầu staging trước deploy production | Giữ cả hai mã ở Phase 5; thực hiện staging trước nghiệm thu/production theo hướng dẫn rõ trong docs/15 |
| BSC-067 ghi Owner ẩn/hiện review; docs/06 và docs/11 dành kiểm duyệt ẩn/hiện cho Admin | Không tự cấp quyền ẩn/hiện cho Owner; cần đồng bộ acceptance criteria trước khi code |
| BSC-067 ở Phase 3, BSC-046 tạo review ở Phase 4 | Giữ Phase gốc; nghiệm thu luồng đầy đủ sau khi có API tạo review |
| BSC-028 huỷ booking ở Phase 2, BSC-065 cấu hình chính sách ở Phase 3 | Giữ Phase gốc; phải thống nhất chính sách áp dụng trước khi nghiệm thu chức năng huỷ |
| Tài khoản nhận tiền, timeline, đọc booking cá nhân, notifications và no-show có trong contract nhưng chưa có issue BE riêng | Những dòng tương ứng trong roadmap là phạm vi cần phủ theo contract; cần làm rõ issue/Phase, không xem là mã backlog đã tồn tại |

Thông báo trong app là P0 theo docs/01; BSC-045 chỉ ghi email P1 nên không thể dùng mức P1 của email để bỏ qua notifications. Bản tổng hợp giữ phần notifications cạnh luồng Phase 4 để tra cứu, không coi đó là Phase đã được backlog chốt riêng.

## 10. Checklist chung cho mỗi issue BE

- Đọc quy ước BE, schema, API contract; với booking/quyền đọc thêm docs/05 và docs/06.
- Chốt input/output, quyền và mã lỗi trước khi FE tích hợp; shared types/schema nằm trong `packages/shared`.
- Nghiệp vụ ở `apps/api`; mutation nhạy cảm kiểm tra lại quyền/trạng thái trong transaction.
- Thay đổi DB qua migration mới; dependency mới phải ghi decision log.
- Có unit test và test đồng thời cho booking/giá/phân quyền theo AGENTS.md; test HTTP/DB cho các ranh giới quyền và constraint liên quan.
- Chạy lint, typecheck, test/build phù hợp; cập nhật OpenAPI và tài liệu trong cùng PR.
- Mỗi lần một issue, nhánh riêng và PR về `develop`; không push trực tiếp `develop`/`main`.

## 11. Tài liệu nguồn

- [Tổng quan và ưu tiên P0/P1](01-product-overview.md)
- [Schema DB](04-database-schema.md), [booking/realtime](05-booking-and-realtime.md), [phân quyền](06-security-and-permissions.md)
- [Quy ước BE](10-backend-conventions.md), [API contract](11-api-contract.md)
- [Workflow](14-github-workflow.md), [roadmap toàn nhóm](15-team-and-roadmap.md), [backlog](16-backlog.md), [decision log](18-decision-log.md)
- [AppModule thực tế](../apps/api/src/app.module.ts), [migration](../apps/api/src/database/migrations)

Khi tài liệu thiết kế khác mã nguồn, dùng mã nguồn để xác định **đã triển khai gì**, dùng contract để chốt **cần triển khai gì**. Không đánh dấu một API hoàn tất chỉ vì bảng DB, type hoặc test fixture đã tồn tại.
