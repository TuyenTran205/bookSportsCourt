# ĐẶC TẢ KỸ THUẬT: TRẠNG THÁI LOADING (SPINNER VÒNG TRÒN HIỆN ĐẠI) CHO TOÀN BỘ MÀN HÌNH

- **Mã tài liệu:** `SPEC-FE-LOADING-01`
- **Người thực hiện:** Fullstack Tech Lead (Đảm nhiệm tuần tự BA → DEV → TESTER → QA)
- **Dự án:** BookSportsCourt (Sàn đặt sân thể thao đa người dùng)
- **Trạng thái:** Approved / Ready for Dev

---

## 1. Bối cảnh & Mục tiêu

### 1.1. Hiện trạng
- Toàn bộ 32 routes trong thư mục `apps/web/app/` hiện **hoàn toàn chưa có file `loading.tsx` nào**.
- Khi người dùng (khách vãng lai, khách đã đăng nhập, chủ sân, admin) bấm chuyển trang hoặc tải lại trang, trình duyệt không có phản hồi thị giác tức thì (page transition delay), gây cảm giác đơ hoặc chậm chạp.
- `MockProvider.tsx` đang dùng spinner CSS thô cứng chưa được module hoá; trang `auth/callback/google` đang dùng trực tiếp icon `Loader2` riêng rẽ.

### 1.2. Mục tiêu đạt được
1. Bổ sung trạng thái loading vòng tròn xoay hiện đại (anti-AI design, tối giản, thanh lịch, chuẩn design token) cho **100% màn hình của tất cả các nhóm đối tượng người dùng**:
   - **Khách vãng lai (Guest):** Trang chủ `/`, Tìm sân `/venues`, Chi tiết cơ sở `/venues/[slug]`, Đăng nhập `/login`, Đăng ký `/register`, Quên mật khẩu `/forgot-password`, Đặt lại mật khẩu `/reset-password`, Xác thực email `/verify-email`, Đăng ký làm chủ sân `/owner/apply`, OAuth callback `/auth/callback/google`.
   - **Khách hàng đã đăng nhập (Customer):** Lịch đặt sân `/bookings`, Chi tiết đơn đặt `/bookings/[id]`, Sân yêu thích `/favorites`, Hồ sơ cá nhân `/profile`.
   - **Chủ sân (Owner):** Tổng quan vận hành `/owner/dashboard` & `/dashboard`, Lịch sân timeline `/owner/timeline`, Quản lý đơn đặt `/owner/bookings`, Cơ sở & Sân con `/owner/venues`, Giờ mở cửa & Bảng giá `/owner/pricing`, Duyệt thanh toán `/owner/payments`, Báo cáo doanh thu `/owner/revenue`, Đánh giá từ khách `/owner/reviews`, Cài đặt ngân hàng `/owner/settings`.
   - **Quản trị viên (Admin):** Tổng quan quản trị `/admin/dashboard`, Duyệt cơ sở `/admin/venues`, Duyệt hồ sơ chủ sân `/admin/owner-applications`, Quản lý người dùng `/admin/users`, Tra cứu đơn đặt `/admin/bookings`, Quản trị danh mục `/admin/catalogs`, Phân tích số liệu `/admin/analytics`, Nhật ký kiểm toán `/admin/audit-logs`.
2. Tạo 2 UI primitives chuẩn hóa tại `apps/web/components/ui/`:
   - `spinner.tsx`: Component vòng tròn xoay xoay chuẩn SVG geometric ring + conic arc mượt mà, hỗ trợ nhiều kích thước (`xs`, `sm`, `md`, `lg`, `xl`), màu sắc token, tuân thủ a11y (`role="status"`, `aria-live="polite"`, `prefers-reduced-motion`).
   - `page-loader.tsx`: Khung tải trang hoàn chỉnh bao bọc `Spinner` với nhãn tinh tế ("Đang tải trang…", "Đang xử lý dữ liệu…"), hỗ trợ chế độ toàn màn hình (`fullscreen`) và chế độ trong khung (`contained`).
3. Tích hợp `loading.tsx` vào tất cả các route groups và routes của Next.js 14 App Router:
   - Root: `app/loading.tsx`
   - Public: `app/(public)/loading.tsx`, `app/(public)/venues/loading.tsx`, `app/(public)/venues/[slug]/loading.tsx`, `app/(public)/(auth)/loading.tsx`
   - Customer: `app/(customer)/loading.tsx`, `app/(customer)/bookings/loading.tsx`, `app/(customer)/bookings/[id]/loading.tsx`, `app/(customer)/favorites/loading.tsx`, `app/(customer)/profile/loading.tsx`
   - Owner: `app/(owner)/loading.tsx`, `app/(owner)/dashboard/loading.tsx`, `app/(owner)/owner/loading.tsx`
   - Admin: `app/(admin)/loading.tsx`, `app/(admin)/admin/loading.tsx`
   - Auth callback: `app/auth/callback/google/loading.tsx`
4. Cập nhật `MockProvider.tsx` và các component tải dữ liệu để dùng đồng bộ `Spinner` / `PageLoader`.
5. Bộ test tự động (Vitest) kiểm thử toàn diện 100% routes và components loading, đảm bảo PASS 100%.

---

## 2. Tiêu chuẩn Thiết kế Anti-AI (Strict Anti-AI Rules)

- ❌ **CẤM:** Gradient màu tím hồng lòe loẹt, hiệu ứng phát sáng neon ảo diệu, spinner 3D xoắn ốc kiểu AI boilerplate.
- ❌ **CẤM:** Chèn emoji (ví dụ ⏳, 🔄, 🌀) vào màn hình loading hoặc nhãn tải.
- ❌ **CẤM:** Tự ý thêm các thư viện spinner cồng kềnh ngoài package.json.
- ✅ **ĐÚNG CHUẨN:**
  - Vòng tròn xoay thiết kế bằng SVG vector tinh xảo với stroke track nhạt (`neutral-200`) và arc quay chính màu thương hiệu sân cỏ (`primary-600`), bo góc đầu nét tròn (`stroke-linecap: round`).
  - Font chữ nhãn phụ đề tiếng Việt chuẩn, tinh gọn, màu `text-neutral-500` / `text-sm`.
  - Khả năng tiếp cận (Accessibility - a11y): có `role="status"`, `aria-label="Đang tải dữ liệu"`, và ẩn cho screen-reader `<span className="sr-only">Đang tải...</span>`.
  - Giảm chuyển động (Prefers Reduced Motion): khi người dùng bật chế độ giảm giật/chuyển động trên OS, spinner tự động chuyển sang hiệu ứng pulse mờ nhẹ thay vì xoay vòng tốc độ cao.

---

## 3. Kiến trúc Component & Giao diện API

### 3.1. `Spinner` (`components/ui/spinner.tsx`)
```typescript
export interface SpinnerProps extends React.SVGAttributes<SVGSVGElement> {
  /**
   * Kích thước:
   * - xs: 14px (dùng trong badge, inline text)
   * - sm: 16px (dùng trong button, input)
   * - md: 24px (mặc định)
   * - lg: 32px (card, modal)
   * - xl: 44px (page loader chính)
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Màu nét: primary (mặc định #16a34a) | white | neutral | current */
  variant?: 'primary' | 'white' | 'neutral' | 'current';
  /** Nhãn thông báo trợ năng */
  label?: string;
}
```

### 3.2. `PageLoader` (`components/ui/page-loader.tsx`)
```typescript
export interface PageLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Tiêu đề / câu thông báo dưới vòng xoay (mặc định "Đang tải trang…") */
  label?: string;
  /** Mô tả chi tiết nếu cần (tuỳ chọn) */
  description?: string;
  /** Kích thước spinner (mặc định "xl") */
  spinnerSize?: 'md' | 'lg' | 'xl';
  /** Toàn màn hình (min-h-screen) hay theo khung chứa (min-h-[50vh]) */
  fullscreen?: boolean;
}
```

---

## 4. Ma trận Phân bố `loading.tsx` theo từng Nhóm Người Dùng

| Nhóm người dùng | Route | File `loading.tsx` phục vụ | Giao diện hiển thị |
|---|---|---|---|
| **Chung** | Fallback toàn ứng dụng | `app/loading.tsx` | PageLoader toàn màn hình với nhãn "Đang tải trang…" |
| **Khách vãng lai** | Nhóm public chung | `app/(public)/loading.tsx` | Giữ nguyên Header & Footer, PageLoader trong phần thân |
| **Khách vãng lai** | `/venues` | `app/(public)/venues/loading.tsx` | Header + PageLoader tìm kiếm sân |
| **Khách vãng lai** | `/venues/[slug]` | `app/(public)/venues/[slug]/loading.tsx` | Header + PageLoader chi tiết sân |
| **Khách vãng lai** | `/(auth)/*` | `app/(public)/(auth)/loading.tsx` | Form card loader với vòng xoay tối giản |
| **Khách vãng lai** | `/owner/apply` | Kế thừa từ `app/(public)/loading.tsx` | Khung nộp hồ sơ chủ sân |
| **Khách vãng lai** | `/auth/callback/google` | `app/auth/callback/google/loading.tsx` | PageLoader xác thực Google OAuth |
| **Khách hàng (Customer)** | Nhóm customer chung | `app/(customer)/loading.tsx` | Giữ nguyên Header & Footer, PageLoader |
| **Khách hàng (Customer)** | `/bookings` | `app/(customer)/bookings/loading.tsx` | PageLoader lịch đặt sân |
| **Khách hàng (Customer)** | `/bookings/[id]` | `app/(customer)/bookings/[id]/loading.tsx` | PageLoader chi tiết đơn đặt |
| **Khách hàng (Customer)** | `/favorites` | `app/(customer)/favorites/loading.tsx` | PageLoader danh sách sân yêu thích |
| **Khách hàng (Customer)** | `/profile` | `app/(customer)/profile/loading.tsx` | PageLoader hồ sơ cá nhân |
| **Chủ sân (Owner)** | Nhóm owner chung | `app/(owner)/loading.tsx` | Giữ nguyên Sidebar & Topbar Dashboard, PageLoader |
| **Chủ sân (Owner)** | `/owner/dashboard` & `/dashboard` | `app/(owner)/owner/loading.tsx` & `app/(owner)/dashboard/loading.tsx` | DashboardShell + PageLoader tổng quan |
| **Chủ sân (Owner)** | `/owner/timeline` | Kế thừa từ `app/(owner)/owner/loading.tsx` | DashboardShell + PageLoader lịch sân |
| **Chủ sân (Owner)** | `/owner/bookings` | Kế thừa từ `app/(owner)/owner/loading.tsx` | DashboardShell + PageLoader đơn đặt |
| **Chủ sân (Owner)** | `/owner/venues` | Kế thừa từ `app/(owner)/owner/loading.tsx` | DashboardShell + PageLoader cơ sở |
| **Chủ sân (Owner)** | `/owner/pricing` | Kế thừa từ `app/(owner)/owner/loading.tsx` | DashboardShell + PageLoader bảng giá |
| **Chủ sân (Owner)** | `/owner/payments` | Kế thừa từ `app/(owner)/owner/loading.tsx` | DashboardShell + PageLoader thanh toán |
| **Chủ sân (Owner)** | `/owner/revenue` | Kế thừa từ `app/(owner)/owner/loading.tsx` | DashboardShell + PageLoader báo cáo |
| **Chủ sân (Owner)** | `/owner/reviews` | Kế thừa từ `app/(owner)/owner/loading.tsx` | DashboardShell + PageLoader đánh giá |
| **Chủ sân (Owner)** | `/owner/settings` | Kế thừa từ `app/(owner)/owner/loading.tsx` | DashboardShell + PageLoader cài đặt |
| **Quản trị viên (Admin)** | Nhóm admin chung | `app/(admin)/loading.tsx` | Giữ nguyên Sidebar Admin, Topbar, PageLoader |
| **Quản trị viên (Admin)** | `/admin/*` (toàn bộ 8 màn hình) | `app/(admin)/admin/loading.tsx` | DashboardShell Admin + PageLoader quản trị |

---

## 5. Chiến lược Kiểm thử (Test Strategy)

1. **Unit Test Component UI (`spinner.test.tsx`, `page-loader.test.tsx`):**
   - Kiểm tra render đúng SVG circle và path với các size `xs`, `sm`, `md`, `lg`, `xl`.
   - Kiểm tra thuộc tính trợ năng `role="status"`, `aria-label`, `<span className="sr-only">`.
   - Kiểm tra các biến thể màu `primary`, `neutral`, `white`.
   - Kiểm tra `PageLoader` render đúng label và description.
2. **Integration / Route Coverage Test (`route-loading.test.ts`):**
   - Quét kiểm tra tất cả 32 route pages trong hệ thống đều được bảo hộ bởi file `loading.tsx` tương ứng (theo đúng phân cấp Next.js App Router).
   - Xác nhận mọi `loading.tsx` export default một React Component hợp lệ render `Spinner` hoặc `PageLoader`.
3. **QA & Quality Gates:**
   - Chạy `pnpm typecheck` (tsc không lỗi).
   - Chạy `pnpm lint` (ESLint 0 warning).
   - Chạy `pnpm test` (100% tests pass).
   - Chạy `pnpm build` (Next.js build thành công và nhận diện đầy đủ các loading boundaries).
