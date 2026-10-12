# 16 – Backlog

> **Phiên bản:** 1.2.0 | **Cập nhật lần cuối:** 2026-10-12
>
> Danh sách issue sẵn sàng tạo trên GitHub. Mã tính năng khớp với `02-features-by-role.md`.

## Phase 0 – Setup & Foundation

| # | Tiêu đề | Mã | Labels | Assignee | Size | Phụ thuộc |
|---|---------|----|----|---------|------|-----------|
| BSC-001 | Khởi tạo monorepo pnpm + Turborepo | — | `type:task` `area:infra` `prio:P0` `phase:0` | TV4 | M | — |
| BSC-002 | Setup Next.js App Router (apps/web) | — | `type:task` `area:web` `prio:P0` `phase:0` | TV4 | M | BSC-001 |
| BSC-003 | Setup NestJS (apps/api) | — | `type:task` `area:api` `prio:P0` `phase:0` | TV4 | M | BSC-001 |
| BSC-004 | Setup packages/shared (Zod, types) | — | `type:task` `area:shared` `prio:P0` `phase:0` | TV4 | S | BSC-001 |
| BSC-005 | Setup ESLint + Prettier + TS strict | — | `type:chore` `area:infra` `prio:P0` `phase:0` | TV4 | S | BSC-001 |
| BSC-006 | CI workflow: lint, typecheck, test, build | — | `type:task` `area:infra` `prio:P0` `phase:0` | TV4 | M | BSC-002 BSC-003 |
| BSC-007 | Docker Compose local (PostgreSQL + btree_gist) | — | `type:task` `area:db` `prio:P0` `phase:0` | TV1 | S | — |
| BSC-008 | Drizzle ORM setup + migration scaffold | — | `type:task` `area:db` `prio:P0` `phase:0` | TV1 | S | BSC-007 |
| BSC-009 | Setup shadcn/ui + design tokens + globals.css | — | `type:task` `area:design` `prio:P0` `phase:0` | TV4 | M | BSC-002 |

## Phase 1 – Auth, Venue, Search

| # | Tiêu đề | Mã | Labels | Assignee | Size | Phụ thuộc |
|---|---------|----|----|---------|------|-----------|
| BSC-010 | Schema DB v1: users, venues, courts, sports, amenities | — | `type:task` `area:db` `prio:P0` `phase:1` | TV1 | M | BSC-008 |
| BSC-011 | Auth API: đăng ký / đăng nhập / đăng xuất | CUS-01 CUS-02 | `type:feature` `area:api` `prio:P0` `phase:1` | TV1 | M | BSC-010 |
| BSC-012 | Refresh token xoay vòng + revoke | CUS-02 | `type:feature` `area:api` `prio:P0` `phase:1` | TV1 | M | BSC-011 |
| BSC-013 | JWT Guard + RolesGuard + OwnershipGuard | — | `type:task` `area:api` `prio:P0` `phase:1` | TV1 | M | BSC-012 |
| BSC-014 | Venue CRUD API (Owner tạo, Admin duyệt) | OWN-02 ADM-02 | `type:feature` `area:api` `prio:P0` `phase:1` | TV1 | M | BSC-013 |
| BSC-015 | Court CRUD + Opening Hours + Pricing Rules API | OWN-03 OWN-04 OWN-05 | `type:feature` `area:api` `prio:P0` `phase:1` | TV1 | L | BSC-014 |
| BSC-016 | Sports + Amenities + Areas CRUD (Admin) | ADM-04 ADM-05 ADM-06 | `type:feature` `area:api` `prio:P0` `phase:1` | TV1 | M | BSC-013 |
| BSC-017 | Venue search API (filter: sport, district, price) | CUS-04 | `type:feature` `area:api` `prio:P0` `phase:1` | TV1 | M | BSC-014 |
| BSC-018 | FE: Trang đăng nhập / đăng ký | CUS-01 CUS-02 | `type:feature` `area:web` `prio:P0` `phase:1` | TV3 | M | BSC-011 |
| BSC-019 | FE: Header + Footer + Layout trang khách | — | `type:task` `area:web` `prio:P0` `phase:1` | TV4 | M | BSC-009 |
| BSC-020 | FE: Trang tìm sân + danh sách kết quả | CUS-04 | `type:feature` `area:web` `prio:P0` `phase:1` | TV3 | L | BSC-017 BSC-019 |
| BSC-021 | FE: Bản đồ Leaflet + OSM | CUS-05 | `type:feature` `area:web` `prio:P0` `phase:1` | TV3 | M | BSC-020 |
| BSC-022 | FE: Trang chi tiết Venue + gallery | CUS-06 | `type:feature` `area:web` `prio:P0` `phase:1` | TV3 | M | BSC-014 |

## Phase 2 – Booking & Realtime

| # | Tiêu đề | Mã | Labels | Assignee | Size | Phụ thuộc |
|---|---------|----|----|---------|------|-----------|
| BSC-023 | Schema DB v2: bookings (EXCLUDE), payments, blackouts | — | `type:task` `area:db` `prio:P0` `phase:2` | TV2 | M | BSC-010 |
| BSC-024 | BookingService: createHold với expire trong transaction | CUS-08 | `type:feature` `area:api` `prio:P0` `phase:2` | TV2 | L | BSC-023 |
| BSC-025 | Cron job expire holds (mỗi phút) | — | `type:feature` `area:api` `prio:P0` `phase:2` | TV2 | S | BSC-024 |
| BSC-026 | Socket.IO Gateway + realtime slot update | CUS-07 | `type:feature` `area:api` `prio:P0` `phase:2` | TV2 | M | BSC-024 |
| BSC-027 | Slots API: GET /venues/:id/slots?date= | CUS-07 | `type:feature` `area:api` `prio:P0` `phase:2` | TV2 | M | BSC-024 |
| BSC-028 | Booking cancel + status transitions | CUS-11 | `type:feature` `area:api` `prio:P1` `phase:2` | TV2 | M | BSC-024 |
| BSC-029 | Test race condition: N request cùng block | — | `type:task` `area:api` `prio:P0` `phase:2` | TV2 | M | BSC-024 |
| BSC-030 | FE: SlotGrid component (drag select, realtime, giá) | CUS-07 | `type:feature` `area:web` `prio:P0` `phase:2` | TV3 | L | BSC-026 BSC-027 |
| BSC-031 | FE: HoldCountdown + Sticky summary bar | CUS-08 | `type:feature` `area:web` `prio:P0` `phase:2` | TV3 | M | BSC-030 |
| BSC-032 | FE: Trang Checkout (BookingSummary) | CUS-08 | `type:feature` `area:web` `prio:P0` `phase:2` | TV3 | M | BSC-031 |
| BSC-033 | FE: Trang lịch sử booking | CUS-10 | `type:feature` `area:web` `prio:P0` `phase:2` | TV3 | M | BSC-024 |

## Phase 3 – Owner Dashboard

| # | Tiêu đề | Mã | Labels | Assignee | Size | Phụ thuộc |
|---|---------|----|----|---------|------|-----------|
| BSC-034 | FE: OwnerTimeline component | OWN-06 | `type:feature` `area:web` `prio:P0` `phase:3` | TV4 | L | BSC-027 |
| BSC-035 | FE: Dashboard Owner – quản lý venue/court | OWN-02 OWN-03 | `type:feature` `area:web` `prio:P0` `phase:3` | TV4 | M | BSC-034 |
| BSC-036 | Booking thủ công API (Owner) | OWN-07 | `type:feature` `area:api` `prio:P0` `phase:3` | TV2 | M | BSC-024 |
| BSC-037 | FE: Tạo booking thủ công qua timeline | OWN-07 | `type:feature` `area:web` `prio:P0` `phase:3` | TV4 | M | BSC-034 BSC-036 |
| BSC-038 | Blackout Period API + FE | OWN-08 | `type:feature` `area:api` `area:web` `prio:P0` `phase:3` | TV1 TV4 | M | BSC-023 |
| BSC-039 | Báo cáo doanh thu API + FE chart | OWN-11 | `type:feature` `area:api` `area:web` `prio:P1` `phase:3` | TV2 TV4 | L | BSC-024 |

## Phase 4 – Admin, Payment, Email

| # | Tiêu đề | Mã | Labels | Assignee | Size | Phụ thuộc |
|---|---------|----|----|---------|------|-----------|
| BSC-040 | FE: Admin Dashboard – duyệt owner/venue | ADM-01 ADM-02 | `type:feature` `area:web` `prio:P0` `phase:4` | TV4 | M | BSC-016 |
| BSC-041 | FE: Admin – quản lý user, audit log | ADM-03 ADM-09 | `type:feature` `area:web` `prio:P0` `phase:4` | TV4 | M | BSC-040 |
| BSC-042 | Thanh toán QR: chuyển khoản qua QR chủ sân, upload ảnh xác nhận | CUS-09 | `type:feature` `area:api` `prio:P0` `phase:4` | TV2 | L | BSC-024 |
| BSC-043 | Owner duyệt/từ chối thanh toán idempotent + cron huỷ quá hạn | CUS-09 OWN-09 | `type:feature` `area:api` `prio:P0` `phase:4` | TV2 | M | BSC-042 |
| BSC-044 | FE: Trang thanh toán QR + tải ảnh; trang Owner duyệt | CUS-09 OWN-09 | `type:feature` `area:web` `prio:P0` `phase:4` | TV3 | M | BSC-042 |
| BSC-045 | Email thông báo (Resend) | CUS-14 OWN-14 | `type:feature` `area:api` `prio:P1` `phase:4` | TV1 | M | BSC-024 |
| BSC-046 | Đánh giá sân API + FE | CUS-13 | `type:feature` `area:api` `area:web` `prio:P1` `phase:4` | TV3 | M | BSC-024 |
| BSC-047 | Google OAuth | CUS-03 | `type:feature` `area:api` `area:web` `prio:P1` `phase:4` | TV1 | M | BSC-011 |

## Phase 5 – Hoàn thiện & Deploy

| # | Tiêu đề | Mã | Labels | Assignee | Size | Phụ thuộc |
|---|---------|----|----|---------|------|-----------|
| BSC-048 | E2E test Playwright: flow đặt sân | — | `type:task` `area:web` `prio:P0` `phase:5` | TV3 | L | BSC-032 |
| BSC-049 | SEO: generateMetadata, structured data | — | `type:chore` `area:web` `prio:P1` `phase:5` | TV3 | M | BSC-020 |
| BSC-050 | Deploy FE lên Vercel + BE lên Railway | — | `type:task` `area:infra` `prio:P0` `phase:5` | TV4 | M | — |
| BSC-051 | Seed dữ liệu demo thực tế | — | `type:task` `area:db` `prio:P0` `phase:5` | TV1 | S | BSC-050 |
| BSC-052 | Sentry integration FE + BE | — | `type:chore` `area:infra` `prio:P1` `phase:5` | TV4 | S | BSC-050 |

## Bổ sung – work item còn thiếu

> Phần này bù các khoảng trống đã phát hiện khi đối chiếu backlog với `02-features-by-role.md` (39 mã tính năng) và `04-database-schema.md` (24 bảng). Trước khi bổ sung, backlog chỉ phủ 30/39 mã và 8/24 bảng.
>
> **Không** tạo issue trùng cho `CUS-14`, `ADM-04`, `ADM-05`, `ADM-06` — chúng đã có ở BSC-045 và BSC-016.

### Schema còn thiếu (C38)

| # | Tiêu đề | Mã | Labels | Assignee | Size | Phụ thuộc |
|---|---------|----|----|---------|------|-----------|
| BSC-053 | Schema DB: bảng auth còn lại (`oauth_accounts`, `refresh_tokens`, `auth_tokens`) | CUS-03 CUS-16 | `type:task` `area:db` `prio:P0` `phase:1` | TV2 | M | BSC-010 |
| BSC-054 | Schema DB: `areas` (danh mục khu vực) | ADM-06 | `type:task` `area:db` `prio:P0` `phase:1` | TV2 | S | BSC-010 |
| BSC-055 | Schema DB: `venue_images`, `venue_sports`, `venue_amenities` | OWN-02 | `type:task` `area:db` `prio:P0` `phase:1` | TV2 | S | BSC-010 |
| BSC-056 | Schema DB: `opening_hours`, `pricing_rules` | OWN-04 OWN-05 | `type:task` `area:db` `prio:P0` `phase:1` | TV2 | M | BSC-010 |
| BSC-057 | Schema DB: `venue_payment_accounts`, `cancellation_policies` | OWN-09 OWN-10 | `type:task` `area:db` `prio:P0` `phase:1` | TV2 | S | BSC-010 |
| BSC-058 | Schema DB: `owner_applications` | OWN-01 | `type:task` `area:db` `prio:P0` `phase:1` | TV2 | S | BSC-010 |
| BSC-059 | Schema DB: `reviews`, `favorites`, `notifications`, `audit_logs` | CUS-12 CUS-13 | `type:task` `area:db` `prio:P0` `phase:2` | TV2 | M | BSC-010 |
| BSC-060 | Trigger đồng bộ cột cache `venues.rating_avg/review_count/from_price` | — | `type:task` `area:db` `prio:P0` `phase:2` | TV2 | M | BSC-059 |
| BSC-061 | Trigger chặn booking trong `blackout_periods` ở tầng DB | OWN-08 | `type:task` `area:db` `prio:P0` `phase:2` | TV2 | S | BSC-023 |

### Tính năng còn thiếu issue (C37)

| # | Tiêu đề | Mã | Labels | Assignee | Size | Phụ thuộc |
|---|---------|----|----|---------|------|-----------|
| BSC-062 | Đăng ký làm chủ sân (owner application) API + FE | OWN-01 | `type:feature` `area:api` `area:web` `prio:P0` `phase:1` | TV1 | M | BSC-058 |
| BSC-063 | Xem và chỉnh sửa hồ sơ cá nhân API + FE | CUS-15 | `type:feature` `area:api` `area:web` `prio:P0` `phase:1` | TV1 | S | BSC-010 |
| BSC-064 | Yêu thích sân API + FE | CUS-12 | `type:feature` `area:api` `area:web` `prio:P1` `phase:2` | TV3 | S | BSC-059 |
| BSC-065 | Chính sách huỷ & cọc (cấu hình Owner + áp dụng khi huỷ) | OWN-10 CUS-11 | `type:feature` `area:api` `area:web` `prio:P1` `phase:3` | TV2 | M | BSC-057 |
| BSC-066 | Báo cáo tỷ lệ lấp đầy (Owner) | OWN-12 | `type:feature` `area:api` `area:web` `prio:P1` `phase:3` | TV4 | M | BSC-036 |
| BSC-067 | Owner quản lý đánh giá (ẩn/hiện, phản hồi) | OWN-13 | `type:feature` `area:api` `area:web` `prio:P1` `phase:3` | TV3 | M | BSC-059 |
| BSC-068 | Admin: xem toàn bộ booking + lọc | ADM-07 | `type:feature` `area:api` `area:web` `prio:P0` `phase:4` | TV4 | M | BSC-023 |
| BSC-069 | Admin: thống kê toàn hệ thống | ADM-08 | `type:feature` `area:api` `area:web` `prio:P0` `phase:4` | TV4 | M | BSC-023 |
| BSC-070 | Admin API: khoá / mở khoá tài khoản | ADM-03 | `type:feature` `area:api` `prio:P0` `phase:4` | TV1 | S | BSC-010 |
| BSC-071 | Audit log middleware + ghi vết hành động Admin | ADM-09 | `type:feature` `area:api` `prio:P0` `phase:4` | TV1 | M | BSC-059 |
| BSC-072 | Admin: kiểm duyệt đánh giá (ẩn/hiện) | ADM-10 | `type:feature` `area:api` `area:web` `prio:P1` `phase:4` | TV3 | M | BSC-059 |

### Hạ tầng & vòng đời còn thiếu (C37, C40)

| # | Tiêu đề | Mã | Labels | Assignee | Size | Phụ thuộc |
|---|---------|----|----|---------|------|-----------|
| BSC-073 | Health endpoint `GET /api/v1/health` (không auth, `SELECT 1`) | — | `type:feature` `area:api` `prio:P0` `phase:1` | TV1 | S | — |
| BSC-074 | Upload R2 presigned URL | OWN-02 | `type:feature` `area:api` `prio:P0` `phase:1` | TV2 | M | BSC-010 |
| BSC-075 | Rate limiting (`@nestjs/throttler`) cho auth + hold | — | `type:task` `area:api` `prio:P0` `phase:1` | TV1 | S | BSC-010 |
| BSC-076 | Quên / đặt lại mật khẩu | CUS-16 | `type:feature` `area:api` `area:web` `prio:P1` `phase:4` | TV1 | M | BSC-053 |
| BSC-077 | Cron auto-complete booking (`confirmed` → `completed`) | — | `type:feature` `area:api` `prio:P0` `phase:2` | TV2 | S | BSC-024 |
| BSC-078 | Cron nhắc lịch trước 24h (`reminders_sent_at`) | CUS-14 | `type:feature` `area:api` `prio:P1` `phase:2` | TV2 | S | BSC-024 |
| BSC-079 | Cron dọn dữ liệu hết hạn (auth_tokens, notifications, audit_logs) | — | `type:task` `area:api` `prio:P1` `phase:5` | TV2 | S | BSC-059 |
| BSC-080 | `middleware.ts` chặn route theo role + `providers.tsx` | — | `type:feature` `area:web` `prio:P0` `phase:1` | TV3 | M | BSC-013 |
| BSC-081 | Dựng môi trường staging (Vercel Preview + Railway staging + Neon branch) | — | `type:chore` `area:infra` `prio:P1` `phase:5` | TV4 | M | BSC-050 |

> **Vì sao BSC-077 ở P0:** không có nó thì `completed` là trạng thái không thể đạt tới, khiến CUS-13 (đánh giá, chỉ cho booking `completed`) và OWN-09 (đánh số no-show) vĩnh viễn không dùng được. Xem [05-booking-and-realtime.md](05-booking-and-realtime.md).
>
> **Vì sao BSC-073 ở P0:** `keep-alive.yml` và UptimeRobot đều ping `/api/v1/health`; thiếu endpoint này thì không có cách chống Neon/Railway sleep.
