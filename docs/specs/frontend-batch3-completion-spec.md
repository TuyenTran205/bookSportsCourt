# ĐẶC TẢ KỸ THUẬT: HOÀN THIỆN FRONTEND BATCH 3 (REALTIME OWNER + ERROR BOUNDARIES + SEO/I18N + DARK MODE)

- **Mã tài liệu:** `SPEC-FE-BATCH3-01`
- **Tác giả:** Product Architect & UX Specifier (`ba-spec` - 9router_BA)
- **Dự án:** BookSportsCourt (Sàn thương mại điện tử đặt sân thể thao đa người dùng)
- **Nền tảng mục tiêu:** Web Client (`apps/web` - Next.js 14 App Router, TypeScript, Tailwind CSS, TanStack Query, Next-Intl, Lucide)
- **Trạng thái:** Approved / Sẵn sàng bàn giao cho `senior-dev` (9router_DEV)
- **Tham chiếu:**
  - `AGENTS.md` (10 quy tắc tối thượng)
  - `G:\Slides_BaiGiangTLU\ChuyenDeCNTT\danh-sach-cong-viec-hoan-thien-frontend.md` (TODO-10, TODO-11, TODO-12, TODO-13)
  - `docs/03-architecture.md` (WebSocket sequence & TanStack Query cache synchronization)
  - `docs/05-booking-and-realtime.md` (Vòng đời booking & Realtime events)
  - `docs/07-design-system.md` & `docs/08-ui-quality-rules.md` (Anti-AI Design & Color Tokens)
  - `docs/09-frontend-conventions.md` & `docs/11-api-contract.md` (Next.js 14 App Router standards)

---

## 1. Tổng quan & Mục tiêu Kỹ thuật BATCH 3

Batch 3 giải quyết trọn vẹn nhóm nhiệm vụ P2 (Hoàn thiện nền tảng, Nợ kỹ thuật & Trải nghiệm chuyên sâu), đưa chất lượng mã nguồn Frontend của dự án đạt chuẩn Enterprise / Production-grade:

| STT | Mã việc | Tên việc cần làm | Mức độ | Phạm vi giải quyết |
|:---:|:---|:---|:---:|:---|
| 1 | **TODO-10** | Tích hợp sự kiện Realtime Socket.IO cho Owner Timeline & Bookings | **P2** | Xây dựng hook `useOwnerRealtime(venueId?: string)` và facade `useSocket.ts`, lắng nghe các event realtime (`slot_updated`, `booking_created`, `booking_confirmed`, `booking_cancelled`, `payment_submitted`, `hold_expired`), tự động invalidate cache TanStack Query (`['owner', 'bookings']`, `['owner', 'timeline']`), bắn toast thông báo tinh tế, tích hợp trực tiếp vào `OwnerTimeline.tsx` và `OwnerBookingsScreen.tsx`. |
| 2 | **TODO-11** | Bổ sung hệ thống Error Boundary Next.js App Router hoàn chỉnh | **P2** | Thiết lập 4 tầng Error Boundary chuẩn của Next.js: `app/global-error.tsx` (bắt fatal root crash, render HTML skeleton độc lập), `app/error.tsx` (bắt lỗi public routes kèm `ErrorState` + Thử lại + Về trang chủ), `app/(owner)/error.tsx` (bắt lỗi phân hệ chủ sân), `app/(admin)/error.tsx` (bắt lỗi phân hệ quản trị). |
| 3 | **TODO-12** | Dọn dẹp i18n, bổ sung SEO Metadata, Sitemap, Robots & JSON-LD | **P2** | Chuyển toàn bộ chuỗi hard-code trong `Footer.tsx` và `DataTable.tsx` vào `messages/vi.json` (namespace `footer`, `table`). Tạo file `app/robots.ts` (disallow admin/owner/bookings/checkout). Tạo file `app/sitemap.ts` (tự động sinh sitemap tĩnh + dynamic venue slug). Tạo component JSON-LD `SportsActivityLocation` cho `app/(public)/venues/[slug]/page.tsx`. |
| 4 | **TODO-13** | Triển khai chế độ giao diện tối (Dark Mode) theo Design Tokens | **P2** | Bổ sung khối biến màu `.dark` trong `app/globals.css` map với `tailwind.config.ts`. Xây dựng hook `useTheme` lưu trữ `localStorage` (`bsc-theme-mode`) hỗ trợ 3 chế độ (Sáng / Tối / Hệ thống), đồng bộ class `dark` trên `<html>`. Xây dựng component `ThemeToggle.tsx` chuẩn Anti-AI (icon `Sun`, `Moon`, `Monitor`), tích hợp vào `Header.tsx` (desktop + mobile drawer) và `DashboardShell.tsx`. |

---

## 2. Tiêu chuẩn Thiết kế Anti-AI (Strict Anti-AI Rules)

Tuân thủ nghiêm ngặt theo `docs/07-design-system.md`, `docs/08-ui-quality-rules.md` và `AGENTS.md`:

| Tiêu chí | ❌ HÀNH VI CẤM (AI Slop / Cliche) | ✅ CHUẨN THIẾT KẾ DỰ ÁN (Linear / Stripe Standard) |
|---|---|---|
| **Màu sắc & Gradient** | CẤM gradient tím/hồng/xanh neon (`from-purple-500 to-pink-500`), cấm hiệu ứng glassmorphism mờ đục lòe loẹt. | 100% màu sắc lấy từ CSS tokens: Nền trắng `#ffffff` (light) / slate cực tối `#090d16` (dark), viền mỏng 1px `#e2e8f0` (light) / `#334155` (dark), text chính `#0f172a` (light) / `#f8fafc` (dark), thương hiệu xanh sân cỏ `#15803d` / `#16a34a`. |
| **Bo góc (Border Radius)** | CẤM bo góc dị dạng `rounded-3xl` cho card hoặc modal. CẤM bo tròn toàn bộ nút bấm `rounded-full` một cách tùy tiện. | Button / Input: `rounded-btn` (8px). Card / Panel: `rounded-card` (12px). Dialog: `rounded-xl` (12px). Badge: `rounded-md` (6px) hoặc `rounded-full` cho badge trạng thái tròn nhỏ. |
| **Biểu tượng (Icons)** | CẤM chèn emoji rác (⏰, 💬, 🔔, 🚀, ✨, ⚠️, ❌, 🌓) vào nút bấm, tiêu đề hoặc văn bản UI. | 100% biểu tượng dùng `lucide-react` cố định kích thước (`size-4`, `size-5`), nét stroke 1.5px (`Sun`, `Moon`, `Monitor`, `AlertTriangle`, `RefreshCw`, `Home`). |
| **Hộp thoại tương tác** | CẤM dùng `window.alert()`, `window.confirm()`. CẤM popup sập trang kiểu modal toàn màn hình giật cục. | Sử dụng `<ErrorState>` chuẩn hoặc `<Dialog>` Radix UI accessible với nút hủy (outline) và nút xác nhận (primary). Toast thông báo gọn gàng từ `sonner`. |
| **Trạng thái Component** | Thiếu các trạng thái tương tác hoặc chỉ xoay vòng vô hạn. | Đủ 6 trạng thái bắt buộc: `Default`, `Hover`, `Focus-visible` (ring outline 2px), `Loading` (skeleton/spinner), `Disabled` (opacity 50%, cursor-not-allowed), `Empty` / `Error`. |
| **Quản lý Theme** | Cấm nhấp nháy trắng (FOUC - Flash of Unstyled Content) khi tải trang ở Dark Mode. Cấm chuyển màu gắt đột ngột. | Áp dụng script đồng bộ class `dark` sớm trên thẻ `<html>`. Chuyển đổi màu mượt mà bằng transition thời lượng nhẹ (150ms-200ms). |

---

## 3. Chi tiết Kỹ thuật từng Đầu việc

---

### 3.1. [TODO-10] Tích hợp sự kiện Realtime Socket.IO cho Owner Timeline & Bookings

#### 3.1.1. Hiện trạng & Vấn đề
- `apps/web/components/common/SocketProvider.tsx` đã có `useSocket` và `useRealtime` lắng nghe Mock BroadcastChannel / Socket.IO.
- Tuy nhiên:
  1. Thiếu file hook `apps/web/lib/hooks/useSocket.ts` làm facade chung theo quy chuẩn `lib/hooks/`.
  2. Thiếu hook chuyên biệt `useOwnerRealtime(options)` dành riêng cho Chủ sân.
  3. `OwnerTimeline.tsx` hiện chỉ fetch dữ liệu 1 lần bằng `useOwnerTimeline` (với `staleTime: 60_000`), không tự động cập nhật khi khách đặt sân hoặc duyệt thanh toán trên tab khác, dẫn đến lệch trạng thái slot nếu không F5.
  4. `OwnerBookingsScreen.tsx` không nhận visual feedback khi có đơn đặt sân mới hoặc minh chứng thanh toán vừa tải lên.

#### 3.1.2. Đặc tả Facade Hook `apps/web/lib/hooks/useSocket.ts`
Tạo mới file `apps/web/lib/hooks/useSocket.ts`:
- Re-export `useSocket`, `useRealtime` từ `@/components/common/SocketProvider`.
- Export type `RealtimeEvent` từ `@/mocks/realtime`.

#### 3.1.3. Đặc tả Hook `apps/web/lib/hooks/useOwnerRealtime.ts`
Tạo mới file `apps/web/lib/hooks/useOwnerRealtime.ts`:
```typescript
export interface UseOwnerRealtimeOptions {
  venueId?: string;
  enabled?: boolean;
  notifyOnBookingCreated?: boolean;
  notifyOnPaymentSubmitted?: boolean;
  onEvent?: (event: RealtimeEvent) => void;
}
```

- **Nguyên lý hoạt động:**
  1. Nhận `venueId?: string` (tùy chọn) và các tùy chọn cấu hình.
  2. Gọi `useRealtime(handleEvent)` từ `useSocket`.
  3. Khi nhận sự kiện:
     - **`booking_created`:**
       * Kiểm tra nếu có `venueId` và `payload.venueId !== venueId`: bỏ qua hoặc chỉ refresh tổng thể.
       * Gọi `queryClient.invalidateQueries({ queryKey: ['owner', 'bookings'] })`.
       * Gọi `queryClient.invalidateQueries({ queryKey: ['owner', 'timeline'] })`.
       * Gọi `queryClient.invalidateQueries({ queryKey: ['owner', 'payments'] })`.
       * Bắn `toast.info('Có đơn đặt sân mới #' + payload.bookingId.slice(0, 8), { description: 'Dữ liệu lịch sân đã được đồng bộ' })`.
     - **`payment_submitted`:**
       * Kiểm tra `venueId` tương tự.
       * Invalidate `['owner', 'payments']`, `['owner', 'bookings']`.
       * Bắn `toast.info('Khách vừa tải ảnh thanh toán cho đơn #' + payload.bookingId.slice(0, 8))`.
     - **`slot_updated`:**
       * Kiểm tra nếu có `venueId` và `payload.venueId !== venueId`: bỏ qua.
       * Invalidate `['owner', 'timeline']` và `['venues']`.
     - **`booking_confirmed`:**
       * Invalidate `['owner', 'bookings']`, `['owner', 'timeline']`.
       * Bắn `toast.success('Đơn đặt sân #' + payload.bookingId.slice(0, 8) + ' đã được xác nhận')`.
     - **`booking_cancelled`:**
       * Invalidate `['owner', 'bookings']`, `['owner', 'timeline']`.
       * Bắn `toast.warning('Đơn đặt sân #' + payload.bookingId.slice(0, 8) + ' đã bị huỷ', { description: payload.reason })`.
     - **`hold_expired`:**
       * Invalidate `['owner', 'timeline']`, `['owner', 'bookings']`.
     - Gọi callback tùy biến `options?.onEvent?.(event)`.

#### 3.1.4. Tích hợp vào `OwnerTimeline.tsx`
- File: `apps/web/components/features/owner/OwnerTimeline.tsx`.
- Thao tác:
  1. Import `useOwnerRealtime` từ `@/lib/hooks/useOwnerRealtime`.
  2. Gọi `useOwnerRealtime({ venueId: selectedVenueId })`.
  3. Đảm bảo khi có sự kiện `slot_updated` hoặc `booking_created`, timeline tự động refetch query `['owner', 'timeline', selectedVenueId, date]` mà không cần F5.

#### 3.1.5. Tích hợp vào `OwnerBookingsScreen.tsx`
- File: `apps/web/components/features/owner/OwnerBookingsScreen.tsx`.
- Thao tác:
  1. Import `useOwnerRealtime` từ `@/lib/hooks/useOwnerRealtime`.
  2. Gọi `useOwnerRealtime()` tại component.
  3. Tự động nhận toast thông báo và cập nhật danh sách đơn khi có booking mới hoặc thay đổi trạng thái.

---

### 3.2. [TODO-11] Hệ thống Error Boundary Next.js App Router (`error.tsx`, `global-error.tsx`)

#### 3.2.1. Hiện trạng & Vấn đề
- Dự án chưa có bất kỳ file `error.tsx` hay `global-error.tsx` nào trong cây thư mục `apps/web/app`.
- Khi xảy ra lỗi crash component, client sẽ hiển thị lỗi vỡ giao diện hoặc màn hình trắng xóa.

#### 3.2.2. Đặc tả Root Fatal Error: `apps/web/app/global-error.tsx`
- **Mục tiêu:** Bắt các lỗi nghiêm trọng xảy ra ngay tại root `layout.tsx`. Thay thế toàn bộ HTML document.
- **Yêu cầu kỹ thuật:**
  * BẮT BUỘC có directive `'use client'`.
  * BẮT BUỘC tự render thẻ `<html>` và `<body>` (Next.js rule).
  * Props nhận vào: `{ error: Error & { digest?: string }; reset: () => void }`.
  * KHÔNG sử dụng các provider phức tạp (NextIntl, QueryClient, AuthProvider) bên trong file này vì chúng có thể chính là nguyên nhân gây crash.
  * Thiết kế Anti-AI: Giao diện nền tối giản (`#f8fafc`), khối trung tâm viền `1px solid #e2e8f0`, icon cảnh báo SVG trung tính, tiêu đề rõ ràng: "Đã xảy ra sự cố không mong muốn", thông điệp: "Hệ thống gặp lỗi nghiêm trọng khi tải giao diện. Vui lòng thử lại hoặc tải lại trang.", 2 nút hành động: "Thử lại" (gọi `reset()`) và "Tải lại trang" (gọi `window.location.reload()`).
  * Ghi log `console.error('[GlobalError]', error)`.

#### 3.2.3. Đặc tả Public Route Error: `apps/web/app/error.tsx`
- **Mục tiêu:** Bắt lỗi các trang người dùng và khách hàng vãng lai (`/`, `/venues`, `/bookings`, `/profile`...).
- **Yêu cầu kỹ thuật:**
  * BẮT BUỘC `'use client'`.
  * Props: `{ error: Error & { digest?: string }; reset: () => void }`.
  * Sử dụng component `ErrorState` từ `@/components/common/ErrorState`.
  * Bọc trong container căn giữa màn hình (`min-h-[50vh] flex items-center justify-center p-6`).
  * Cung cấp nút "Thử lại" (`reset()`) và nút "Về trang chủ" (`Link href="/"`, `Button variant="outline"`).
  * Hook `useEffect` ghi `console.error('[AppError]', error)`.

#### 3.2.4. Đặc tả Owner Portal Error: `apps/web/app/(owner)/error.tsx`
- **Mục tiêu:** Bắt lỗi trong phân hệ Chủ sân (`/owner/*`).
- **Yêu cầu kỹ thuật:**
  * BẮT BUỘC `'use client'`.
  * Props: `{ error: Error & { digest?: string }; reset: () => void }`.
  * Giao diện chuẩn Linear: Container viền mỏng, hiển thị thông báo "Không thể tải dữ liệu kênh chủ sân", nút "Thử lại" (`reset()`) và liên kết "Về tổng quan chủ sân" (`href="/owner/dashboard"`).

#### 3.2.5. Đặc tả Admin Portal Error: `apps/web/app/(admin)/error.tsx`
- **Mục tiêu:** Bắt lỗi trong phân hệ Quản trị viên (`/admin/*`).
- **Yêu cầu kỹ thuật:**
  * BẮT BUỘC `'use client'`.
  * Props: `{ error: Error & { digest?: string }; reset: () => void }`.
  * Giao diện chuẩn Enterprise: Container viền mỏng, hiển thị thông báo "Sự cố phân hệ quản trị", nút "Thử lại" (`reset()`) và liên kết "Về tổng quan quản trị" (`href="/admin/dashboard"`).

---

### 3.3. [TODO-12] Chuẩn hóa i18n, SEO Sitemap, Robots & JSON-LD

#### 3.3.1. Dọn dẹp i18n trong `Footer.tsx` & `DataTable.tsx`
- **Vấn đề:** `Footer.tsx` đang chứa 100% văn bản hard-code; `DataTable.tsx` chứa các nhãn phân trang và aria-label cứng.
- **Quy định cập nhật `apps/web/messages/vi.json`:**
  Thêm namespace `"footer"`:
  ```json
  "footer": {
    "brandDescription": "Nền tảng đặt sân thể thao trực tuyến hàng đầu Việt Nam. Kết nối người chơi với hơn 500+ cơ sở thể thao toàn quốc. Cập nhật lịch trống thời gian thực, giữ chỗ 10 phút.",
    "location": "Hà Nội, Việt Nam",
    "hotline": "Hotline: 1900 xxxx (08:00 – 22:00)",
    "support": "Hỗ trợ: support@booksportscourt.vn",
    "customerHeading": "Người chơi",
    "findVenues": "Tìm sân thể thao",
    "myBookings": "Lịch đặt của tôi",
    "favorites": "Sân yêu thích",
    "bookingGuide": "Hướng dẫn đặt sân",
    "ownerHeading": "Dành cho chủ sân",
    "ownerTimeline": "Kênh quản lý lịch sân",
    "ownerApply": "Đăng ký mở cơ sở",
    "paymentProcess": "Quy trình duyệt thanh toán",
    "partnerPolicy": "Chính sách phí đối tác (0đ)",
    "policyHeading": "Quy định & Chính sách",
    "terms": "Điều khoản dịch vụ",
    "privacy": "Chính sách bảo mật",
    "cancellationPolicy": "Chính sách huỷ & hoàn cọc",
    "operatingRegulations": "Quy chế hoạt động",
    "copyright": "© 2026 BookSportsCourt. Mọi quyền được bảo lưu.",
    "currencyInfo": "Tiền tệ: VND (₫)",
    "timezoneInfo": "Múi giờ: Asia/Ho_Chi_Minh (GMT+7)"
  }
  ```
  Thêm namespace `"table"`:
  ```json
  "table": {
    "noData": "Không có dữ liệu",
    "selectAll": "Chọn tất cả dòng",
    "selectRow": "Chọn dòng",
    "loadingData": "Đang tải dữ liệu",
    "pagination": "Phân trang",
    "previousPage": "Trang trước",
    "nextPage": "Trang sau",
    "pageIndicator": "Trang {page}/{totalPages}"
  }
  ```
- **Cập nhật `apps/web/components/common/Footer.tsx`:** Sử dụng `useTranslations('footer')` để render toàn bộ text.
- **Cập nhật `apps/web/components/ui/data-table.tsx`:** Đọc fallback text từ `useTranslations('table')` (nếu có hook context) hoặc truyền qua props chuẩn hóa.

#### 3.3.2. Cấu hình `apps/web/app/robots.ts`
Tạo mới file `apps/web/app/robots.ts` theo chuẩn Next.js Metadata Route:
```typescript
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/venues', '/venues/*'],
      disallow: ['/admin/', '/owner/', '/bookings/', '/checkout/', '/api/'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
```

#### 3.3.3. Cấu hình `apps/web/app/sitemap.ts`
Tạo mới file `apps/web/app/sitemap.ts`:
- Định nghĩa các URL tĩnh:
  * `/`: `priority: 1.0`, `changeFrequency: 'daily'`
  * `/venues`: `priority: 0.9`, `changeFrequency: 'daily'`
  * `/owner/apply`: `priority: 0.6`, `changeFrequency: 'monthly'`
- Lấy danh sách cơ sở thể thao bằng hàm `listVenues({ limit: 100 })`:
  * Duyệt từng venue: `url: \`\${siteUrl}/venues/\${venue.slug}\``
  * `lastModified: new Date(venue.updatedAt || Date.now())`
  * `changeFrequency: 'weekly'`
  * `priority: 0.8`
- Xử lý khối `try...catch` an toàn nếu API backend/mock gặp sự cố, đảm bảo luôn trả về ít nhất danh sách các route tĩnh.

#### 3.3.4. Schema JSON-LD `SportsActivityLocation`
Tạo mới component `apps/web/components/features/venue/VenueJsonLd.tsx`:
- Nhận prop: `venue: VenueDetail`.
- Sinh cấu trúc Schema.org chuẩn Google Rich Snippets:
  ```json
  {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    "name": venue.name,
    "description": venue.description,
    "image": venue.images,
    "telephone": venue.phone,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": venue.address,
      "addressLocality": venue.districtName,
      "addressRegion": venue.provinceName,
      "addressCountry": "VN"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": venue.latitude,
      "longitude": venue.longitude
    },
    "openingHoursSpecification": venue.openingHours.map((h) => ({
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][h.dayOfWeek === 0 ? 6 : h.dayOfWeek - 1],
      "opens": h.openTime,
      "closes": h.closeTime
    })),
    "aggregateRating": venue.ratingAverage ? {
      "@type": "AggregateRating",
      "ratingValue": venue.ratingAverage,
      "reviewCount": venue.reviewCount || 1,
      "bestRating": 5,
      "worstRating": 1
    } : undefined
  }
  ```
- Nhúng component `<VenueJsonLd venue={venue} />` vào `apps/web/components/features/venue/VenueDetailScreen.tsx` (ngay khi `venueQuery.data` sẵn sàng).

---

### 3.4. [TODO-13] Hệ thống Dark Mode theo token Design System

#### 3.4.1. Khảo sát & Tokens Dark Mode trong `apps/web/app/globals.css`
Bổ sung khối `.dark` vào `globals.css` ngay dưới khối `:root`:
```css
.dark {
  /* === SURFACES (Chế độ tối dịu mắt, độ tương phản cao chuẩn Linear) === */
  --color-bg: #090d16;          /* Nền chính slate sâu */
  --color-bg-card: #0f172a;     /* Nền card neutral-900 */
  --color-bg-subtle: #1e293b;   /* Nền phụ neutral-800 */
  --color-border: #334155;      /* Viền 1px neutral-700 */
  --color-border-focus: #22c55e;/* Viền focus primary-500 */

  /* === TEXT === */
  --color-text-primary: #f8fafc;   /* neutral-50 */
  --color-text-secondary: #94a3b8; /* neutral-400 */
  --color-text-disabled: #64748b;  /* neutral-500 */
  --color-text-inverse: #0f172a;   /* neutral-900 */

  /* === SLOT STATUS (Tương phản AA trên nền tối) === */
  --color-slot-available: #14532d;
  --color-slot-available-text: #4ade80;
  --color-slot-held: #713f12;
  --color-slot-held-text: #fde047;
  --color-slot-booked: #1e3a8a;
  --color-slot-booked-text: #93c5fd;
  --color-slot-my-hold: #4c1d95;
  --color-slot-my-hold-text: #c4b5fd;
  --color-slot-blocked: #334155;
  --color-slot-blocked-text: #94a3b8;
  --color-slot-past: #0f172a;
  --color-slot-past-text: #475569;

  /* === SHADOWS (Tăng độ đậm trên nền tối) === */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.4);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.5), 0 2px 4px -2px rgb(0 0 0 / 0.4);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.6), 0 4px 6px -4px rgb(0 0 0 / 0.4);
}
```

#### 3.4.2. Đặc tả Hook `apps/web/lib/hooks/useTheme.ts`
Tạo mới file `apps/web/lib/hooks/useTheme.ts`:
- **Kiểu dữ liệu:**
  ```typescript
  export type ThemeMode = 'light' | 'dark' | 'system';
  export type ResolvedTheme = 'light' | 'dark';
  ```
- **Hằng số lưu trữ:** `const THEME_STORAGE_KEY = 'bsc-theme-mode';`
- **Logic quản lý state:**
  * State `theme: ThemeMode` (khởi tạo từ `localStorage`, mặc định `'system'`).
  * State `resolvedTheme: ResolvedTheme`.
  * Hàm `setTheme(mode: ThemeMode)`: cập nhật state, lưu `localStorage.setItem(THEME_STORAGE_KEY, mode)`.
  * Effect đồng bộ:
    - Nếu `theme === 'dark'`, thêm class `'dark'` vào `document.documentElement`, `resolvedTheme = 'dark'`.
    - Nếu `theme === 'light'`, xóa class `'dark'` khỏi `document.documentElement`, `resolvedTheme = 'light'`.
    - Nếu `theme === 'system'`, kiểm tra `window.matchMedia('(prefers-color-scheme: dark)').matches`:
      - Nếu matches: thêm `'dark'`, `resolvedTheme = 'dark'`.
      - Nếu không: xóa `'dark'`, `resolvedTheme = 'light'`.
      - Đồng thời gắn event listener `change` trên `MediaQueryList` để cập nhật realtime khi hệ thống đổi chế độ.
  * Hỗ trợ SSR an toàn: kiểm tra `typeof window !== 'undefined'`.

#### 3.4.3. Chống nhấp nháy FOUC (Anti-FOUC Theme Script)
Trong `apps/web/app/layout.tsx`:
Chèn một đoạn script inline nhỏ trong thẻ `<head>` để thiết lập class `dark` trước khi React hydrate:
```html
<script
  dangerouslySetInnerHTML={{
    __html: `(function(){try{var t=localStorage.getItem('bsc-theme-mode');var d=t==='dark'||(!t||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches;if(d){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){}})();`,
  }}
/>
```

#### 3.4.4. Đặc tả Component `apps/web/components/common/ThemeToggle.tsx`
Tạo mới file `apps/web/components/common/ThemeToggle.tsx`:
- Sử dụng Radix UI `DropdownMenu` (`@/components/ui/dropdown-menu`).
- Nút kích hoạt:
  * Kích thước: `size-9` (hoặc `size-10` trên mobile để đảm bảo touch target ≥ 44px).
  * Viền mỏng 1px: `border border-neutral-200 dark:border-neutral-700`.
  * Bo góc: `rounded-btn`.
  * Hiển thị icon tương ứng với theme hiện tại:
    - `resolvedTheme === 'dark'` -> `Moon` (`size-4 text-neutral-200`)
    - `resolvedTheme === 'light'` -> `Sun` (`size-4 text-amber-500`)
  * `aria-label="Chuyển chế độ giao diện"`.
- Menu tùy chọn (DropdownContent):
  * Lựa chọn 1: `Sáng` (Icon `Sun`, gọi `setTheme('light')`, highlight nếu `theme === 'light'`).
  * Lựa chọn 2: `Tối` (Icon `Moon`, gọi `setTheme('dark')`, highlight nếu `theme === 'dark'`).
  * Lựa chọn 3: `Hệ thống` (Icon `Monitor`, gọi `setTheme('system')`, highlight nếu `theme === 'system'`).
- Kiểm tra render an toàn phía client (`mounted` state) để tránh chênh lệch SSR/CSR.

#### 3.4.5. Tích hợp `ThemeToggle` vào Layout
1. **`apps/web/components/common/Header.tsx`:**
   - Desktop: Đặt cạnh `NotificationBell` và User Profile Dropdown.
   - Mobile: Đặt trong Drawer menu (dưới dạng nút chọn hoặc icon toggle tiện lợi).
2. **`apps/web/components/layout/DashboardShell.tsx`:**
   - Đặt trên topbar cạnh `NotificationBell` để Chủ sân và Admin cũng có thể đổi theme mọi lúc.

---

## 4. Kiến trúc File & Component cần tạo / cập nhật

```
apps/web/
├── app/
│   ├── (admin)/
│   │   └── error.tsx                      # [TẠO MỚI] Error boundary cho Admin Portal
│   ├── (owner)/
│   │   └── error.tsx                      # [TẠO MỚI] Error boundary cho Owner Portal
│   ├── (public)/
│   │   └── venues/
│   │       └── [slug]/
│   │           └── page.tsx               # [CẬP NHẬT] Thêm dynamic metadata SEO
│   ├── error.tsx                          # [TẠO MỚI] Error boundary cho Public routes
│   ├── global-error.tsx                   # [TẠO MỚI] Root fatal error boundary
│   ├── globals.css                        # [CẬP NHẬT] Thêm tokens màu .dark
│   ├── layout.tsx                         # [CẬP NHẬT] Thêm anti-FOUC theme inline script
│   ├── robots.ts                          # [TẠO MỚI] Cấu hình robots.txt chuẩn Next.js
│   └── sitemap.ts                         # [TẠO MỚI] Cấu hình sitemap.xml động
├── components/
│   ├── common/
│   │   ├── Footer.tsx                     # [CẬP NHẬT] Chuyển hardcoded text sang i18n useTranslations
│   │   ├── Header.tsx                     # [CẬP NHẬT] Tích hợp ThemeToggle desktop & mobile
│   │   └── ThemeToggle.tsx                # [TẠO MỚI] Component đổi Theme Sáng/Tối/Hệ thống
│   ├── features/
│   │   ├── owner/
│   │   │   ├── OwnerBookingsScreen.tsx    # [CẬP NHẬT] Tích hợp useOwnerRealtime
│   │   │   └── OwnerTimeline.tsx          # [CẬP NHẬT] Tích hợp useOwnerRealtime({ venueId })
│   │   └── venue/
│   │       ├── VenueDetailScreen.tsx      # [CẬP NHẬT] Nhúng VenueJsonLd
│   │       └── VenueJsonLd.tsx            # [TẠO MỚI] Component render Schema.org SportsActivityLocation
│   ├── layout/
│   │   └── DashboardShell.tsx             # [CẬP NHẬT] Tích hợp ThemeToggle trên topbar
│   └── ui/
│       └── data-table.tsx                 # [CẬP NHẬT] Chuẩn hóa i18n aria-label và phân trang
├── lib/
│   └── hooks/
│       ├── useOwnerRealtime.ts            # [TẠO MỚI] Hook chuyên biệt realtime cho Owner
│       ├── useSocket.ts                   # [TẠO MỚI] Facade hook realtime
│       └── useTheme.ts                    # [TẠO MỚI] Hook quản lý theme mode & system sync
└── messages/
    └── vi.json                            # [CẬP NHẬT] Bổ sung keys "footer", "table", "theme"
```

---

## 5. Ma trận Kiểm thử Chi tiết (Test Matrix)

Bộ phận `auto-tester` (9router_TESTER) bắt buộc phải viết và chạy pass 100% các test case sau:

### 5.1. Test Matrix: Realtime Owner Hook (`useOwnerRealtime.test.ts`)
| Mã Test | Mô tả Test Case | Dữ liệu đầu vào / Điều kiện | Kết quả mong đợi |
|:---|:---|:---|:---|
| `TC-RT-01` | Invalidate query & Toast khi có đơn đặt sân mới (`booking_created`) | Phát sự kiện `booking_created` với `bookingId: 'b-999', venueId: 'v-1'` | `queryClient.invalidateQueries` được gọi với `['owner', 'bookings']` và `['owner', 'timeline']`. `toast.info` được gọi chứa mã đơn `b-999`. |
| `TC-RT-02` | Lọc sự kiện theo `venueId` | Khởi tạo hook với `venueId: 'v-1'`, phát `slot_updated` của `venueId: 'v-2'` | Bỏ qua sự kiện, không trigger toast hoặc invalidate sai venue. |
| `TC-RT-03` | Invalidate query khi có minh chứng thanh toán (`payment_submitted`) | Phát sự kiện `payment_submitted` | `queryClient.invalidateQueries` được gọi với `['owner', 'payments']`. `toast.info` hiển thị thông báo khách đã thanh toán. |
| `TC-RT-04` | Dọn dẹp listener khi unmount | Render hook trong test harness và thực hiện unmount | Hàm `unsubscribe` của Socket được gọi, không rò rỉ listener bộ nhớ. |

### 5.2. Test Matrix: Error Boundaries (`error.test.tsx`, `global-error.test.tsx`)
| Mã Test | Mô tả Test Case | Dữ liệu đầu vào / Điều kiện | Kết quả mong đợi |
|:---|:---|:---|:---|
| `TC-ERR-01` | Render `app/error.tsx` khi có lỗi route | `error: new Error('Sự cố kết nối API')`, `reset: vi.fn()` | Hiển thị `ErrorState` có message lỗi, nút "Thử lại" và nút "Về trang chủ". Click "Thử lại" gọi đúng hàm `reset`. |
| `TC-ERR-02` | Render `app/(owner)/error.tsx` | `error: new Error('Lỗi tải danh sách sân')`, `reset: vi.fn()` | Hiển thị thông báo lỗi thân thiện, có nút "Thử lại" và link quay về `/owner/dashboard`. |
| `TC-ERR-03` | Render `app/global-error.tsx` | Lỗi fatal root, `reset: vi.fn()` | Render cấu trúc thẻ `<html>` và `<body>`, nút "Thử lại", không phụ thuộc các provider ngoài. |

### 5.3. Test Matrix: SEO, Sitemap, Robots & JSON-LD
| Mã Test | Mô tả Test Case | Dữ liệu đầu vào / Điều kiện | Kết quả mong đợi |
|:---|:---|:---|:---|
| `TC-SEO-01` | Cấu hình `robots.ts` | Gọi hàm `robots()` | Trả về object chứa `allow: ['/', '/venues', '/venues/*']`, `disallow: ['/admin/', '/owner/', '/bookings/', '/checkout/', '/api/']`, và đúng `sitemap` URL. |
| `TC-SEO-02` | Sinh sitemap động `sitemap.ts` | Mock hàm `listVenues` trả về 2 cơ sở | Trả về mảng chứa URL tĩnh (`/`, `/venues`, `/owner/apply`) và các URL động `/venues/[slug]` với đúng priority. |
| `TC-SEO-03` | Render JSON-LD `SportsActivityLocation` | Render `<VenueJsonLd venue={mockVenue} />` | Xuất thẻ `<script type="application/ld+json">` chứa JSON hợp lệ với `@type: "SportsActivityLocation"`, địa chỉ, tọa độ `geo`, `openingHoursSpecification`. |

### 5.4. Test Matrix: Dark Mode & ThemeToggle (`ThemeToggle.test.tsx`, `useTheme.test.ts`)
| Mã Test | Mô tả Test Case | Dữ liệu đầu vào / Điều kiện | Kết quả mong đợi |
|:---|:---|:---|:---|
| `TC-TH-01` | Đổi theme sang Dark mode | Click chọn "Tối" trên dropdown menu | Thẻ `<html>` có class `'dark'`, `localStorage` lưu `bsc-theme-mode = 'dark'`. |
| `TC-TH-02` | Đổi theme sang Light mode | Click chọn "Sáng" | Thẻ `<html>` không có class `'dark'`, `localStorage` lưu `bsc-theme-mode = 'light'`. |
| `TC-TH-03` | Đồng bộ System preference | Chọn mode "Hệ thống" và kích hoạt media query `matches: true` | Tự động thêm class `'dark'`. Khi media query đổi sang `matches: false`, tự động gỡ class `'dark'`. |
| `TC-TH-04` | Render ThemeToggle trên Header | Render `Header` | Nút đổi theme hiển thị rõ ràng trên thanh điều hướng, kích hoạt menu accessible với phím Tab/Enter. |

---

## 6. Tiêu chí Chấp thuận (Acceptance Criteria - Definition of Done)

1. **Anti-AI Design Checklist:**
   - [ ] Tuyệt đối không dùng gradient neon tím/hồng/xanh.
   - [ ] Bo góc đúng token (`rounded-btn` 8px, `rounded-card` 12px), không dùng `rounded-3xl`.
   - [ ] 100% biểu tượng dùng `lucide-react`, cấm emoji rác (🚀, ✨, 🔔, 🌓) trong nút bấm/giao diện.
   - [ ] Đủ 6 trạng thái UI (`Default`, `Hover`, `Focus-visible`, `Loading`, `Disabled`, `Error`).
2. **Kỹ thuật & Code Quality:**
   - [ ] `pnpm typecheck` không có lỗi Type.
   - [ ] `pnpm lint` không có cảnh báo (`--max-warnings=0`).
   - [ ] `pnpm --filter @bsc/web test` pass 100% các unit test mới và cũ.
   - [ ] Dark Mode không gây lỗi FOUC hay phá vỡ màu sắc của SlotGrid.
   - [ ] Realtime Owner tự động làm mới timeline/booking khi có event từ tab khác.

---

> **Bàn giao:** Tài liệu đặc tả đã hoàn thành, chuẩn chỉnh và đầy đủ chi tiết để chuyển giao trực tiếp cho `senior-dev` (9router_DEV) lập trình.
