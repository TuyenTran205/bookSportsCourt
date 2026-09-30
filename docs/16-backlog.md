# 16 – Backlog

> **Phiên bản:** 1.0.0 | **Cập nhật lần cuối:** 2026-09-30
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
| BSC-042 | VietQR sandbox payment adapter | CUS-09 | `type:feature` `area:api` `prio:P1` `phase:4` | TV2 | L | BSC-024 |
| BSC-043 | Webhook thanh toán idempotent | CUS-09 | `type:feature` `area:api` `prio:P1` `phase:4` | TV2 | M | BSC-042 |
| BSC-044 | FE: Trang thanh toán VietQR QR | CUS-09 | `type:feature` `area:web` `prio:P1` `phase:4` | TV3 | M | BSC-042 |
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
