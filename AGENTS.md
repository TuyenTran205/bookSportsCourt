# AGENTS.md – Quy tắc nền tảng dự án BookSportsCourt

> **Mọi thành viên và AI agent BẮT BUỘC đọc file này trước khi làm bất cứ việc gì.**

## Mô tả dự án
Web đặt sân thể thao marketplace đa người dùng: nhiều chủ sân (Owner), nhiều khách đặt sân (Customer), có Admin nền tảng. Đặt sân theo block 30 phút, hiển thị trạng thái realtime. Thị trường Việt Nam, giao diện tiếng Việt, múi giờ Asia/Ho_Chi_Minh, tiền tệ VND. Ưu tiên chi phí gần như 0đ, đúng đắn về nghiệp vụ, dễ trình bày trong báo cáo đồ án.

## Thứ tự đọc tài liệu bắt buộc
1. `AGENTS.md` (file này) → `docs/00-README.md` → `docs/01-product-overview.md`
2. **Làm FE:** đọc thêm `docs/09-frontend-conventions.md`, `docs/07-design-system.md`, `docs/08-ui-quality-rules.md`, `docs/11-api-contract.md`
3. **Làm BE:** đọc thêm `docs/10-backend-conventions.md`, `docs/04-database-schema.md`, `docs/05-booking-and-realtime.md`, `docs/11-api-contract.md`
4. **Làm tính năng booking/realtime:** đọc kỹ `docs/05-booking-and-realtime.md` và `docs/06-security-and-permissions.md`
5. **Trước khi merge:** đọc `docs/14-github-workflow.md` và checklist trong `docs/08-ui-quality-rules.md`

## 10 Quy tắc Tối thượng (KHÔNG ĐƯỢC VI PHẠM)

| # | Quy tắc |
|---|---------|
| 1 | **Không tin client.** Mọi validate giá, quyền, trạng thái booking phải thực hiện ở BE. |
| 2 | **Chống trùng lịch ở DB.** EXCLUDE constraint là tuyến phòng thủ cuối; không dựa vào kiểm tra ở service hoặc client. |
| 3 | **Mọi thay đổi DB qua migration có version.** Không sửa schema bằng tay trên production hoặc staging. |
| 4 | **Nghiệp vụ chỉ ở `apps/api`.** FE không chứa logic tính giá, tạo booking, phân quyền. |
| 5 | **Type dùng chung ở `packages/shared`.** Không duplicate kiểu dữ liệu hoặc hằng số trạng thái giữa FE và BE. |
| 6 | **Không hard-code style ngoài token.** Chỉ dùng CSS variables và class Tailwind đã định nghĩa trong design system. |
| 7 | **Không dùng emoji làm icon UI.** Chỉ dùng Lucide với kích thước và stroke cố định. |
| 8 | **UI phải đủ trạng thái.** Mọi component cần có: loading (skeleton), empty, error, disabled, hover, focus-visible. |
| 9 | **Không thêm dependency khi chưa ghi vào decision log** (`docs/18-decision-log.md`). |
| 10 | **Test bắt buộc cho booking/giá/phân quyền.** Không merge code booking mới nếu chưa có unit test + test đồng thời. Không commit secret vào repo. Mỗi lần chỉ làm một issue và tạo PR theo `docs/14-github-workflow.md`. |

## Nhánh làm việc
- **`develop`** – nhánh tích hợp, mặc định. Mọi nhánh `feat/`, `fix/`, `docs/`, `chore/` tách từ đây và PR về đây.
- **`main`** – nhánh phát hành, chỉ nhận merge từ `develop` khi tới mốc phát hành/demo.
- **Nghiêm cấm** push trực tiếp vào `develop` hoặc `main`; chi tiết ở `docs/14-github-workflow.md`.

## Lệnh phát triển

```bash
# Cài đặt (monorepo pnpm)
pnpm install

# Chạy dev (tất cả apps)
pnpm dev

# Chạy từng app
pnpm --filter @bsc/web dev       # FE Next.js – http://localhost:3000
pnpm --filter @bsc/api dev       # BE NestJS  – http://localhost:3001

# Dựng PostgreSQL local (nếu không dùng Neon)
docker compose up -d

# Build
pnpm build
pnpm --filter @bsc/web build
pnpm --filter @bsc/api build

# Test
pnpm test                         # Tất cả
pnpm --filter @bsc/api test       # Unit + API
pnpm --filter @bsc/web test       # Unit FE
pnpm test:e2e                     # E2E Playwright (cần DB + BE + FE đang chạy)

# Lint + typecheck
pnpm lint
pnpm typecheck

# Migration DB
pnpm --filter @bsc/api db:migrate
pnpm --filter @bsc/api db:seed    # Dữ liệu mẫu để phát triển
pnpm --filter @bsc/api db:studio  # Drizzle Studio
```

## Thứ tự đọc tài liệu

1. `docs/00-README.md` – mục lục
2. `docs/01` → `docs/04` – nghiệp vụ, tính năng, kiến trúc, schema
3. `docs/05` → `docs/06` – booking/realtime, bảo mật
4. `docs/07` → `docs/09` – design system, UI, frontend
5. `docs/10` → `docs/12` – backend, API, coding standards
6. `docs/13` → `docs/16` – deploy, GitHub workflow, lộ trình, backlog
7. `docs/17` → `docs/18` – báo cáo, decision log
