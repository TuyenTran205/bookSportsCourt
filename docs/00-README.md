# 00 – Mục lục tài liệu BookSportsCourt

> **Phiên bản:** 1.3.0 | **Cập nhật lần cuối:** 2026-10-12 | **Người duy trì:** Tech Lead

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
