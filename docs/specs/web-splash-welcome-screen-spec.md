# ĐẶC TẢ KỸ THUẬT: MÀN HÌNH CHÀO MỪNG THƯƠNG HIỆU (SPLASH BRAND REVEAL / WELCOME SCREEN) TRÊN NỀN TẢNG WEB

- **Mã tài liệu:** `SPEC-FE-SPLASH-01`
- **Tác giả:** Product Architect & UX Specifier (`ba-spec`)
- **Dự án:** BookSportsCourt (Sàn thương mại điện tử đặt sân thể thao đa người dùng)
- **Nền tảng mục tiêu:** Web Client (`apps/web` - Next.js 14 App Router, TypeScript, Tailwind CSS)
- **Tham chiếu đối ứng:** Ứng dụng Mobile Flutter (`bookSportsCourt_android/lib/features/splash/splash_screen.dart` & `app_brand_logo.dart`)
- **Trạng thái:** Approved / Sẵn sàng bàn giao cho `senior-dev`

---

## 1. Bối cảnh, Mục tiêu & Triết lý Thiết kế

### 1.1. Hiện trạng & Vấn đề cần giải quyết
1. **Trải nghiệm khởi động ban đầu trên Web:**
   - Khi người dùng truy cập trang web lần đầu, hệ thống đang phải tải tài nguyên, nạp CSS/Font (`Be Vietnam Pro`), và kích hoạt Mock Service Worker (`MockProvider.tsx`).
   - Giao diện chờ hiện tại của `MockProvider` chỉ là một nền trắng/xám với `Spinner` đơn điệu và dòng chữ *"Đang chuẩn bị dữ liệu mẫu…"*, thiếu hoàn toàn nhận diện thương hiệu, gây cảm giác ứng dụng thô sơ hoặc trang web đang bị giật/đơ.
2. **Khoảng cách trải nghiệm giữa Mobile và Web:**
   - Ứng dụng di động Flutter của BookSportsCourt đã sở hữu màn hình Splash chuyển động Material 3 cao cấp: hiệu ứng sóng radar mở rộng (GPS Radar Pulse), logo thể thao nổi khối sang trọng, khẩu hiệu định vị thương hiệu, và huy hiệu xác thực hệ thống sân bãi Việt Nam.
   - Phiên bản Web cần đồng bộ hóa nhận diện thương hiệu cao cấp này, mang lại trải nghiệm chào đón đồng nhất, ấn tượng nhưng nhẹ nhàng và không làm phiền người dùng.

### 1.2. Mục tiêu kỹ thuật & Trải nghiệm
1. **Tái hiện chuẩn xác tinh hoa chuyển động từ Mobile sang Web:**
   - Vòng sóng Radar Pulse ngọc lục bảo lan tỏa mượt mà quanh tâm logo.
   - Logo thương hiệu xuất hiện với nhịp Scale & Fade êm ái (tỉ lệ gia tốc chuẩn Material 3).
   - Khối nhận diện văn bản: `BookSportsCourt` + Slogan *"Đặt sân tức thì • Kết nối đam mê"*.
   - Footer Badge: Chấm xanh trạng thái + *"Hệ thống sân bãi thể thao Việt Nam"* + Số hiệu phiên bản.
   - Nền ánh sáng ngọc lục bảo dịu nhẹ (Subtle Emerald Wash) bằng radial gradient tinh tế, không làm chói mắt.
2. **Hiệu năng & Tối ưu hóa Web (Web-first Lifecycle):**
   - **Zero CLS (Cumulative Layout Shift = 0):** Hoạt động dưới dạng Overlay toàn màn hình (`fixed inset-0 z-[100]`), không làm xô lệch bất kỳ phần tử DOM nào của trang web bên dưới.
   - **Tích hợp thông minh với `MockProvider`:** Tận dụng 1.2s - 1.5s trình diễn splash để hoàn tất khởi động client services ngầm (MSW, session restore, auth check). Khi splash kết thúc, giao diện chính đã sẵn sàng 100%, loại bỏ hoàn toàn hiện tượng nhấp nháy màn hình (Zero-Flicker Entrance).
   - **Kiểm soát phiên duyệt (Session-based Display):** Chỉ hiển thị một lần duy nhất trong phiên làm việc (`sessionStorage`). Khi người dùng điều hướng giữa các trang (SPA routing), splash screen tuyệt đối không xuất hiện lại.
   - **Không giam giữ người dùng (User Agency):** Luôn có nút **"Bỏ qua"** ở góc trên cùng và hỗ trợ phím tắt `Esc` để người dùng có thể vào thẳng ứng dụng ngay lập tức nếu muốn.
   - **Tôn trọng khả năng tiếp cận (Accessibility & Reduced Motion):** Tự động điều chỉnh trạng thái tĩnh/mờ dịu khi người dùng kích hoạt `prefers-reduced-motion`.

---

## 2. Tiêu chuẩn Thiết kế Anti-AI (Strict Anti-AI Rules)

Tuân thủ nghiêm ngặt theo `docs/07-design-system.md` và `docs/08-ui-quality-rules.md`:

| Tiêu chí | ❌ HÀNH VI CẤM (AI Slop / Cliche) | ✅ CHUẨN THIẾT KẾ DỰ ÁN (Linear / Stripe Standard) |
|---|---|---|
| **Màu sắc nền** | CẤM gradient tím hồng neon, gradient cầu vồng 3D (`from-purple-500 via-pink-500 to-indigo-500`). | Sử dụng nền trắng sạch `neutral-0` (`#ffffff`) kết hợp một vùng phủ tán quang tròn ngọc lục bảo rất nhạt ở đỉnh (`primary-50` / `rgba(240, 253, 244, 0.85)`). |
| **Bo góc (Border Radius)** | CẤM bo góc lố lăng `rounded-3xl` hoặc bo tròn dị dạng không có cấu trúc. | Badge dùng `rounded-full`, nút Bỏ qua dùng `rounded-btn` (8px), khung logo bo góc chuẩn tỉ lệ vàng `20px - 24px`. |
| **Biểu tượng (Icons)** | CẤM chèn emoji rác (🚀, ✨, ⚽, ⚡, 🌟) vào giao diện và văn bản. | 100% biểu tượng dùng SVG vector hoặc Lucide Icons (`X`, `CheckCircle2`, `Compass`) với kích thước cố định, nét stroke 1.5px. |
| **Hiệu ứng vòng sóng** | CẤM hiệu ứng phát sáng neon chói lóa (neon glow/drop-shadow neon). | Đường viền sóng tròn mỏng `1.5px - 2px` màu `primary-400` với độ mờ mờ dần từ `0.4` về `0` khi lan rộng. |
| **Văn phong & Typography** | CẤM các câu khẩu hiệu vô nghĩa kiểu AI: *"Elevate your sports journey to next dimension"*. | Tiếng Việt chuẩn mực, gãy gọn: *"BookSportsCourt - Đặt sân tức thì • Kết nối đam mê"*. Font chữ hệ thống `Be Vietnam Pro` + `Inter`. |
| **Trạng thái & Tương tác** | CẤM dùng alert/confirm của trình duyệt hoặc modal chặn bắt buộc. | Phím `Esc`, nút "Bỏ qua" với touch-target ≥ 44px, viền mỏng 1px sạch sẽ, trạng thái hover/focus rõ ràng. |

---

## 3. Kiến trúc Component & Tổ chức Thư mục

### 3.1. Sơ đồ Cấu trúc File

```
apps/web/
├── public/
│   └── images/
│       └── app_logo.png                # Asset logo gốc chuẩn từ Mobile App (1024x1024)
├── components/
│   └── common/
│       ├── AppBrandLogo.tsx            # Component Logo thể thao đa năng (Raster + Vector Fallback)
│       ├── AppBrandLogo.test.tsx       # Unit test cho AppBrandLogo
│       ├── SplashBrandReveal.tsx       # Màn hình Splash Welcome Screen hoàn chỉnh
│       ├── SplashBrandReveal.test.tsx  # Unit test chuyên sâu cho SplashBrandReveal
│       └── MockProvider.tsx            # Nâng cấp MockProvider để đồng bộ với Splash
└── app/
    ├── layout.tsx                      # Tích hợp SplashBrandReveal vào Root Layout
    └── globals.css                     # Bổ sung keyframes animation chuyển động mượt mà
```

---

## 4. Đặc tả Kỹ thuật Chi tiết từng Component

### 4.1. Component `AppBrandLogo` (`components/common/AppBrandLogo.tsx`)
Component logo độc lập, tái sử dụng được ở Header, Footer, Auth pages và Splash Screen.

#### Thông số Props (TypeScript Interface)
```typescript
export interface AppBrandLogoProps {
  /** Kích thước vuông (px): mặc định 80px */
  size?: number;
  /** Bán kính bo góc (px): mặc định 20px */
  borderRadius?: number;
  /** Hiển thị bóng đổ nhận diện: mặc định true */
  showShadow?: boolean;
  /** Ưu tiên nạp ảnh sớm (LCP optimization) */
  priority?: boolean;
  /** Class tùy biến bổ sung */
  className?: string;
  /** Ép hiển thị chế độ vector fallback (dùng cho test/offline) */
  forceFallback?: boolean;
}
```

#### Thiết kế Vector Fallback (Chính xác theo Mobile Flutter)
Khi ảnh `app_logo.png` chưa tải xong hoặc bị lỗi mạng (404/offline), component tự động hiển thị sân thể thao Vector SVG:
- **Nền:** Màu xanh cỏ sân vận động `var(--color-primary-700)` (`#15803d`).
- **Đường kẻ sân (Pitch Center Line):** Vạch dọc thẳng đứng màu trắng mờ `rgba(255, 255, 255, 0.25)` rộng `1.5px`.
- **Vòng tròn trung tâm (Center Circle):** Đường tròn tâm sân kích thước `size * 0.65`, viền trắng mờ `rgba(255, 255, 255, 0.3)` dày `1.5px`.
- **Biểu tượng quả bóng thể thao:** Biểu tượng bóng đá / thể thao SVG sắc nét màu trắng tinh (`#ffffff`), kích thước `size * 0.45` đặt chính giữa.

#### Thiết kế Đổ bóng nhận diện (Branded Elevation Shadow)
- Khi `showShadow = true`, áp dụng 2 lớp bóng đổ tinh xảo:
  - Lớp 1 (Ambient Grass Glow): `0 8px 20px -4px rgba(21, 128, 61, 0.22)` (ánh xanh sân cỏ dịu).
  - Lớp 2 (Sharp Elevation): `0 2px 6px 0 rgba(0, 0, 0, 0.06)` (bóng chân tiếp xúc).

---

### 4.2. Component `SplashBrandReveal` (`components/common/SplashBrandReveal.tsx`)

#### Thông số Props (TypeScript Interface)
```typescript
export interface SplashBrandRevealProps {
  /** Thời gian hiển thị hiệu ứng trước khi bắt đầu fade-out (ms). Mặc định 1850ms */
  duration?: number;
  /** Thời gian chuyển tiếp hiệu ứng biến mất (ms). Mặc định 400ms */
  exitDuration?: number;
  /** Callback kích hoạt khi splash screen đã đóng hoàn toàn */
  onFinished?: () => void;
  /** Ép buộc hiển thị bất chấp sessionStorage (dành cho Demo, Review, Testing) */
  forceShow?: boolean;
  /** Cờ báo hiệu client app đã sẵn sàng (Mock / Auth). Nếu chưa sẵn sàng, giữ màn hình mượt mà */
  isAppReady?: boolean;
}
```

#### Các Giai đoạn Chuyển động (Choreography Timeline - 1850ms)

```
0ms               500ms             900ms             1400ms            1850ms        2250ms
|-----------------|-----------------|-----------------|-----------------|-------------|
[--- Phase 1 ---]
 Logo Scale & Fade
 (0ms - 550ms)
         [------- Phase 2 -------]
          Radar Wave Pulse
          (350ms - 1100ms)
                  [------- Phase 3 -------]
                   Text & Slogan Slide Up
                   (480ms - 1300ms)
                           [------- Phase 4 -------]
                            Footer Pill Badge Fade In
                            (750ms - 1500ms)
                                                      [--- Phase 5 ---]
                                                       Exit Fade Out (400ms)
                                                       -> Unmount
```

1. **Phase 1 - Khởi đầu Logo (0ms - 550ms):**
   - Logo phóng to từ tỉ lệ `0.72` lên `1.0` với đường cong `cubic-bezier(0.25, 1, 0.5, 1)` (Hiệu ứng mở êm ái, thong thả, tự nhiên).
   - Độ mờ (Opacity) tăng tuyến tính từ `0.0` lên `1.0`.
2. **Phase 2 - Sóng Radar GPS (350ms - 1100ms):**
   - Vòng tròn radar đồng tâm bao quanh Logo bắt đầu bung rộng từ đường kính `104px` lên tỉ lệ `scale(1.48)` trong 750ms (`cubic-bezier(0, 0, 0.2, 1)`).
   - Viền tròn dày `2px` màu `primary-400` (`#4ade80`).
   - Độ mờ giảm dần từ `0.55` về `0.0`, tạo cảm giác sóng quét vị trí sân bãi thể thao tức thì.
3. **Phase 3 - Xuất hiện Tiêu đề & Khẩu hiệu (480ms - 1300ms):**
   - Khối chữ trượt nhẹ từ dưới lên trong 480ms (`cubic-bezier(0.16, 1, 0.3, 1)`): `translateY(14px) → translateY(0px)` kết hợp fade-in từ `0.0` lên `1.0`.
   - Tiêu đề thương hiệu:
     - Chữ `BookSports`: màu `neutral-900` (`#0f172a`), font chữ cực dày `font-extrabold`, `tracking-tight`.
     - Chữ `Court`: màu `primary-700` (`#15803d`), font `font-extrabold`, tạo điểm nhấn nhận diện.
   - Slogan định vị: *"Đặt sân tức thì • Kết nối đam mê"*, font `text-sm text-neutral-600 font-medium`.
4. **Phase 4 - Huy hiệu Chân trang (750ms - 1500ms):**
   - Fade-in nhẹ nhàng ở chân màn hình trong 450ms (`ease-out`).
   - Pill Badge: Nền `primary-50` (`#f0fdf4`), viền mỏng `1px` màu `primary-200` (`#bbf7d0`), bo tròn `rounded-full`.
   - Bên trong có chấm trạng thái xanh ngọc `primary-600` (`#16a34a`) có viền bảo vệ.
   - Dòng chữ: *"Hệ thống sân bãi thể thao Việt Nam"* (`text-xs font-semibold text-primary-800`).
   - Dòng phụ: *"Phiên bản 2.2.0 • Web Experience"* (`text-[11px] text-neutral-400 font-normal`).
5. **Phase 5 - Biến mất Êm ái (Exit Transition - 400ms):**
   - Toàn bộ khung Splash overlay nhận class mờ dần: `opacity: 0; pointer-events: none; transition: opacity 400ms ease-out`.
   - Sau khi transition kết thúc (400ms), component gỡ bỏ khỏi DOM (`unmounted`), giải phóng hoàn toàn bộ nhớ.

---

## 5. Cơ chế Vòng đời & Tích hợp Hệ thống (Web Lifecycle)

### 5.1. Quản lý Trạng thái Session (`sessionStorage`)
- **Key lưu trữ:** `bsc_welcome_splash_shown`
- **Quy tắc kích hoạt:**
  ```typescript
  const STORAGE_KEY = 'bsc_welcome_splash_shown';
  
  // Kiểm tra cờ trong sessionStorage
  const hasShown = typeof window !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY) : 'true';
  
  // URL override cho phép dev / QA / tester kích hoạt lại bất kỳ lúc nào:
  // Ví dụ: http://localhost:3000/?splash=force hoặc ?welcome=1
  const searchParams = new URLSearchParams(window.location.search);
  const isForce = searchParams.get('splash') === 'force' || searchParams.get('welcome') === '1';
  
  const shouldDisplay = isForce || !hasShown;
  ```
- **Ghi nhận đã hiển thị:** Ngay khi Splash bắt đầu hiển thị, ghi `sessionStorage.setItem(STORAGE_KEY, 'true')` để đảm bảo F5 hoặc nhảy route trong cùng session không bị lặp lại.

### 5.2. Đồng bộ hóa với `MockProvider` (Zero-Flicker Coordination)
Hiện tại `MockProvider` cần nạp Service Worker khi `NEXT_PUBLIC_API_MOCKING === 'enabled'`.
Cơ chế phối hợp:
1. `MockProvider` nạp MSW trong nền.
2. `SplashBrandReveal` hiển thị phía trên (`z-[100]`), chạy hoạt cảnh 1850ms.
3. Khi hiệu ứng 1850ms kết thúc:
   - Nếu `MockProvider` đã ready: Splash bắt đầu fade-out ngay.
   - Nếu `MockProvider` mất nhiều thời gian hơn (ví dụ mạng chậm, tối đa 3.5s timeout): Splash giữ trạng thái hoàn thành kèm thanh chỉ báo tiến trình mảnh (`h-0.5 bg-primary-600`) ở chân trang, không bao giờ hiện màn hình lỗi xám xịt cho người dùng.

### 5.3. Nút "Bỏ qua" (Instant Escape Hatch)
- **Vị trí:** Cố định ở góc phải trên cùng (`top-4 right-4 sm:top-6 sm:right-6`).
- **Thiết kế:** Nút bấm phẳng, không phô trương:
  - Icon Lucide `X` (kích thước 16px).
  - Nhãn *"Bỏ qua"* (`text-xs font-medium text-neutral-500 hover:text-neutral-900`).
  - Viền mỏng `1px border-neutral-200/80 bg-white/80 hover:bg-neutral-100`.
  - Touch target đạt chuẩn tối thiểu `44x44px`.
- **Phím tắt:** Bắt sự kiện bàn phím `keydown` với phím `Escape` (`e.key === 'Escape'`) để lập tức fade out splash.

### 5.4. Hỗ trợ Giảm chuyển động (`prefers-reduced-motion`)
- Kiểm tra truy vấn media: `window.matchMedia('(prefers-reduced-motion: reduce)')`.
- Khi người dùng bật chế độ này:
  - Tắt toàn bộ chuyển động Scale lò xo của Logo.
  - Tắt vòng sóng Radar Pulse.
  - Logo và Text hiển thị cố định ngay lập tức với độ mờ dịu mắt.
  - Thời gian hiển thị rút ngắn xuống còn 600ms rồi mờ dần nhẹ nhàng.

---

## 6. Ma trận Đáp ứng Màn hình (Responsive Specifications)

Giao diện Splash Screen tương thích hoàn hảo 100% trên mọi kích thước thiết bị:

| Thiết bị | Kích thước Viewport | Kích thước Logo | Khoảng cách & Vòng sóng | Typography Tiêu đề | Typography Slogan & Footer |
|---|---|---|---|---|---|
| **Mobile nhỏ** | 320px – 375px (iPhone SE, Galaxy A) | `size = 76px`, bo góc `18px` | Radar ring: `84px → 120px`, Gap: `16px` | `text-2xl` (22px), `font-extrabold` | Slogan: `text-xs`, Footer pill: `px-3 py-1`, chữ `11px` |
| **Mobile chuẩn** | 390px – 480px (iPhone 14/15, Pixel) | `size = 88px`, bo góc `20px` | Radar ring: `96px → 140px`, Gap: `20px` | `text-2xl` (24px), `font-extrabold` | Slogan: `text-xs`, Footer pill: `px-3.5 py-1.5`, chữ `11.5px` |
| **Tablet** | 768px – 1023px (iPad Mini, Air) | `size = 100px`, bo góc `22px` | Radar ring: `108px → 158px`, Gap: `24px` | `text-3xl` (28px), `font-extrabold` | Slogan: `text-sm`, Footer pill: `px-4 py-1.5`, chữ `12px` |
| **Laptop / Desktop** | 1024px – 1440px (MacBook, PC) | `size = 104px`, bo góc `24px` | Radar ring: `112px → 165px`, Gap: `24px` | `text-3xl` (30px), `font-extrabold` | Slogan: `text-sm`, Footer pill: `px-4 py-2`, chữ `12px` |
| **Màn hình lớn** | 1920px+ (UltraWide, 4K) | `size = 112px`, bo góc `24px` | Radar ring: `120px → 180px`, Gap: `28px` | `text-4xl` (34px), `font-extrabold` | Slogan: `text-base`, Footer pill: `px-5 py-2`, chữ `13px` |

---

## 7. Các Trường hợp Biên & Ngoại lệ (Edge Cases & Resilience)

1. **Người dùng mở nhiều Tab cùng lúc:**
   - `sessionStorage` hoạt động độc lập theo từng tab. Mỗi tab mới khi mở ra sẽ có một lần trải nghiệm nhận diện thương hiệu mượt mà, nhưng các hành động back/forward/navigation nội bộ trong tab đó sẽ không bị lặp lại.
2. **Trình duyệt chặn hoặc lỗi `sessionStorage` (Private Mode / Security Policy):**
   - Bọc toàn bộ lệnh truy cập `sessionStorage` trong khối `try/catch`.
   - Nếu `sessionStorage` bị chặn, fallback an toàn sang biến cờ bộ nhớ in-memory (Module-scoped variable) để không làm crash trang web.
3. **Ảnh `app_logo.png` chưa tải kịp:**
   - Dùng cờ `onError` của thẻ `Image` / Next Image để tự động chuyển sang Vector Fallback tức thì. Không bao giờ để lộ khung ảnh vỡ (broken image icon) của trình duyệt.
4. **Hành vi cuộn trang khi Splash đang mở:**
   - Khi Splash đang hoạt động, thêm style `overflow: hidden` vào thẻ `document.body` để ngăn người dùng cuộn nội dung nền.
   - Khi Splash unmount, khôi phục lại `overflow: ''` nguyên vẹn.
5. **Chống kẹt vô hạn (Watchdog Safety Timeout):**
   - Đặt một bộ đếm thời gian an toàn tối đa 4000ms. Dù bất kỳ sự cố JavaScript hay Promise nào xảy ra, Splash Screen bắt buộc phải tự động kích hoạt fade-out và unmount, đảm bảo người dùng luôn luôn truy cập được vào ứng dụng.

---

## 8. Ma trận Kiểm thử Chi tiết (Test Matrix cho `auto-tester`)

Bộ kiểm thử được xây dựng bằng Vitest + React Testing Library tại `apps/web/`:

| Mã Test Case | Hạng mục kiểm thử | Kịch bản / Đầu vào | Kết quả kỳ vọng |
|---|---|---|---|
| `TC-LOGO-01` | `AppBrandLogo` Render | Render với size mặc định (80px) | Có container kích thước 80x80px, bo góc và shadow hợp lệ. |
| `TC-LOGO-02` | `AppBrandLogo` Fallback | Kích hoạt cờ `forceFallback=true` | Hiển thị nền xanh `primary-700`, vạch sân SVG và biểu tượng thể thao, không render `img`. |
| `TC-LOGO-03` | `AppBrandLogo` Custom Size | Truyền `size={120}`, `borderRadius={28}` | Thuộc tính style/class tương ứng kích thước 120px và radius 28px. |
| `TC-SPLASH-01` | First-time Visit | `sessionStorage` trống | Component render Splash Overlay với đầy đủ Logo, Tiêu đề "BookSportsCourt", Slogan, Footer Badge. |
| `TC-SPLASH-02` | Returning Visit | `sessionStorage` đã có cờ `bsc_welcome_splash_shown = 'true'` | Component trả về `null` ngay lập tức, không render overlay. |
| `TC-SPLASH-03` | Force Override | Đã có cờ trong storage nhưng URL có `?splash=force` | Vẫn render Splash Screen để phục vụ kiểm thử / demo. |
| `TC-SPLASH-04` | Auto-dismiss Timer | Khởi chạy với `duration=1850`, sử dụng fake timers `vi.advanceTimersByTime(1850)` | Kích hoạt hiệu ứng fade-out và gọi `onFinished` callback sau khi hoàn tất (sau thêm 400ms `exitDuration`). |
| `TC-SPLASH-05` | Nút "Bỏ qua" (Click) | Người dùng bấm nút "Bỏ qua" | Kích hoạt đóng Splash ngay lập tức mà không cần chờ hết 1850ms. |
| `TC-SPLASH-06` | Phím tắt Escape | Người dùng nhấn phím `Escape` trên bàn phím | Bắt sự kiện keydown và đóng Splash ngay lập tức. |
| `TC-SPLASH-07` | Prefers Reduced Motion | Giả lập `prefers-reduced-motion: reduce` | Các animation class chuyển động mạnh được gỡ bỏ hoặc thay bằng hiệu ứng tĩnh mờ dịu. |
| `TC-SPLASH-08` | Chống xô lệch Layout | Kiểm tra container Splash | Có thuộc tính `fixed inset-0 z-[100]`, layout của body bên dưới không bị thay đổi (CLS = 0). |

---

## 9. Kế hoạch Triển khai dành cho `senior-dev`

1. **Bước 1 - Chuẩn bị Assets:**
   - Sao chép file logo gốc `G:\Slides_BaiGiangTLU\ChuyenDeCNTT\bookSportsCourt_android\assets\images\app_logo.png` sang thư mục `apps/web/public/images/app_logo.png`.
2. **Bước 2 - Viết UI Primitives:**
   - Tạo `apps/web/components/common/AppBrandLogo.tsx`: Component hiển thị Logo nhận diện chuẩn xác.
   - Thêm keyframe chuyển động radar pulse và logo entrance vào `apps/web/app/globals.css` (hoặc cấu hình Tailwind utilities).
3. **Bước 3 - Xây dựng Màn hình Chào:**
   - Tạo `apps/web/components/common/SplashBrandReveal.tsx`: Component Splash Screen đầy đủ các phase và nút bỏ qua.
4. **Bước 4 - Tích hợp Hệ thống:**
   - Nâng cấp `apps/web/components/common/MockProvider.tsx` và gắn `SplashBrandReveal` vào `apps/web/app/layout.tsx`.
5. **Bước 5 - Chuyển giao `auto-tester`:**
   - Bàn giao danh sách Test Matrix để `auto-tester` viết các bộ test Vitest đạt 100% tỷ lệ pass.

---
*Tài liệu đặc tả này đã được phê duyệt bởi Product Architect & BA Specifier (`ba-spec`). Đề nghị Orchestrator chuyển giao ngay cho `senior-dev` để tiến hành lập trình.*
