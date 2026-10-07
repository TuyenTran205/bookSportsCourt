# 15 – Phân công & Lộ trình

> **Phiên bản:** 1.1.0 | **Cập nhật lần cuối:** 2026-10-07
>
> **Giả định:** 12 tuần khả dụng (điền thông tin thực tế vào mục Giả định ở cuối).

## Phân công vai trò

| Thành viên | Vai trò chính | Phụ trách |
|-----------|---------------|-----------|
| **TV1** (BE) | Backend Core | Auth, phân quyền (JWT, OAuth, Guard), Venue/Court CRUD, Pricing Rules, Migration DB |
| **TV2** (BE) | Backend Booking | Booking (hold, confirm, cancel), chống trùng lịch, giữ chỗ, Cron expire, Realtime Socket.IO, Payment adapter |
| **TV3** (FE) | Frontend Customer | Trang tìm sân, SlotGrid, Checkout, Lịch sử booking, Trang chi tiết sân, Bản đồ |
| **TV4** (FE+DevOps) | Frontend Owner/Admin + DevOps | Design system, OwnerTimeline, Dashboard Owner, Trang Admin, CI/CD, Deploy |

## Bảng phụ thuộc (Ai phụ thuộc ai)

| Phụ thuộc | Cần xong trước | Người phụ trách |
|-----------|---------------|-----------------|
| TV3 cần Auth API | TV1 hoàn thành auth endpoints | TV1 → TV3 |
| TV3 cần Venue/Slot API | TV1 venue + TV2 slots | TV1+TV2 → TV3 |
| TV2 cần schema Booking | TV1 migration DB base | TV1 → TV2 |
| TV4 cần design tokens | TV4 tự thiết lập trước | TV4 là unblocked |
| TV4 admin cần user/venue API | TV1 hoàn thành | TV1 → TV4 |
| TV2 Payment cần Booking confirmed | TV2 booking flow | TV2 → TV2 |

### Mốc chốt OpenAPI (QUAN TRỌNG)
Trước khi FE bắt đầu tích hợp API, BE phải publish OpenAPI spec:

| Mốc | Deadline | API cần sẵn sàng |
|-----|---------|-----------------|
| **OpenAPI-1** | Cuối Phase 1 | Auth, Venues, Courts |
| **OpenAPI-2** | Giữa Phase 2 | Bookings (hold, confirm, cancel), Slots |
| **OpenAPI-3** | Đầu Phase 4 | Payments, Reviews, Admin |

## Lộ trình theo Phase (12 tuần)

### Phase 0 – Setup & Foundation (Tuần 1-2)
**Milestone GitHub:** `phase-0-setup`

| # | Việc | Người | Estimate |
|---|------|-------|---------|
| 1 | Khởi tạo monorepo pnpm + Turborepo | TV4 | S |
| 2 | Setup Next.js + NestJS + packages/shared | TV4 | M |
| 3 | Setup ESLint + Prettier + TypeScript strict | TV4 | S |
| 4 | CI/CD pipeline (GitHub Actions) | TV4 | M |
| 5 | Docker Compose local (PostgreSQL) | TV1 | S |
| 6 | Drizzle setup + migration scaffold | TV1 | S |
| 7 | Design tokens + shadcn/ui setup | TV4 | M |
| 8 | Env management (.env.example) | TV4 | S |

**Tiêu chí hoàn thành:** `pnpm dev` chạy được cả 2 apps, CI pass.

**Rủi ro:** Cấu hình monorepo phức tạp → TV4 xử lý trước tuần 1.

---

### Phase 1 – Auth, Venue, Search (Tuần 3-4)
**Milestone GitHub:** `phase-1-auth-venue`

| # | Việc | Người | Estimate |
|---|------|-------|---------|
| 9 | Schema DB: users, venues, courts, sports, amenities | TV1 | M |
| 10 | Auth API: register, login, logout, refresh | TV1 | M |
| 11 | JWT Guard + RolesGuard + OwnershipGuard | TV1 | M |
| 12 | Venue CRUD API + Admin approve | TV1 | M |
| 13 | Court CRUD + Opening Hours + Pricing Rules API | TV1 | L |
| 14 | Trang đăng nhập/đăng ký FE | TV3 | M |
| 15 | Header + Footer + Layout trang khách | TV4 | M |
| 16 | Trang tìm sân: search, filter, danh sách | TV3 | L |
| 17 | Bản đồ Leaflet | TV3 | M |
| 18 | Trang chi tiết Venue | TV3 | M |

**Tiêu chí hoàn thành:** Đăng nhập được, tìm kiếm venue, xem chi tiết. OpenAPI-1 published.

**Rủi ro:** TV1 phải hoàn thành auth trước để TV3 bắt đầu.

---

### Phase 2 – Booking & Realtime (Tuần 5-7)
**Milestone GitHub:** `phase-2-booking-realtime`

| # | Việc | Người | Estimate |
|---|------|-------|---------|
| 19 | Schema DB: bookings (EXCLUDE), blackouts | TV2 | M |
| 20 | BookingService: hold (với expire trong transaction) | TV2 | L |
| 21 | Cron expire holds mỗi phút | TV2 | S |
| 22 | Socket.IO Gateway realtime | TV2 | M |
| 23 | Booking cancel + status transitions | TV2 | M |
| 24 | SlotGrid component (chọn block, drag select) | TV3 | L |
| 25 | HoldCountdown + Sticky summary bar | TV3 | M |
| 26 | Trang checkout (BookingSummary) | TV3 | M |
| 27 | Trang lịch sử booking | TV3 | M |
| 28 | Test đồng thời N request cùng block | TV2 | M |

**Tiêu chí hoàn thành:** Đặt sân được, realtime cập nhật, test race condition pass. OpenAPI-2 published.

**Rủi ro:** EXCLUDE constraint + transaction là phần phức tạp nhất → TV2 ưu tiên test kỹ.

---

### Phase 3 – Owner Dashboard (Tuần 8)
**Milestone GitHub:** `phase-3-owner`

| # | Việc | Người | Estimate |
|---|------|-------|---------|
| 29 | OwnerTimeline component | TV4 | L |
| 30 | Dashboard Owner: venue/court management | TV4 | M |
| 31 | Booking thủ công (Owner) | TV2 | M |
| 32 | Blackout Period API + UI | TV1+TV4 | M |
| 33 | Báo cáo doanh thu API (P1) | TV2 | M |

**Tiêu chí hoàn thành:** Owner quản lý được sân, xem OwnerTimeline, tạo booking thủ công.

---

### Phase 4 – Admin, Payment, Email (Tuần 9-10)
**Milestone GitHub:** `phase-4-admin-payment`

| # | Việc | Người | Estimate |
|---|------|-------|---------|
| 34 | Admin Dashboard: duyệt owner/venue | TV4 | M |
| 35 | Admin: user management, audit log | TV4 | M |
| 36 | Thanh toán chuyển khoản QR: sinh QR, upload ảnh chứng minh | TV2 | L |
| 37 | Owner duyệt/từ chối thanh toán + cron huỷ quá hạn | TV2 | M |
| 38 | Email thông báo (Resend) | TV1 | M |
| 39 | Đánh giá sân | TV3 | M |
| 40 | Google OAuth | TV1 | M |

**Tiêu chí hoàn thành:** Admin hoạt động, luồng thanh toán QR + Owner duyệt chạy được, email đi được. OpenAPI-3 published.

---

### Phase 5 – Hoàn thiện, Test, Deploy (Tuần 11-12)
**Milestone GitHub:** `phase-5-finalize`

| # | Việc | Người | Estimate |
|---|------|-------|---------|
| 41 | E2E test Playwright (flow đặt sân) | TV3 | L |
| 42 | Test demo 2 trình duyệt race condition | TV2+TV3 | M |
| 43 | SEO: metadata, structured data | TV3 | S |
| 44 | Deploy lên Vercel + Railway | TV4 | M |
| 45 | Seed dữ liệu demo | TV1 | S |
| 46 | Quay video demo | Cả nhóm | M |
| 47 | Viết báo cáo (dựa theo `17-report-outline.md`) | Cả nhóm | L |

---

### Phase 6 – Mobile (TÙY CHỌN, sau nộp bài)
**Milestone GitHub:** `phase-6-mobile`
- React Native / Expo: chỉ phần khách đặt sân.
- Không làm song song với Phase 0-5.

## Giả định

- Ngày bắt đầu: **[chưa điền]** → Giả định tuần 1 = tuần đầu học kỳ.
- Ngày demo/nộp bài: **[chưa điền]** → Giả định 12 tuần sau ngày bắt đầu.
- Thành viên và GitHub username: **[chưa điền]** → Dùng placeholder TV1/TV2/TV3/TV4.
