# 00 – Mục lục tài liệu BookSportsCourt

> **Phiên bản:** 1.4.29 | **Cập nhật lần cuối:** 2026-11-08 | **Người duy trì:** Tech Lead

## Mục lục & Thứ tự đọc

| File | Tên | Đọc khi nào |
|------|-----|-------------|
| `AGENTS.md` | Quy tắc tối thượng | **Luôn luôn đầu tiên** |
| `00-README.md` | Mục lục này | Ngay sau AGENTS.md |
| `01-product-overview.md` | Tổng quan sản phẩm | Tất cả thành viên |
| `02-features-by-role.md` | Tính năng theo vai trò | Khi nhận issue mới |
| `03-architecture.md` | Kiến trúc hệ thống | BE + FE lead |
| `04-database-schema.md` | Schema DB | TV1, TV2 (BE) |
| `05-booking-and-realtime.md` | Đặt sân & realtime | **Bắt buộc TV2** |
| `06-security-and-permissions.md` | Bảo mật & phân quyền | Tất cả |
| `07-design-system.md` | Design System | TV3, TV4 (FE) |
| `08-ui-quality-rules.md` | Quy tắc chất lượng UI | Mọi PR có UI |
| `09-frontend-conventions.md` | Quy ước FE | TV3, TV4 |
| `10-backend-conventions.md` | Quy ước BE | TV1, TV2 |
| `11-api-contract.md` | Hợp đồng API | Tất cả |
| `12-coding-standards.md` | Tiêu chuẩn code | Tất cả |
| `13-deployment-and-cost.md` | Deploy & chi phí | TV4 + nhóm |
| `14-github-workflow.md` | Quy trình GitHub | Tất cả |
| `15-team-and-roadmap.md` | Phân công & lộ trình | Tất cả |
| `16-backlog.md` | Backlog issue | Khi planning |
| `17-report-outline.md` | Dàn ý báo cáo | Khi viết báo cáo |
| `18-decision-log.md` | Nhật ký quyết định | Khi thêm dep/thay đổi lớn |
| `implemented-apis.md` | Tổng hợp API thực tế đã triển khai | Khi tích hợp và tra cứu API hiện có |
| `backend-roadmap.md` | Các giai đoạn BE và bước tiếp theo sau auth/phân quyền | Khi chọn issue và theo dõi phạm vi BE |
| `backend-conflict-resolution.md` | Cách ghép hai nhánh backend, kiểm thử và giới hạn nghiệm thu | Khi review kết quả xử lý conflict ngày 2026-11-05 |
| `bsc-014-implementation-plan.md` | Lộ trình từng bước cho Venue CRUD và Admin duyệt | Khi triển khai BSC-014 |
| `bsc-014-progress.md` | Tiến độ BSC-014, bằng chứng kiểm tra và công việc còn lại | Khi theo dõi BSC-014 |
| `bsc-014-step-01-scope-and-ac.md` | Đầu ra Bước 1: phạm vi, input/output, quyền/lỗi, AC và giải thích code | Khi chốt phạm vi BSC-014 |
| `bsc-014-step-02-business-rules.md` | Kết quả Bước 2: quy tắc nghiệp vụ, giải thích code và tiến độ | Trước khi triển khai Venue service |
| `bsc-014-step-03-schema-and-fixtures.md` | Kết quả Bước 3: fixture, kiểm chứng migration, cách chạy và giải thích code | Khi chuẩn bị test Venue |
| `bsc-014-step-04-dto-and-response.md` | Kết quả Bước 4: query schema, DTO, pipe, Swagger và response | Khi triển khai controller Venue |
| `openapi/bsc-014.openapi.json` | OpenAPI thiết kế bảy endpoint BSC-014 (chưa phải runtime) | Khi viết test/đối chiếu Swagger Venue |
| `bsc-014-step-05-create-venue.md` | Module và POST Venue: giải thích controller/service/repository, transaction và test | Khi triển khai/kiểm tra Bước 5 |
| `bsc-014-step-06-read-venues.md` | Ba API đọc: phân quyền, public projection, snapshot/phân trang và kiểm thử | Khi triển khai/kiểm tra Bước 6 |
| `bsc-014-step-07-update-and-delete.md` | PATCH/DELETE: ownership trong transaction, duyệt lại/no-op, xoá mềm và booking chặn xoá | Khi triển khai/kiểm tra Bước 7 |
| `bsc-014-step-08-admin-moderation.md` | Admin status: state machine, retry/legacy, audit nguyên tử và concurrency | Khi triển khai/kiểm tra Bước 8 |
| `bsc-014-step-09-test-acceptance.md` | Ma trận nghiệm thu, test bổ sung, sửa precedence và kết quả chạy thật | Khi nghiệm thu Bước 9 |

## Nguyên tắc cập nhật tài liệu

> **Quy tắc vàng:** Thay đổi quy tắc hoặc tài liệu PHẢI được thực hiện trong cùng PR với code liên quan.

1. **Sửa quy ước code** → cập nhật `12-coding-standards.md` trong cùng PR.
2. **Thêm/sửa endpoint** → cập nhật `11-api-contract.md` + OpenAPI spec trước khi chia việc FE/BE.
3. **Thêm/sửa bảng DB** → cập nhật `04-database-schema.md` + tạo file migration.
4. **Thêm dependency mới** → ghi vào `18-decision-log.md` trước.
5. **Thay đổi design system** → cập nhật `07-design-system.md` trước khi code component.
6. **Thêm tính năng** → cập nhật `02-features-by-role.md` và tạo issue theo mẫu.

## Quy ước format tài liệu

- Mỗi file bắt đầu bằng dòng phiên bản + ngày cập nhật.
- Dùng tiếng Việt; thuật ngữ kỹ thuật giữ nguyên tiếng Anh (booking, slot, venue, court).
- Mọi mã tính năng theo format `ROLE-NN` (CUS-01, OWN-03, ADM-02).
- Mọi thay đổi lớn ghi vào **CHANGELOG duy nhất ở cuối file này** (`00-README.md`). Không rải CHANGELOG riêng ở từng file — một nguồn duy nhất để tra cứu lịch sử thay đổi tài liệu.
- Khi sửa nội dung một file, tăng **số phiên bản của file đó** ở dòng đầu và cập nhật ngày, đồng thời thêm một dòng vào CHANGELOG bên dưới.

## CHANGELOG

| Ngày | Thay đổi | File ảnh hưởng |
|------|----------|----------------|
| 2026-11-08 | Gỡ đường dẫn cũ tới tài liệu và artifact Phase 4 đã chuyển đi; giữ nội dung nghiệp vụ, tiến độ và lịch sử thay đổi. | Mục lục và các tài liệu Markdown tham chiếu Phase 4 |
| 2026-11-06 | Bước15: backend275/275/shared14/14, typecheck và compiler build đạt; xuất runtime candidate24 paths/25 operations, report pending refund, Postman33 request/13 body validate shared; bổ sung Swagger errors/build/API contract gate, ghi lint/toolchain/Phase2/provider/FE còn thiếu; chưa chốt OpenAPI-3 final | API build config/package, contract script/test/Postman exporter, controller metadata/CI, OpenAPI0.10.0/runtime/report/Postman, Bước15/progress/plan, docs10/11/API thực tế/roadmap/00 |
| 2026-11-06 | Bước14 BSC-076: reuse API/AuthMail/auth_tokens, config/origin/password dưới khoá, clock DB, reset/session rollback và sanitized errors; backend274/274, shared14/14, typecheck đạt; smoke Resend thật được người dùng xác nhận inbox, FE còn chờ | Auth controller/service/repository/mail, password-recovery tests/business-mail/package, docs02/04/06/11, Bước14/progress/plan/business rules, roadmap/API thực tế/OpenAPI0.9.0, `00` |
| 2026-11-06 | Bước13 BSC-047: start/callback Google OIDC code/PKCE, encrypted single-use state/binding/nonce, jose RS256/JWKS và verified email, không auto-link, app session/cookies chung; unique/race/rollback PostgreSQL, shared code XOR error; backend260/260/shared14/14; còn live Google/FE | Auth Google/session/cookies, HTTP security/config/env, shared/tests/scripts/package, ADR026, docs02/04/06/11, Bước13/progress/plan, roadmap/API thực tế/OpenAPI0.8.0, `00` |
| 2026-11-06 | Bước11–12 BSC-046/072: Customer create/public list, Admin list/visibility, shared strict/allowlist, unique booking, Venue lock+trigger visible AVG2/count, audit/no-op/rollback và PostgreSQL concurrency/snapshot; BSC-067 sửa thành xem/phản hồi, OpenAPI0.7.0; còn FE/Phase2 | ReviewsModule/AppModule, unit/HTTP cases/scripts/package, Bước11–12/progress/plan, docs02/04/06/11/16, roadmap/API thực tế/OpenAPI, `00` |
| 2026-11-06 | Bước10 BSC-045: transport Resend chung Auth, năm template VN/VND, worker PostgreSQL lease/frozen request/key/retry/unknown, cron reminder bắt kịp24h và marker theo ACK; migration0010 local, test DB/fake provider; chưa smoke mail thật/Phase2/Gateway/notification API | Mail/Auth/AppModule/config/env/schema/migration0010, schedule/tests/package, Bước10/progress/plan, docs04/05/ADR024, roadmap/API thực tế, `00` |
| 2026-11-06 | Bước 8–9 BSC-068/069: Admin booking list/stats, projection/history, VN range/buckets, independent paid/refund flows, exact integer và snapshot; migration0009 index + fresh/upgrade/down/up/EXPLAIN, test tính tay và ghi đồng thời; OpenAPI0.6.0, không đổi Owner reports hoặc public data | AdminModule, schema/migration0009/shared date, API/unit/migration tests/package, Bước 8–9/tiến độ/kế hoạch, contract/schema/OpenAPI, roadmap/API thực tế, `00` |
| 2026-11-06 | Bước 7 BSC-070/BSC-041: Admin user list/detail/status, bảo vệ Admin, audit/version/revoke nguyên tử; JWT/refresh + HTTP/message scope chặn token cũ; reset/change-password invalidate và adapter socket kiểm tra/ngắt sau commit; OpenAPI0.5.0; Gateway/FE chưa nghiệm thu | UsersModule, Auth/session adapter, Owner promotion hook, API/guard tests/package, Bước 7/tiến độ/kế hoạch, contract/security/OpenAPI, roadmap/API thực tế, `00` |
| 2026-11-06 | Hoàn thiện Bước 6: Customer submit/me, Admin list/review strict/projection, user/application locks, live role/target, retry và role+hồ sơ+audit cùng transaction; test HTTP/PostgreSQL cạnh tranh/rollback và cookie cũ đọc role DB; OpenAPI0.4.0; FE Dashboard/Gateway/sessionVersion nghiệm thu riêng | OwnerApplications, API/unit tests/package, Bước 6/tiến độ/kế hoạch, Bước 1 policy, contract/OpenAPI, roadmap/API thực tế, `00` |
| 2026-11-06 | Bước 5 BSC-043: Owner list/approve/reject, cron mỗi5 phút, shared lock/transition, audit/notification/outbox cùng transaction; bổ sung kiểm thử PostgreSQL cạnh tranh/rollback/quyền, cập nhật trạng thái triển khai độc lập; không migration/dependency mới, chưa nghiệm thu tích hợp Phase 2/email/realtime | Payments, schedule, API/unit tests/package, Bước 5/tiến độ/kế hoạch, roadmap/API contract/OpenAPI, Bước 1 lock recipient, `00` |
| 2026-11-06 | Triển khai/test độc lập Bước 4 BSC-042: payment GET/proof multipart, account origin/strict, R2 adapter/decoder/cleanup và outbox; backend166/166, nhóm cuối22/22, shared13/13; ADR-025/dependency/lockfile, còn R2 thật/hold/realtime consumer chưa nghiệm thu | Payments/Uploads, config/guard/API tests, shared, package/lock/engines, Bước 4/tiến độ/kế hoạch, roadmap/API contract/OpenAPI, ADR/`00` |
| 2026-11-06 | Hoàn thành nền Bước 3 BSC-071: helper audit dùng transaction, Venue dùng lại, Admin GET log strict/filter/pagination/projection và Swagger; backend 151/151, shared 13/13, API/shared typecheck đạt; coverage producer còn theo từng bước, không migration/dependency mới | Audit module/writer, Venue repository, shared registry, API test/package, Bước 3/tiến độ/kế hoạch, API thực tế, roadmap, contract/OpenAPI, `00` |
| 2026-11-06 | Hoàn thành nền Bước 2 Phase 4: migration 0008/Drizzle + DOWN rehearsal, shared input/response/OpenAPI parity, fixture và taxCode roundtrip; backend 144/144, shared 13/13, cuối lượt Auth/foundation 40/40; local áp dụng 0007/0008, chưa nghiệm thu payment/worker/OAuth/tích hợp | Schema/migration/repository/test API, shared, Bước 2/tiến độ/kế hoạch Phase 4, OpenAPI, `04`, `11`, `00` |
| 2026-11-06 | Chốt thiết kế Bước 1 Phase 4: contract + OpenAPI 25 path/26 operation, AC P4-01–14; snapshot/proof/deadline/lock/session/outbox/stats/review/OAuth, đồng bộ docs/04/05/06/11 và ADR-024; chưa triển khai runtime/migration | Contract/spec/tiến độ/kế hoạch Phase 4, `04`, `05`, `06`, `11`, `18`, `00` |
| 2026-11-06 | Hoàn thành kiểm chứng Bước 0 Phase 4: bảng phụ thuộc, DB ứng dụng thiếu migration 0007, hồi quy mới 131/131 + prerequisite DB 4/4 + shared 7/7; thêm test tranh slot/trigger và file tiến độ chung, chưa đánh dấu Phase 2 sẵn sàng | API test/package, Tiến độ chung Phase 4, kiểm chứng đầu vào, bằng chứng test và giải thích code, kế hoạch Phase 4, `00-README.md` |
| 2026-11-06 | Chốt kế hoạch chính đầy đủ BE Phase 4: ánh xạ tài liệu/issue/endpoint, quy tắc nghiệp vụ phải giữ, ranh giới Phase 2/FE, đầu việc liên quan và ba mốc triển khai–test–tích hợp; không đổi contract hay đánh dấu code đã hoàn thành | Hai kế hoạch Phase 4, `backend-roadmap.md`, `00-README.md` |
| 2026-11-06 | Lập lộ trình Phase 4 khi Phase 2 chưa xong: contract bàn giao, fixture PostgreSQL, 13 bước triển khai/test độc lập và nghiệm thu tích hợp; cập nhật kế hoạch tổng để không chặn viết payment chỉ vì hold chưa có | Các bước làm Phase 4 độc lập bằng fixture PostgreSQL, ranh giới và nghiệm thu với Phase 2, Kế hoạch chính đầy đủ BE Phase 4: tài liệu chi phối, P0/P1, quy tắc, endpoint, từng bước và nghiệm thu, `backend-roadmap.md`, `00-README.md` |
| 2026-11-06 | Chuẩn bị Phase 4: kiểm tra DB local thành công, đối chiếu module sau tích hợp, ghi phụ thuộc booking/upload còn thiếu và chọn BSC-071 làm đầu việc đầu tiên | Kế hoạch chính đầy đủ BE Phase 4: tài liệu chi phối, P0/P1, quy tắc, endpoint, từng bước và nghiệm thu, `00-README.md` |
| 2026-11-05 | Đánh dấu trực tiếp các phần BE đã triển khai trong từng Phase; tách việc còn thiếu/nghiệm thu thành checkbox riêng, bỏ bảng tiến độ tách rời | `backend-roadmap.md`, `00-README.md` |
| 2026-11-05 | Rà checklist BE theo code và kết quả 131/131 backend, 7/7 shared: tick nền tảng/shared/migration/hạ tầng HTTP và API tài khoản nhận tiền; ghi phần đã có/còn thiếu ở các issue tích hợp, cập nhật hiện trạng DB/profile | `backend-roadmap.md`, `00-README.md` |
| 2026-11-05 | Xử lý conflict backend: giữ các bảo vệ BSC-014, ghép Catalogs/Courts/Owner applications/Users/Venue extensions, thống nhất shared/workspace/lockfile/CI và bổ sung test AppModule thật; giữ trạng thái issue theo bằng chứng nghiệm thu | API/shared, package/lock/workspace/CI, `backend-conflict-resolution.md`, `implemented-apis.md`, roadmap, ADR-023, `00` |
| 2026-11-01 | Hoàn thành Bước 9 BSC-014: đối chiếu ma trận, 5 nhóm acceptance mới, sửa thứ tự resource/body ở moderation, script test:venues; 70/70 API/DB/unit + 7/7 shared đạt. Chốt AC-13 và API thực tế còn dang dở Bước 8 | API test/service/controller/package, Bước 1/8/9, kế hoạch/tiến độ, roadmap, API thực tế, `00` |
| 2026-10-31 | Hoàn thành Bước 8 BSC-014: Admin status, state machine/retry/legacy reason, audit tối thiểu cùng transaction; 36/36 test đạt, đủ 7 endpoint local; còn rà soát Bước 9–10/PR | API moderation/audit/test, AC-13, kế hoạch/tiến độ/Bước 8, API thực tế, `11`, OpenAPI, roadmap, `00` |
| 2026-10-31 | Hoàn thành Bước 7 BSC-014: PATCH/DELETE, ownership trong tx, khoá user→Venue, duyệt lại/no-op, soft delete kiểm tra booking; suite Venue/contract 29/29 đạt; còn Admin status | API/controller/service/repository/test, kế hoạch/tiến độ/Bước 7, API thực tế, `11`, OpenAPI, roadmap, `00` |
| 2026-10-31 | Hoàn thành Bước 6 BSC-014: ba GET Owner/Admin/public, phân quyền, projection/null, count/page cùng snapshot; 18/18 test POST/đọc/contract đạt; còn ba mutation | API read controller/service/repository/Swagger/test, kế hoạch/tiến độ/Bước 6, API thực tế, `11`, OpenAPI, roadmap, `00` |
| 2026-10-31 | Hoàn thành Bước 5 BSC-014: đăng ký POST Venue, Owner active, transaction/lock, địa lý/danh mục, UUID v7/slug, lỗi an toàn; 10/10 test tạo Venue đạt, gồm rollback và concurrency; còn sáu endpoint | API module/service/repository/controller/test, kế hoạch/tiến độ/Bước 5, `implemented-apis.md`, `11`, OpenAPI, roadmap, `00` |
| 2026-10-30 | Hoàn thành Bước 4 BSC-014: query Owner/Admin, DTO alias, Zod pipe, Swagger metadata và envelope; bổ sung httpStatus vào type lỗi; 7 test shared + 2 test Nest contract đạt; chưa đăng ký Venue API | shared, API DTO/pipe/test, OpenAPI, `10`, `11`, kế hoạch/tiến độ/Bước 4, `backend-roadmap.md`, `00` |
| 2026-10-30 | Hoàn thành Bước 3 BSC-014: fixture 5 user/8 Venue, payload lỗi, helper schema tạm, 4 test PostgreSQL mới/nâng cấp/constraint/cleanup; cập nhật tiến độ, không sửa migration cũ | scripts API, package API, `bsc-014-step-03-schema-and-fixtures.md`, kế hoạch/tiến độ BSC-014, `backend-roadmap.md`, `00` |
| 2026-10-30 | Thêm bảng tiến độ riêng BSC-014: trạng thái từng bước, checklist Bước 3/API và bằng chứng kiểm thử hiện có | `bsc-014-progress.md`, `00` |
| 2026-10-30 | Chốt Bước 2 BSC-014: quyền, reason, transition, duyệt lại, slug, soft delete và projection/nullability; ADR-022, migration 0007, shared schema/types/test, OpenAPI thiết kế; cập nhật tiến độ, chưa triển khai Venue API | `02`, `04`, `05`, `06`, `11`, `18`, tài liệu BSC-014, `backend-roadmap.md`, shared, DB |
| 2026-10-30 | Tạo file riêng ghi kết quả Bước 1 BSC-014, phân phạm vi, đặc tả endpoint và giải thích code phân quyền | `bsc-014-step-01-scope-and-ac.md`, `00` |
| 2026-10-30 | Bổ sung hướng dẫn Bước 1 BSC-014: phạm vi, input/output, quyền/lỗi, acceptance criteria và giải thích code minh hoạ | `bsc-014-implementation-plan.md`, `00` |
| 2026-10-29 | Thêm kế hoạch BSC-014 theo từng bước, phạm vi endpoint, điểm cần chốt và checklist kiểm thử | `bsc-014-implementation-plan.md`, `00` |
| 2026-10-29 | Thêm checklist tiến độ BE theo Phase; đánh dấu auth/refresh/phân quyền theo xác nhận, tách API contract chưa có issue riêng | `backend-roadmap.md`, `00` |
| 2026-10-29 | Chuẩn hoá roadmap BE theo Phase/nhãn backlog gốc, làm rõ bước BSC-014 sau phân quyền và ghi nhận các điểm tài liệu chưa thống nhất | `backend-roadmap.md`, `00` |
| 2026-10-29 | Tổng hợp 9 endpoint hiện có và lộ trình BE theo Phase, phụ thuộc, backlog và tiêu chí hoàn thành | `implemented-apis.md`, `backend-roadmap.md`, `00` |
| 2026-10-12 | **Sửa theo báo cáo rà soát tài liệu.** Máy trạng thái booking: `completed` thành terminal, bỏ `completed → cancelled`, thêm `confirmed → no_show`; bổ sung cron `autoCompleteBookings` (nếu không `completed` không thể đạt được) và cron nhắc lịch CUS-14 | `01` `03` `05` `10` |
| 2026-10-12 | Cron cập nhật cả `payments` khi đổi trạng thái booking (trước đây chỉ đổi `bookings` → lệch hai bảng); làm rõ chỉ endpoint Owner mới đặt `payments.status = 'refunded'` | `05` `11` |
| 2026-10-12 | Định nghĩa 3 loại room realtime (`venue:`/`user:`/`owner:`) và quy tắc join; bảng sự kiện WebSocket thêm cột room nhận | `05` `11` |
| 2026-10-12 | `calculatePrice` ném `PRICING_RULE_NOT_FOUND` thay vì trả 0; làm rõ thứ tự ưu tiên `date_override` > `day_of_week` > rule chung | `05` |
| 2026-10-12 | Thống nhất idempotency hold: cùng user → 200, user khác tranh nhau → 409 `SLOT_TAKEN`; sửa test đồng thời cho khớp | `11` `12` |
| 2026-10-12 | Ma trận phân quyền: Admin không thay thế hành vi Customer/Owner (bỏ quyền tạo hold, viết review, yêu thích); khớp nhãn `[Customer]`/`[Owner]`/`[Admin]` ở `11` | `06` |
| 2026-10-12 | Cookie `SameSite=Lax` thay `Strict` (Strict phá luồng Google OAuth redirect) | `06` |
| 2026-10-12 | CI: tách job `lint`/`typecheck`/`test`/`build` khớp tên check trong branch protection; `pnpm test -- --passWithNoTests`; trigger cả `develop`; bỏ domain placeholder | `.github/workflows/ci.yml` |
| 2026-10-12 | `keep-alive.yml` fail khi thiếu variable hoặc ping lỗi (trước đây luôn báo xanh); mặc định tắt, bật qua `workflow_dispatch`/`schedule` | `.github/workflows/keep-alive.yml` |
| 2026-10-12 | Quy ước nhánh: `develop` là nhánh tích hợp, `main` là nhánh phát hành; branch protection áp dụng cho cả hai; thêm tag `v0.5` | `14` |
| 2026-10-12 | Design system: đủ màu Badge cho mọi giá trị enum (thêm `no_show`, `suspended`, payment statuses); khai báo màu semantic (`success`/`warning`/`danger`/`info`) trong Tailwind; `my_hold` là state do FE suy ra, không phải enum API; OwnerTimeline không hard-code 8:00–22:00 mà suy từ `opening_hours` | `01` `07` |
| 2026-10-12 | Sửa `data?.length` → `data?.data.length` (response bọc trong `{ data, meta }`); thống nhất breakpoint 375/768/1280/1440; nêu rõ code mẫu trong tài liệu được miễn quy tắc i18n | `08` `09` |
| 2026-10-12 | Thêm `README.md`, `.gitignore`, `.env.example` ở gốc repo; ghim phiên bản stack và cú pháp TanStack Query v5 | `03` + root |
| 2026-10-12 | Đồng bộ bảng label với `.github/labels.yml` (`type:fix` → `type:bug`, màu `area:db`); thêm Phase 6 vào issue template; `HOLD_LIMIT_EXCEEDED` ghi rõ giá trị 3 | `11` `14` + `.github/` |
| 2026-10-12 | **Bổ sung theo Phần C.** Schema: thêm `venues.rating_avg/review_count/from_price` + trigger đồng bộ, `pg_trgm` cho tìm theo tên, partial unique cho `users.email` (soft delete không còn chiếm email), unique `payments.transfer_code`, trigger chặn booking trong `blackout_periods`, index `audit_logs`, job dọn dữ liệu hết hạn; nêu vị trí thư mục migration | `04` |
| 2026-10-12 | Backend/FE: thêm module `favorites`, `owner-applications`, `catalogs`, `reports`, `uploads`, `health`; thêm `middleware.ts`, `providers.tsx`, route `(auth)`/`auth/callback/google`, chốt dùng `fetch` (không Axios) | `09` `10` |
| 2026-10-12 | Phạm vi: thanh toán QR + duyệt thanh toán lên **P0** (thiếu thì không booking nào tới `confirmed`); P0/P1 ghi kèm mã tính năng; thêm mã `CUS-16` (quên mật khẩu) | `01` `02` |
| 2026-10-12 | Backlog: thêm BSC-053 → BSC-081 (schema còn thiếu, 9 mã tính năng chưa có issue, hạ tầng & cron, staging); nâng BSC-042/043/044 lên P0 | `16` |
| 2026-10-12 | Thêm ADR-012 → ADR-021 (stack FE, Socket.IO, Leaflet, cookie-JWT + Argon2, R2, Resend, Sentry, hosting, test tooling, QR client) + bảng mục lục ADR | `18` |
| 2026-10-12 | CI: thêm job `e2e` (Playwright + Postgres service), ghi rõ bật check này từ Phase 5 | `.github/workflows/ci.yml` `14` |
| 2026-10-12 | Lộ trình: cân bằng tải Phase 3, sửa mốc OpenAPI-3 (cuối Phase 4), thêm việc dựng staging | `15` |
| 2026-10-12 | Quy tắc giữ chỗ: `HOLD_RATE_LIMITED` (5 lần/giờ) ghi rõ cách đếm và mã lỗi; thêm env `HOLD_RATE_LIMIT_PER_HOUR` | `06` `11` `.env.example` |
| 2026-10-12 | `.github/CODEOWNERS`: comment toàn bộ quy tắc placeholder (GitHub bỏ qua im lặng cả file nếu username không tồn tại) + hướng dẫn kích hoạt | `.github/CODEOWNERS` |
| 2026-10-12 | **Khắc phục rà soát:** xử lý toàn bộ 44/44 phát hiện của `bao-cao-rac-soat-tai-lieu.html` (A1–A8, B9–B31, C32–C44) trên `docs/`, `AGENTS.md` và `.github/`; báo cáo được đánh dấu trạng thái khắc phục và giữ làm bản đối chiếu lịch sử | tất cả + `bao-cao-rac-soat-tai-lieu.html` |
| 2026-10-07 | Vẽ lại ERD 3 cấp độ (Conceptual/Logical/Physical) | `04` |
| 2026-10-07 | Bổ sung endpoint còn thiếu cho 3 vai trò (uploads, notifications, favorites, owner reports, admin, catalogs, v.v.) | `11` |
| 2026-10-07 | Đổi thanh toán sang chuyển khoản qua QR chủ sân + gửi ảnh xác nhận + Owner duyệt (ADR-006, ADR-010); bỏ webhook/sandbox khỏi MVP; FE tự dựng QR từ thông tin tài khoản, thêm `payments.status` `cancelled`/`expired`, `transfer_code` nullable cho `cash`, lỗi `PAYMENT_ACCOUNT_MISSING` | `01` `02` `03` `04` `05` `10` `11` `15` `16` `17` `18` |
| 2026-10-07 | Chọn UUID v7 sinh ở tầng ứng dụng (ADR-011), thay ghi chú "chưa thống nhất" | `04` `10` `18` |
| 2026-10-07 | Thêm bảng `areas` (ADR-009), `auth_tokens`, `owner_applications`, `venue_payment_accounts`, `cancellation_policies`; thêm cột `users.email_verified_at`, `reviews.owner_reply`, `bookings.source/guest_*/created_by/deposit_amount`; `bookings.customer_id` cho phép NULL | `04` |
