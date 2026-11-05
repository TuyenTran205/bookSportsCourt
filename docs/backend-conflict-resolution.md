# Xử lý conflict backend khi tích hợp nhánh feat/back-end

> **Phiên bản:** 1.0.0 | **Cập nhật lần cuối:** 2026-11-05

## Phạm vi

Giải quyết 28 file unmerged của lần merge đang diễn ra giữa HEAD `d516bfa` và nhánh đưa vào ở `8736a5d`. Giữ chức năng của cả hai phía và kiểm tra backend sau tích hợp. Không commit, push, tạo PR hoặc tự kết thúc merge bằng commit.

## Cách ghép

| Nhóm | Kết quả |
|---|---|
| Venue lõi | Giữ controller/service/repository BSC-014 đã có test PostgreSQL: role hiện tại trong DB, ownership trong transaction, khoá user→Venue, state machine/retry/reason, audit, slug UUID v7 bất biến, xoá mềm và chặn booking đang dùng. Không lấy bản Venue thay thế làm mất các bảo vệ này. |
| Venue bổ sung | Tách search/map, ảnh và cấu hình chính sách/tài khoản nhận tiền sang VenueExtensionsController/OwnerVenueSettingsController. Đăng ký trước public `:slug`, tránh trùng route. Export repository để CourtsModule inject được. |
| Public search | Giữ bộ lọc nhánh tích hợp, sửa SQL lọc môn/tiện ích thành subquery với inArray, allowlist response không lộ rejectionReason/ownerId/timestamps nội bộ, số/null đúng, totalPages=0 khi không có hàng, sort thêm id để ổn định. Query UUID/phân trang/toạ độ validate bằng shared schema. |
| Ảnh và cấu hình | Mutation kiểm tra lại Owner và ownership trong cùng transaction. Thay đổi nội dung ảnh cần duyệt lại như contract BSC-014; xoá cover chọn ảnh còn lại/null; reorder không nhận ảnh cơ sở khác hoặc ID lặp. GET payment-account chưa cấu hình trả data:null, PUT không bắt buộc bankName ngoài contract. |
| Modules mới | Đăng ký Catalogs, Courts và OwnerApplications cùng Auth/Venues/Health. Giữ endpoint profile/password của nhánh tích hợp; PATCH profile không xoá phone/avatar khi bỏ qua field và không cho body đổi role. |
| Shared | Giữ strict allowlist, trim trước độ dài, PATCH không kế thừa default mảng từ POST, kiểu lỗi httpStatus, nullable và private Venue response của BSC-014. Bổ sung schema/type Court, ảnh, hồ sơ Owner và query cho endpoint mới. |
| Database | Giữ venues.rejectionReason và migration 0007. Không sửa migration đã áp dụng, không tạo migration nghiệp vụ mới trong lượt xử lý conflict. |
| Package/lock/workspace | Hợp nhất dependency và script hai phía. Giữ exclusion packages/api để không có hai package @bsc/api. Lock importers root/API/shared khớp manifest; không lấy lockfile riêng một phía rồi bỏ qua khác biệt. ADR-023 ghi dependency được giữ từ nhánh tích hợp. |
| CI/Turbo | Giữ VENUE_TEST_DATABASE_URL và task test không cache. CI gọi script API tổng hợp gồm Auth, Venue, group1 và integration merge; shared chạy riêng, không chuyển cờ Vitest vào Node runner. Giữ nguyên tên các job branch protection. |
| Công cụ DB | Bỏ credential DB cố định trong script/hướng dẫn được đưa vào; đọc DATABASE_URL qua env hoặc file env local. Batch helper yêu cầu DATABASE_URL trong terminal. Không chạy db-create/seed trên DB ứng dụng để kiểm thử. |

Mã test group1 gọi VenuesService cũ đã được chuyển sang giao diện transaction của BSC-014; kiểm tra slug có hậu tố UUID thay vì kỳ vọng slug chỉ có tên. Test cũ cho rằng `/venues/map` phải 404 và search chưa đăng ký được cập nhật khi hai endpoint này đã tích hợp; kiểm tra các Venue pending/rejected/suspended/deleted vẫn phải 404 được giữ nguyên.

## Kiểm thử

- API/shared typecheck: kiểm tra bằng TypeScript trong workspace.
- Hồi quy Auth/Venue: giữ nguyên các test HTTP, PostgreSQL, rollback, audit, quyền bị thay đổi giữa guard/transaction và request cạnh tranh.
- Group1: giữ test nghiệp vụ danh mục/hồ sơ Owner/Court, thích nghi test Venue theo hợp đồng đã chốt.
- Test mới `apps/api/scripts/backend-merge.test.ts`: khởi động AppModule thật trên schema riêng, gọi Health/Catalogs/search/map, kiểm tra role/ownership cấu hình nhận tiền, ảnh làm Venue quay lại pending, DI Court→Venue, route hồ sơ Owner/profile và metadata Swagger không bị ghi đè.
- Đối chiếu khai báo controller: **53 method/path khác nhau**, không có route trùng; con số này là inventory, không phải chứng nhận mọi endpoint đã nghiệm thu toàn bộ nghiệp vụ.
- Parse YAML/JSON và kiểm tra manifest so với specifier trong lockfile; Turbo dry-run chỉ có apps/api thật và packages/shared.

### Môi trường và thứ tự test DB

DB được cấu hình ở `.env.local` không kết nối được tại thời điểm kiểm tra. Đã dựng PostgreSQL **18 local tạm**, chỉ lắng nghe loopback cổng 55433, dùng schema sinh ngẫu nhiên để kiểm thử; không sửa DB ứng dụng. Node local **22.12.0**, khác Node20/PostgreSQL16 trong CI, nên không coi kết quả local là CI đã xanh.

Khi chạy các file DB song song, migration có thể cài pg_trgm/btree_gist vào schema tạm của một file; file đó dọn schema khiến file khác mất operator class. Đã đặt `test:venues --test-concurrency=1` để các file fixture dùng chung DB chạy tuần tự. Các bài kiểm thử nhiều request/transaction đồng thời bên trong file vẫn được chạy đầy đủ. Không bỏ test race condition hoặc thay PostgreSQL bằng mock.

Lệnh hồi quy tổng hợp từ apps/api (hai biến *_TEST_DATABASE_URL trỏ DB test local, không dùng DATABASE_URL ứng dụng):

```powershell
node --loader ts-node/esm --no-warnings --test --test-concurrency=1 `
  scripts/auth-api.test.ts scripts/auth-secrets.test.ts `
  scripts/http-security.test.ts scripts/permissions-decorators.test.ts `
  scripts/jwt-auth-guard.test.ts scripts/roles-guard.test.ts `
  scripts/venue-create.test.ts scripts/venue-contract.test.ts `
  scripts/venue-moderation.test.ts scripts/venue-fixtures.test.ts `
  scripts/group1-api.test.ts scripts/backend-merge.test.ts
```

Kết quả cuối được ghi bên dưới sau khi chạy xong; không dùng lần chạy lỗi extension hoặc hai kỳ vọng test cũ làm kết quả nghiệm thu.

## Giới hạn còn lại

- Lint/build API vẫn thiếu script/cấu hình hoàn chỉnh như báo cáo BSC-014 Bước 10; chưa xác nhận frozen install và CI trên đúng Node20/pnpm9/PostgreSQL16.
- Search của nhánh tích hợp chưa triển khai bộ lọc date trong contract; upload ảnh Venue hiện nhận JSON url/sortOrder, chưa phải multipart/R2. Không tự đánh dấu BSC-017/BSC-074 hoàn thành.
- Smoke test module mới không thay nghiệm thu đầy đủ phân quyền trong transaction, cạnh tranh, contract/Swagger và nghiệp vụ của từng issue Court/Catalogs/Owner applications. Roadmap ghi rõ code đã ghép nhưng vẫn chờ nghiệm thu, thay vì giữ các dấu tick của nhánh đưa vào mà chưa đủ bằng chứng.
- Hệ thống booking/payment/realtime Phase 2–4 chưa được dựng thêm chỉ vì đã tích hợp code nền Phase 1.

## Kết quả cuối

- Hồi quy tổng hợp: **131/131 test đạt**, 0 fail, 0 skip (Node runner đếm cả test cha/subtest; không cộng lặp cùng file guard).
- Shared Vitest: **7/7 test đạt**; typecheck API/shared đạt.
- AppModule thật khởi động và phục vụ các route trong test tích hợp; đã kiểm tra 53 method/path không trùng.
- YAML parse được, manifest root/API/shared khớp specifier của lockfile, Turbo dry-run không trùng package.
- Các file đã giải quyết được stage để bỏ trạng thái unmerged; không tạo merge commit. Người dùng có thể review diff staged trước khi tự commit.

Đã dừng PostgreSQL tạm sau kiểm thử; DB ứng dụng và dữ liệu của người dùng không được migration/seed trong lượt này.
