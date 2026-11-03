# ĐẶC TẢ KỸ THUẬT: HOÀN THIỆN FRONTEND BATCH 2 (E2E PLAYWRIGHT + GIỜ MỞ CỬA + DUYỆT ĐÁNH GIÁ + TRANG THÔNG BÁO)

- **Mã tài liệu:** `SPEC-FE-BATCH2-01`
- **Tác giả:** Product Architect & UX Specifier (`ba-spec` - 9router_BA)
- **Dự án:** BookSportsCourt (Sàn thương mại điện tử đặt sân thể thao đa người dùng)
- **Nền tảng mục tiêu:** Web Client (`apps/web` - Next.js 14 App Router, TypeScript, Tailwind CSS, TanStack Query, MSW, Playwright)
- **Trạng thái:** Approved / Sẵn sàng bàn giao cho `senior-dev` (9router_DEV)
- **Tham chiếu:**
    - `AGENTS.md` (10 quy tắc tối thượng)
    - `G:\Slides_BaiGiangTLU\ChuyenDeCNTT\danh-sach-cong-viec-hoan-thien-frontend.md` (TODO-03, TODO-07, TODO-06, TODO-08)
    - `docs/02-features-by-role.md` (GST-02, GST-03, ADM-10, CUS-14, OWN-06)
    - `docs/05-booking-and-realtime.md` (Vòng đời booking & thanh toán)
    - `docs/07-design-system.md` & `docs/08-ui-quality-rules.md` (Anti-AI Design & UI Rules)
    - `docs/09-frontend-conventions.md` & `docs/11-api-contract.md` (API contracts & Route Guards)

---

## 1. Tổng quan & Mục tiêu Kỹ thuật BATCH 2

Batch 2 hoàn thiện 4 hạng mục trọng tâm còn lại của Frontend nhằm đạt 100% tiêu chí nghiệm thu đồ án:

| STT | Mã việc     | Tên việc cần làm                                            | Mức độ | Phạm vi giải quyết                                                                                                                                                                                                                                                                                                                                      |
| :-: | :---------- | :---------------------------------------------------------- | :----: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
|  1  | **TODO-03** | Thiết lập bộ kiểm thử E2E Playwright thực tế                | **P0** | Dựng cấu hình `playwright.config.ts`, cập nhật script `test:e2e` trong `package.json`, viết 3 kịch bản E2E cốt lõi (`guest-booking.spec.ts`, `owner-management.spec.ts`, `admin-moderation.spec.ts`), đảm bảo CI workflow chạy test thật thay vì lệnh `echo` giữ chỗ.                                                                                   |
|  2  | **TODO-07** | Hiển thị bảng giờ mở cửa tại trang chi tiết sân (GST-02/03) | **P1** | Đọc dữ liệu `openingHours` từ chi tiết venue, xây dựng component `VenueOpeningHours.tsx` chuẩn Linear/Stripe hiển thị 7 ngày trong tuần, tự động highlight trực quan ngày hôm nay, xử lý ngày đóng cửa.                                                                                                                                                 |
|  3  | **TODO-06** | Xây dựng màn hình kiểm duyệt đánh giá cho Admin (ADM-10)    | **P1** | Xây dựng route `apps/web/app/(admin)/admin/reviews/page.tsx` và component `AdminReviewsScreen.tsx`. Bổ sung handler MSW `GET /api/v1/admin/reviews` và `PATCH /api/v1/admin/reviews/:id/visibility`. Tích hợp bộ lọc (cơ sở, số sao, trạng thái ẩn/hiện, tìm kiếm), dialog xác nhận ẩn/hiện an toàn, thêm menu vào `ADMIN_NAV`.                         |
|  4  | **TODO-08** | Xây dựng trang thông báo đầy đủ `/notifications` (CUS-14)   | **P1** | Xây dựng route `apps/web/app/(customer)/notifications/page.tsx` và component `NotificationsScreen.tsx`. Bổ sung bảo vệ route trong `middleware.ts`. Cung cấp bộ lọc phân loại (Tất cả, Đặt sân, Thanh toán, Hệ thống), đánh dấu đã đọc, đánh dấu tất cả đã đọc, điều hướng đến booking liên quan, bổ sung link "Xem tất cả" tại `NotificationBell.tsx`. |

---

## 2. Tiêu chuẩn Thiết kế Anti-AI (Strict Anti-AI Rules)

Tuân thủ nghiêm ngặt theo `docs/07-design-system.md`, `docs/08-ui-quality-rules.md` và `AGENTS.md`:

| Tiêu chí                     | ❌ HÀNH VI CẤM (AI Slop / Cliche)                                                                                   | ✅ CHUẨN THIẾT KẾ DỰ ÁN (Linear / Stripe Standard)                                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Màu sắc & Gradient**       | CẤM gradient tím/hồng/xanh neon (`from-purple-500 to-pink-500`), cấm hiệu ứng glassmorphism mờ đục lòe loẹt.        | 100% màu sắc lấy từ CSS tokens: Nền trắng `#ffffff`, nền phụ `#f8fafc` (`neutral-50`), viền mỏng 1px `#e2e8f0` (`neutral-200`), text chính `#0f172a` (`neutral-900`), thương hiệu `#15803d` (`primary-700`). |
| **Bo góc (Border Radius)**   | CẤM bo góc dị dạng `rounded-3xl` cho card hoặc modal. CẤM bo tròn toàn bộ nút bấm `rounded-full` một cách tùy tiện. | Button / Input: `rounded-btn` (8px). Card / Panel: `rounded-card` (8px). Dialog: `rounded-xl` (12px). Badge nhỏ: `rounded-md` (6px) hoặc `rounded-full` cho badge tròn.                                      |
| **Biểu tượng (Icons)**       | CẤM chèn emoji rác (⏰, 💬, 🔔, 🚀, ✨, ⚠️, ❌) vào nút bấm, tiêu đề hoặc văn bản UI.                               | 100% biểu tượng dùng `lucide-react` cố định kích thước (`size-4`, `size-5`), nét stroke 1.5px.                                                                                                               |
| **Hộp thoại tương tác**      | CẤM dùng `window.alert()`, `window.confirm()` hoặc `window.prompt()`.                                               | Sử dụng `<Dialog>` Radix UI accessible với tiêu đề, mô tả rõ ràng, nút hủy (outline) và nút xác nhận (primary/danger).                                                                                       |
| **Trạng thái Component**     | Thiếu các trạng thái tương tác hoặc chỉ xoay vòng vô hạn.                                                           | Đủ 6 trạng thái bắt buộc: `Default`, `Hover`, `Focus-visible` (ring outline 2px), `Loading` (skeleton/spinner), `Disabled` (opacity 50%, cursor-not-allowed), `Empty` / `Error`.                             |
| **Vùng chạm (Touch Target)** | Vùng chạm nhỏ hơn 44px trên thiết bị di động.                                                                       | Nút phân trang, nút đóng mở, nút thao tác bảng: bảo đảm chiều cao tối thiểu `min-h-9` hoặc `min-h-11` trên mobile.                                                                                           |

---

## 3. Chi tiết Kỹ thuật từng Đầu việc

---

### 3.1. [TODO-03] Dựng Bộ Kiểm Thử E2E Playwright Thực Tế

#### 3.1.1. Hiện trạng & Vấn đề

- `apps/web/package.json` đã có `@playwright/test: "^1.49.1"` trong `devDependencies`.
- Tuy nhiên script `"test:e2e"` hiện chỉ là lệnh `echo "..." && exit 0`.
- Chưa có file cấu hình `playwright.config.ts`.
- Chưa có thư mục kịch bản `apps/web/e2e/`.
- CI GitHub Actions (`.github/workflows/ci.yml`) đang chạy bước `pnpm test:e2e` nhưng chỉ in chuỗi text ra terminal, không kiểm thử thực tế.

#### 3.1.2. Cấu hình `apps/web/playwright.config.ts`

Tạo mới file `apps/web/playwright.config.ts` với các thông số:

- `testDir`: `'./e2e'`
- `timeout`: `60 * 1000` (60 giây cho mỗi test)
- `expect`: timeout `10 * 1000`
- `fullyParallel`: false (để tránh xung đột dữ liệu MSW và cổng)
- `forbidOnly`: `Boolean(process.env.CI)`
- `retries`: `process.env.CI ? 2 : 0`
- `workers`: `process.env.CI ? 1 : undefined`
- `reporter`: `[['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]`
- `use`:
    - `baseURL`: `process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'`
    - `trace`: `'on-first-retry'`
    - `screenshot`: `'only-on-failure'`
    - `video`: `'retain-on-failure'`
    - `locale`: `'vi-VN'`
    - `timezoneId`: `'Asia/Ho_Chi_Minh'`
- `projects`:
    - `{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }`
- `webServer`:
    ```typescript
    webServer: {
      command: 'pnpm dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    }
    ```

#### 3.1.3. Ba kịch bản E2E cốt lõi (`apps/web/e2e/`)

##### Kịch bản 1: `apps/web/e2e/guest-booking.spec.ts` (Luồng Khách tìm sân & chọn lịch GST-01..03)

- **Mục tiêu:** Kiểm tra luồng người dùng vãng lai tìm kiếm sân, xem chi tiết sân, xem bảng giờ mở cửa, và chọn khung giờ 30 phút.
- **Các bước thực hiện:**
    1. `page.goto('/')`: Kiểm tra render trang chủ thành công, header có logo BookSportsCourt.
    2. Click link "Tìm sân" hoặc truy cập `/venues`.
    3. Kiểm tra danh sách sân xuất hiện, bộ lọc `VenueFilters` hiển thị các trường Tỉnh/thành, Môn thể thao.
    4. Click chọn một sân (ví dụ: "Sân Cầu Lông Thăng Long" `/venues/san-cau-long-thang-long`).
    5. Chờ trang chi tiết tải xong:
        - Kiểm tra tiêu đề cơ sở "Sân Cầu Lông Thăng Long".
        - Kiểm tra khối thông tin giờ hoạt động (TODO-07) hiển thị đầy đủ các ngày trong tuần và badge "Hôm nay".
        - Kiểm tra khối chọn ngày và lưới slot `SlotGrid`.
    6. Click chọn 1-2 slot còn trống (`status = available`).
    7. Kiểm tra panel phía dưới cập nhật số block đã chọn và tổng tiền tạm tính.
    8. Kiểm tra nút thao tác hiển thị "Đăng nhập để tiếp tục" (vì khách chưa có session), click nút kiểm tra điều hướng đúng đến `/login?next=...`.

##### Kịch bản 2: `apps/web/e2e/owner-management.spec.ts` (Luồng Chủ sân quản lý đơn & duyệt OWN-06, OWN-09)

- **Mục tiêu:** Kiểm tra chủ sân đăng nhập, truy cập kênh quản lý, xem đơn đặt sân và kiểm tra thao tác duyệt/no-show.
- **Các bước thực hiện:**
    1. Thiết lập cookie phiên chủ sân:
        ```typescript
        await context.addCookies([
            { name: "bsc_session", value: "019273c5-7f12-7000-8000-000000000001", domain: "localhost", path: "/" },
            { name: "bsc_role", value: "owner", domain: "localhost", path: "/" },
        ]);
        ```
    2. `page.goto('/owner/dashboard')`:
        - Kiểm tra render thành công giao diện `DashboardShell` khu vực Chủ sân.
        - Kiểm tra hiển thị các thẻ KPI thống kê (Doanh thu, Lượt đặt sân, Sân hoạt động).
    3. Click menu "Lịch đặt sân" hoặc truy cập `/owner/bookings`:
        - Kiểm tra bảng danh sách đơn đặt sân render thành công.
        - Kiểm tra có các bộ lọc trạng thái (Tất cả, Đang giữ chỗ, Chờ duyệt, Đã duyệt, Hoàn thành, Đã hủy, No-show).
        - Kiểm tra sự xuất hiện của nút thao tác "Khách không đến (No-show)" hoặc xem chi tiết thanh toán.

##### Kịch bản 3: `apps/web/e2e/admin-moderation.spec.ts` (Luồng Quản trị viên duyệt đánh giá & hệ thống ADM-10, ADM-03)

- **Mục tiêu:** Kiểm tra quyền admin, kiểm duyệt đánh giá vi phạm và giám sát tài khoản.
- **Các bước thực hiện:**
    1. Thiết lập cookie phiên quản trị viên:
        ```typescript
        await context.addCookies([
            { name: "bsc_session", value: "019273c5-7f12-7000-8000-000000000007", domain: "localhost", path: "/" },
            { name: "bsc_role", value: "admin", domain: "localhost", path: "/" },
        ]);
        ```
    2. `page.goto('/admin/dashboard')`:
        - Kiểm tra shell Admin render thành công, menu có đầy đủ: Duyệt chủ sân, Duyệt cơ sở, Người dùng, Quản lý đánh giá, Tất cả đơn, Nhật ký hoạt động.
    3. Truy cập `/admin/reviews` (TODO-06):
        - Kiểm tra bảng danh sách đánh giá render thành công.
        - Kiểm tra cột: Người đánh giá, Cơ sở, Số sao, Nội dung, Trạng thái (Công khai / Đã ẩn).
        - Click nút "Ẩn đánh giá" tại một dòng, kiểm tra Dialog xác nhận xuất hiện.
        - Xác nhận ẩn, kiểm tra toast thông báo thành công và badge trạng thái chuyển sang "Đã ẩn".

#### 3.1.4. Cập nhật `package.json` và CI

- Cập nhật script trong `apps/web/package.json`:
    ```json
    "test:e2e": "playwright test"
    ```
- Kiểm tra file `.github/workflows/ci.yml`:
  Giữ nguyên cấu trúc job `e2e` hiện có (chạy `pnpm test:e2e` sau khi build).

---

### 3.2. [TODO-07] Bảng Giờ Mở Cửa Tại Trang Chi Tiết Sân (GST-02, GST-03)

#### 3.2.1. Phân tích Kiểu Dữ Liệu & API

- Theo `packages/shared/src/types.ts`:
    ```typescript
    export interface OpeningHour {
        id: string;
        venueId: string;
        courtId: string | null;
        /** 0 = Chủ nhật … 6 = Thứ bảy. */
        weekday: number;
        /** "HH:mm". */
        openTime: string;
        /** "HH:mm". */
        closeTime: string;
        isClosed: boolean;
    }
    ```
- Bổ sung trường `openingHours?: OpeningHour[];` vào `interface VenueDetail` trong `packages/shared/src/types.ts` để đồng bộ type an toàn.
- Cập nhật mock handler `GET /api/v1/venues/:slug` trong `apps/web/mocks/handlers/venues.ts`: gắn mảng `openingHours` tương ứng từ `db.openingHours` hoặc fixtures vào response của `VenueDetail`.

#### 3.2.2. Xây dựng Component `apps/web/components/features/venue/VenueOpeningHours.tsx`

- **Props interface:**
    ```typescript
    export interface VenueOpeningHoursProps {
        openingHours: OpeningHour[];
        className?: string;
    }
    ```
- **Quy tắc hiển thị 7 ngày:**
    - Nhóm và sắp xếp theo tuần từ Thứ Hai đến Chủ Nhật:
      `[1, 2, 3, 4, 5, 6, 0]` tương ứng với:
        - 1: Thứ Hai
        - 2: Thứ Ba
        - 3: Thứ Tư
        - 4: Thứ Năm
        - 5: Thứ Sáu
        - 6: Thứ Bảy
        - 0: Chủ Nhật
    - Xác định thứ trong ngày hiện tại qua `new Date().getDay()`.
    - Highlight trực quan dòng tương ứng với ngày hôm nay:
        - Viền mỏng `border-primary-300`, nền `bg-primary-50/50`, chữ đậm `font-semibold text-primary-900`.
        - Thêm badge nhỏ: `Hôm nay` (nền `bg-primary-600 text-white text-[11px] font-medium px-2 py-0.5 rounded-full`).
    - Đối với các ngày mở cửa bình thường: hiển thị `{item.openTime} - {item.closeTime}`.
    - Đối với ngày đóng cửa (`item.isClosed === true`): hiển thị badge `Đóng cửa` (màu `bg-neutral-100 text-neutral-600 text-xs px-2 py-0.5 rounded`).
    - Fallback an toàn: Nếu `openingHours` rỗng hoặc không có dữ liệu, hiển thị thông báo "Đang cập nhật giờ mở cửa" với icon `Clock`.

- **Anti-AI Design & Token:**
    - Card bọc ngoài: `rounded-card border border-neutral-200 bg-white p-4 shadow-sm`.
    - Tiêu đề khối: Icon `Clock` (Lucide, `size-5 text-primary-700`) kèm tiêu đề "Giờ hoạt động" (`text-lg font-semibold text-neutral-900`).
    - Tuyệt đối KHÔNG dùng emoji (⏰, 🕒).

#### 3.2.3. Nhúng vào `apps/web/components/features/venue/VenueDetailScreen.tsx`

- Đặt `VenueOpeningHours` tại cột bên trái (sau phần Tiện ích `amenities` hoặc sau phần Giới thiệu `description`), hoặc tại vị trí phù hợp trong cột thông tin chi tiết.
- Truyền dữ liệu:
    ```tsx
    <VenueOpeningHours openingHours={venue.openingHours ?? []} />
    ```

---

### 3.3. [TODO-06] Màn Hình Kiểm Duyệt Đánh Giá Cho Quản Trị Viên (ADM-10)

#### 3.3.1. API & Schema Hợp Đồng

- File `apps/web/lib/api/endpoints/admin.ts` đã có 2 hàm:
    - `listAdminReviews(params: { venueId?: string; isVisible?: boolean; page?: number; limit?: number })`
    - `setReviewVisibility(id: string, isVisible: boolean)`
- Mở rộng kiểu dữ liệu `AdminReviewRow` trong `apps/web/lib/api/endpoints/admin.ts`:
    ```typescript
    export interface AdminReviewRow extends Review {
        venueName: string;
        venueSlug?: string;
        customerName: string;
        customerEmail?: string;
        isVisible: boolean;
    }
    ```
- Bổ sung trường `isVisible?: boolean;` vào `interface Review` trong `packages/shared/src/types.ts`.

#### 3.3.2. Cập nhật MSW Mock Handlers (`apps/web/mocks/handlers/admin.ts`)

Bổ sung 2 endpoint còn thiếu vào mảng `adminHandlers`:

1. `GET /api/v1/admin/reviews`:
    - Kiểm tra quyền admin qua `requireAdmin()`.
    - Lọc theo `venueId`, `isVisible` (boolean string `'true' | 'false'`), `rating` (số sao 1-5), `q` (tìm kiếm theo tên khách, tên cơ sở, hoặc nội dung bình luận).
    - Ghép thêm thông tin `venueName` từ `venues` và `customerName` từ `users`.
    - Sắp xếp mới nhất lên đầu (`createdAt desc`).
    - Phân trang qua `paginate(list, page, limit)`.
    - Trả về `okList(data, meta)`.

2. `PATCH /api/v1/admin/reviews/:id/visibility` (đồng thời hỗ trợ alias `PATCH /api/v1/reviews/:id/visibility`):
    - Kiểm tra quyền admin.
    - Nhận body `{ isVisible: boolean }`.
    - Tìm review theo `params.id` trong `db.reviews`. Nếu không thấy trả 404.
    - Cập nhật `review.isVisible = body.isVisible`.
    - Ghi nhật ký kiểm toán(hoạt động):
      `writeAudit('review.toggle_visibility', 'review', review.id, { isVisible: body.isVisible, venueId: review.venueId })`.
    - Lưu qua `persist()`.
    - Trả về `ok(review)`.

#### 3.3.3. Xây dựng Hook `apps/web/lib/hooks/useAdminReviews.ts`

- Cung cấp:
    - `adminReviewsQueryKeys.list(filters)`
    - `useAdminReviews(filters)`: dùng `useQuery` với `placeholderData: keepPreviousData`, `staleTime: 30 * 1000`.
    - `useSetReviewVisibility()`: dùng `useMutation` gọi `setReviewVisibility`, khi `onSuccess` sẽ `invalidateQueries({ queryKey: ['admin', 'reviews'] })`.

#### 3.3.4. Bổ sung Điều Hướng `ADMIN_NAV` & Ngôn Ngữ

- Trong `apps/web/components/layout/dashboard-nav.ts`:
  Thêm mục đánh giá vào `ADMIN_NAV`:
    ```typescript
    { href: '/admin/reviews', labelKey: 'reviews', icon: Star },
    ```
- Trong `apps/web/messages/vi.json` (namespace `"admin"`):
    - `"reviews": "Quản lý đánh giá"`
    - `"reviewsTitle": "Kiểm duyệt đánh giá"`
    - `"reviewsSubtitle": "Quản lý và kiểm duyệt các đánh giá của khách hàng đối với các cơ sở thể thao trên toàn hệ thống."`

#### 3.3.5. Xây dựng Component `AdminReviewsScreen.tsx` & Page `page.tsx`

- **Tạo mới:** `apps/web/app/(admin)/admin/reviews/page.tsx`
- **Tạo mới:** `apps/web/components/features/admin/AdminReviewsScreen.tsx`
- **Các thành phần giao diện chính:**
    1. **PageHeader:** Tiêu đề "Kiểm duyệt đánh giá", mô tả phạm vi chức năng ADM-10.
    2. **Thanh bộ lọc (Filter Bar):**
        - Input tìm kiếm (Debounce 300ms) theo từ khóa nhận xét, tên khách, tên sân.
        - Dropdown chọn Cơ sở thể thao (sử dụng danh sách venues).
        - Dropdown chọn Trạng thái hiển thị (Tất cả, Đang hiển thị công khai, Đã ẩn do vi phạm).
        - Dropdown chọn Mức đánh giá (Tất cả, 5 sao, 4 sao, 3 sao, 2 sao, 1 sao).
    3. **Bảng dữ liệu đánh giá:**
        - Cột 1: **Khách hàng** (Avatar tròn + Tên khách + Ngày gửi đánh giá).
        - Cột 2: **Cơ sở** (Tên cơ sở thể thao).
        - Cột 3: **Điểm số & Nội dung** (Cụm sao vàng `fill-amber-400 text-amber-400` + trích đoạn nội dung bình luận; nếu có phản hồi của chủ sân thì hiển thị thêm ô phản hồi phụ).
        - Cột 4: **Trạng thái** (Badge xanh lá `Công khai` hoặc Badge xám `Đã ẩn`).
        - Cột 5: **Thao tác:**
            - Nếu đang hiển thị: Nút "Ẩn đánh giá" (`variant="outline"`, icon `EyeOff`, màu đỏ nhạt khi hover).
            - Nếu đang ẩn: Nút "Hiện đánh giá" (`variant="outline"`, icon `Eye`, màu xanh khi hover).
    4. **Hộp thoại xác nhận (`Dialog` Radix UI):**
        - Khi bấm nút Ẩn/Hiện, mở Dialog hỏi: "Bạn có chắc chắn muốn ẩn đánh giá này khỏi trang công khai?" hoặc "Hiển thị lại đánh giá này?".
        - Nút "Hủy bỏ" (`variant="outline"`) và nút "Xác nhận" (`variant="destructive"` khi ẩn, `variant="default"` khi hiện).
        - Tuyệt đối không dùng `window.confirm`.
    5. **Đầy đủ 6 trạng thái UI:**
        - Loading: 5 dòng `Skeleton` bảng dữ liệu.
        - Empty: `EmptyState` với icon `MessageSquareOff`, thông báo "Không tìm thấy đánh giá nào".
        - Error: `ErrorState` có nút "Thử lại".
        - Pagination: Điều khiển chuyển trang kết nối với `meta`.

---

### 3.4. [TODO-08] Xây Dựng Trang Thông Báo Đầy Đủ `/notifications` (CUS-14)

#### 3.4.1. Bảo vệ Tuyến Đường (Route Guard)

- Cập nhật `apps/web/middleware.ts`:
  Bổ sung `pathname.startsWith('/notifications')` vào `isCustomerRoute`:
    ```typescript
    // 4. Nhóm route Khách hàng: /bookings, /favorites, /profile, /notifications
    const isCustomerRoute =
        pathname.startsWith("/bookings") ||
        pathname.startsWith("/favorites") ||
        pathname.startsWith("/profile") ||
        pathname.startsWith("/notifications");
    ```
    Nếu chưa đăng nhập, tự động chuyển hướng sang `/login?next=/notifications`.

#### 3.4.2. Mở Rộng Hook `useNotifications.ts`

- Bổ sung hàm hook lấy danh sách thông báo có phân trang và lọc:
    ```typescript
    export interface PaginatedNotificationParams {
        page?: number;
        limit?: number;
        unreadOnly?: boolean;
        type?: string;
    }

    export function usePaginatedNotifications(params: PaginatedNotificationParams = {}) {
        const { user } = useAuth();
        return useQuery({
            queryKey: ["notifications", "paginated", user?.id ?? null, params],
            queryFn: () => listNotifications(params),
            enabled: Boolean(user),
            staleTime: 15 * 1000,
            placeholderData: keepPreviousData,
        });
    }
    ```

#### 3.4.3. Xây dựng Route & Component

- **Tạo mới:** `apps/web/app/(customer)/notifications/page.tsx`
- **Tạo mới:** `apps/web/app/(customer)/notifications/loading.tsx`
- **Tạo mới:** `apps/web/components/features/notification/NotificationsScreen.tsx`
- **Thiết kế chi tiết:**
    1. **Tiêu đề trang & Hành động hàng đầu:**
        - Tiêu đề: "Thông báo" (icon `Bell`).
        - Nút "Đánh dấu tất cả đã đọc" (icon `CheckCheck`, disabled khi không có thông báo chưa đọc hoặc đang gửi request).
    2. **Bộ lọc phân loại thông báo (Tab bar hoặc Segmented control):**
        - **Tất cả**
        - **Chưa đọc** (`unreadOnly = true`)
        - **Đặt sân** (`booking_created`, `booking_confirmed`, `booking_cancelled`, `hold_expired`)
        - **Thanh toán** (`payment_submitted`, `payment_rejected`)
        - **Hệ thống** (`owner_application_*`, `venue_*`, `review_reply`)
    3. **Thẻ thông báo (Notification Item):**
        - Icon phân loại:
            - Đặt sân: icon `CalendarCheck` (màu xanh lá `text-primary-700 bg-primary-50`).
            - Thanh toán: icon `CreditCard` (màu xanh dương `text-blue-700 bg-blue-50`).
            - Cảnh báo/Hủy: icon `AlertCircle` (màu hổ phách `text-amber-700 bg-amber-50`).
            - Hệ thống: icon `Bell` (màu xám `text-neutral-700 bg-neutral-100`).
        - Trạng thái chưa đọc: Chấm tròn xanh `bg-primary-600`, nền thẻ hơi ngả `bg-primary-50/30`. Thẻ đã đọc có nền trắng `bg-white`.
        - Tiêu đề in đậm, nội dung mô tả chi tiết, thời gian tương đối (`timeAgo(createdAt)`).
        - Tương tác click: Tự động gọi `markRead.mutate(item.id)`. Nếu `payload?.bookingId` tồn tại, điều hướng ngay đến `/bookings/${payload.bookingId}`.
    4. **Trạng thái rỗng & Lỗi:**
        - Rỗng: `EmptyState` với icon `BellOff`, thông báo "Không có thông báo nào".
        - Lỗi: `ErrorState` có nút "Thử lại".
    5. **Phân trang:**
        - Sử dụng `Pagination` tích hợp với URL hoặc component state (`page`, `limit = 10`).

#### 3.4.4. Cập nhật `NotificationBell.tsx`

- Bổ sung footer link ở cuối `DropdownMenuContent` trong `apps/web/components/layout/NotificationBell.tsx`:
    ```tsx
    <div className="border-t border-neutral-200 p-2 text-center">
        <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block w-full rounded-btn py-1.5 text-xs font-medium text-primary-700 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
        >
            Xem tất cả thông báo
        </Link>
    </div>
    ```

#### 3.4.5. Bổ sung Dữ liệu Mẫu (Seed Notifications)

- Mở rộng hàm `seedNotifications()` trong `apps/web/mocks/db.ts` với tối thiểu 8 thông báo mẫu thuộc nhiều thể loại khác nhau (đơn đặt sân thành công, nhắc nhở thanh toán, biên lai được duyệt, duyệt hồ sơ chủ sân) cho cả tài khoản khách `khach@example.com` và chủ sân `owner@example.com`.

---

## 4. Kiến Trúc File & Danh Sách Thay Đổi

### 4.1. File Tạo Mới

| STT | Đường dẫn file tuyệt đối                                                 | Mục đích & Trách nhiệm                                                                     |
| :-: | :----------------------------------------------------------------------- | :----------------------------------------------------------------------------------------- |
|  1  | `apps/web/playwright.config.ts`                                          | Cấu hình Playwright E2E Runner (port 3000, Chromium, WebServer dev).                       |
|  2  | `apps/web/e2e/guest-booking.spec.ts`                                     | Kịch bản E2E: Khách tìm sân, xem giờ mở cửa, chọn slot và kiểm tra luồng login.            |
|  3  | `apps/web/e2e/owner-management.spec.ts`                                  | Kịch bản E2E: Chủ sân vào dashboard, timeline, kiểm tra đơn đặt và thao tác duyệt/no-show. |
|  4  | `apps/web/e2e/admin-moderation.spec.ts`                                  | Kịch bản E2E: Quản trị viên vào dashboard, quản lý đánh giá và thao tác ẩn/hiện.           |
|  5  | `apps/web/components/features/venue/VenueOpeningHours.tsx`               | Component hiển thị bảng giờ mở cửa 7 ngày trong tuần, highlight hôm nay.                   |
|  6  | `apps/web/components/features/venue/VenueOpeningHours.test.tsx`          | Unit test cho component `VenueOpeningHours`.                                               |
|  7  | `apps/web/lib/hooks/useAdminReviews.ts`                                  | React Query hooks quản lý danh sách và trạng thái đánh giá cho Admin.                      |
|  8  | `apps/web/app/(admin)/admin/reviews/page.tsx`                            | Route trang quản lý đánh giá phía Admin (`/admin/reviews`).                                |
|  9  | `apps/web/components/features/admin/AdminReviewsScreen.tsx`              | Màn hình danh sách đánh giá, bộ lọc và dialog kiểm duyệt ẩn/hiện.                          |
| 10  | `apps/web/components/features/admin/AdminReviewsScreen.test.tsx`         | Unit/Component test cho màn hình `AdminReviewsScreen`.                                     |
| 11  | `apps/web/app/(customer)/notifications/page.tsx`                         | Route trang lịch sử thông báo khách hàng (`/notifications`).                               |
| 12  | `apps/web/app/(customer)/notifications/loading.tsx`                      | Skeleton loading cho route `/notifications`.                                               |
| 13  | `apps/web/components/features/notification/NotificationsScreen.tsx`      | Màn hình danh sách thông báo đầy đủ, lọc theo loại, đánh dấu đã đọc.                       |
| 14  | `apps/web/components/features/notification/NotificationsScreen.test.tsx` | Unit/Component test cho màn hình `NotificationsScreen`.                                    |

### 4.2. File Cần Chỉnh Sửa

| STT | Đường dẫn file tuyệt đối                                   | Nội dung chỉnh sửa                                                                                      |
| :-: | :--------------------------------------------------------- | :------------------------------------------------------------------------------------------------------ |
|  1  | `packages/shared/src/types.ts`                             | Bổ sung `openingHours?: OpeningHour[];` vào `VenueDetail`, bổ sung `isVisible?: boolean;` vào `Review`. |
|  2  | `apps/web/package.json`                                    | Cập nhật script `"test:e2e": "playwright test"`.                                                        |
|  3  | `apps/web/middleware.ts`                                   | Bổ sung `pathname.startsWith('/notifications')` vào danh sách `isCustomerRoute`.                        |
|  4  | `apps/web/middleware.test.ts`                              | Bổ sung test case kiểm tra route `/notifications` yêu cầu session đăng nhập.                            |
|  5  | `apps/web/components/features/venue/VenueDetailScreen.tsx` | Nhúng component `VenueOpeningHours` vào giao diện chi tiết cơ sở.                                       |
|  6  | `apps/web/components/layout/dashboard-nav.ts`              | Thêm mục `reviews` vào mảng `ADMIN_NAV`.                                                                |
|  7  | `apps/web/components/layout/NotificationBell.tsx`          | Thêm liên kết footer "Xem tất cả thông báo" trỏ về `/notifications`.                                    |
|  8  | `apps/web/lib/api/endpoints/admin.ts`                      | Khai báo kiểu `AdminReviewRow` mở rộng với `venueName`, `customerName`, `isVisible`.                    |
|  9  | `apps/web/lib/hooks/useNotifications.ts`                   | Thêm hook `usePaginatedNotifications` hỗ trợ phân trang và lọc theo loại.                               |
| 10  | `apps/web/mocks/handlers/venues.ts`                        | Gắn dữ liệu `openingHours` tương ứng vào kết quả trả về của `GET /api/v1/venues/:slug`.                 |
| 11  | `apps/web/mocks/handlers/admin.ts`                         | Thêm MSW handlers cho `GET /api/v1/admin/reviews` và `PATCH /api/v1/admin/reviews/:id/visibility`.      |
| 12  | `apps/web/mocks/db.ts`                                     | Mở rộng danh sách thông báo mẫu `seedNotifications()` với 8-10 bản ghi đa dạng.                         |
| 13  | `apps/web/messages/vi.json`                                | Bổ sung chuỗi ngôn ngữ cho bảng giờ mở cửa, quản lý đánh giá admin và trang thông báo.                  |

---

## 5. Ma Trận Kiểm Thử Chi Tiết (Test Matrix)

Bắt buộc `auto-tester` và `qa-inspector` phải kiểm tra đạt 100% các tiêu chí kiểm thử dưới đây:

### 5.1. Unit & Component Test Matrix (Vitest + Testing Library)

| ID              | File kiểm thử                  | Mô tả ca kiểm thử                                                   | Kết quả kỳ vọng                                                                                |
| :-------------- | :----------------------------- | :------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------- |
| **TC-OH-01**    | `VenueOpeningHours.test.tsx`   | Render đủ 7 ngày trong tuần từ Thứ Hai đến Chủ Nhật.                | Hiển thị chính xác 7 dòng ngày trong tuần với nhãn tiếng Việt rõ ràng.                         |
| **TC-OH-02**    | `VenueOpeningHours.test.tsx`   | Tự động highlight ngày hiện tại (`today`).                          | Dòng tương ứng với thứ hiện tại có class border primary và badge "Hôm nay".                    |
| **TC-OH-03**    | `VenueOpeningHours.test.tsx`   | Xử lý ngày đóng cửa (`isClosed = true`).                            | Hiển thị badge "Đóng cửa" thay vì khoảng giờ.                                                  |
| **TC-OH-04**    | `VenueOpeningHours.test.tsx`   | Xử lý mảng `openingHours` rỗng hoặc undefined.                      | Render thông báo fallback thân thiện, không gây crash ứng dụng.                                |
| **TC-REV-01**   | `AdminReviewsScreen.test.tsx`  | Render bảng danh sách đánh giá từ API.                              | Hiển thị các cột Khách hàng, Cơ sở, Số sao, Nội dung, Trạng thái, Thao tác.                    |
| **TC-REV-02**   | `AdminReviewsScreen.test.tsx`  | Lọc đánh giá theo cơ sở thể thao và số sao.                         | Gọi lại API với query params tương ứng và cập nhật danh sách hiển thị.                         |
| **TC-REV-03**   | `AdminReviewsScreen.test.tsx`  | Bấm nút ẩn đánh giá mở Dialog xác nhận (không dùng window.confirm). | Dialog Radix xuất hiện với tiêu đề cảnh báo và nút Xác nhận.                                   |
| **TC-REV-04**   | `AdminReviewsScreen.test.tsx`  | Xác nhận ẩn đánh giá gọi mutation thành công.                       | Gọi `PATCH /api/v1/admin/reviews/:id/visibility`, toast thành công, badge chuyển sang "Đã ẩn". |
| **TC-NOTIF-01** | `NotificationsScreen.test.tsx` | Render danh sách thông báo và số lượng chưa đọc.                    | Hiển thị các thẻ thông báo, chấm xanh cho thông báo chưa đọc.                                  |
| **TC-NOTIF-02** | `NotificationsScreen.test.tsx` | Chuyển đổi tab bộ lọc (Tất cả, Chưa đọc, Đặt sân, Thanh toán).      | Danh sách thông báo được lọc chính xác theo danh mục đã chọn.                                  |
| **TC-NOTIF-03** | `NotificationsScreen.test.tsx` | Bấm nút "Đánh dấu tất cả đã đọc".                                   | Gọi `markAllNotificationsRead`, tất cả thông báo chuyển sang trạng thái đã đọc.                |
| **TC-NOTIF-04** | `NotificationsScreen.test.tsx` | Trạng thái không có thông báo (Empty State).                        | Hiển thị component `EmptyState` với icon `BellOff`.                                            |
| **TC-MID-01**   | `middleware.test.ts`           | Truy cập `/notifications` khi chưa đăng nhập.                       | Bị chặn và chuyển hướng về `/login?next=%2Fnotifications`.                                     |
| **TC-MID-02**   | `middleware.test.ts`           | Truy cập `/notifications` khi đã đăng nhập (có session).            | Cho phép đi tiếp (`NextResponse.next()`).                                                      |

### 5.2. E2E Test Matrix (Playwright)

| ID         | File kiểm thử E2E              | Luồng kiểm thử                           | Tiêu chí đạt                                                                                                           |
| :--------- | :----------------------------- | :--------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- |
| **E2E-01** | `e2e/guest-booking.spec.ts`    | Luồng khách tìm sân & chọn slot đặt sân. | Tìm sân thành công, mở trang chi tiết xem được giờ mở cửa, chọn được slot trên lưới, nút đăng nhập hiển thị chính xác. |
| **E2E-02** | `e2e/owner-management.spec.ts` | Luồng chủ sân kiểm tra đơn & dashboard.  | Đăng nhập chủ sân, vào `/owner/dashboard` và `/owner/bookings` hiển thị đầy đủ bảng đơn và các nút duyệt/no-show.      |
| **E2E-03** | `e2e/admin-moderation.spec.ts` | Luồng admin kiểm duyệt đánh giá vi phạm. | Đăng nhập admin, vào `/admin/reviews`, tìm kiếm đánh giá, mở dialog và thao tác ẩn/hiện thành công.                    |

---

## 6. Hướng Dẫn Triển Khai Cho `senior-dev`

1. **Thứ tự thực hiện đề xuất:**
    - **Bước 1:** Bổ sung type trong `packages/shared/src/types.ts` (`OpeningHour` trong `VenueDetail`, `isVisible` trong `Review`).
    - **Bước 2:** Cập nhật MSW mock handlers trong `apps/web/mocks/` (`venues.ts`, `admin.ts`, `db.ts`) để sẵn sàng dữ liệu test.
    - **Bước 3 (TODO-07):** Xây dựng `VenueOpeningHours.tsx` và gắn vào `VenueDetailScreen.tsx`.
    - **Bước 4 (TODO-06):** Xây dựng hook `useAdminReviews.ts`, thêm navigation `ADMIN_NAV`, tạo route và màn hình `AdminReviewsScreen.tsx`.
    - **Bước 5 (TODO-08):** Cập nhật `middleware.ts`, cập nhật `useNotifications.ts`, tạo route và màn hình `NotificationsScreen.tsx`, gắn link vào `NotificationBell.tsx`.
    - **Bước 6 (TODO-03):** Tạo file `playwright.config.ts`, tạo 3 file kịch bản E2E trong `apps/web/e2e/`, cập nhật script `test:e2e` trong `apps/web/package.json`.
    - **Bước 7:** Kiểm tra typecheck `pnpm typecheck`, chạy lint `pnpm lint`, chạy unit test `pnpm --filter @bsc/web test`.
2. **Nguyên tắc cốt lõi:**
    - Không được phá vỡ các test cũ đã pass của Batch 1 (đặc biệt là 285 tests hiện tại).
    - Tuyệt đối tuân thủ chuẩn Anti-AI (không emoji, không gradient neon, dùng Dialog Radix thay vì confirm native).
    - Tối ưu hóa bundle và import sạch, không hardcode string ngoài `messages/vi.json`.
