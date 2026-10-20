# ĐẶC TẢ KỸ THUẬT — THIẾT KẾ LẠI TRANG CHỦ CHUẨN ANTI-AI DESIGN

- **Mã spec:** `SPEC-HOME-003`
- **Phiên bản:** `1.0.0`
- **Tác giả:** Product Architect & UX Specifier (`9router_BA`)
- **Trạng thái:** Approved — sẵn sàng bàn giao `senior-dev`
- **Dự án:** BookSportsCourt (Next.js 14.2 App Router · Tailwind CSS · next-intl)
- **Phạm vi áp dụng:** `apps/web/app/(public)/page.tsx` và `apps/web/messages/vi.json`
- **Tài liệu liên quan:**
  - `docs/07-design-system.md` (Design tokens, màu sắc, typography, bo góc, icon)
  - `docs/08-ui-quality-rules.md` (Quy tắc chất lượng UI, các điều cấm CAM-01 đến CAM-13)
  - `docs/09-frontend-conventions.md` (Quy ước Frontend, App Router, next-intl)
  - `docs/11-api-contract.md` (Hợp đồng API danh mục sân và thể thao)

---

## 1. Bối cảnh & Hiện trạng vi phạm

### 1.1. Bối cảnh
Trang chủ (`apps/web/app/(public)/page.tsx`) là điểm tiếp xúc đầu tiên của khách hàng (người chơi thể thao) và chủ sân khi truy cập nền tảng BookSportsCourt.
Hiện tại, trang chủ được dựng tạm để kiểm thử chức năng nhưng tồn tại nhiều điểm lệch chuẩn nghiêm trọng so với bộ quy tắc chất lượng UI đã ban hành tại `docs/08-ui-quality-rules.md`, tạo cảm giác "template marketing rẻ tiền" (SaaS landing cliché) thay vì một sàn thương mại điện tử thể thao chuyên nghiệp theo tinh thần Linear / Stripe / Airbnb.

### 1.2. Hiện trạng vi phạm chi tiết

| # | Vị trí code trong `apps/web/app/(public)/page.tsx` | Điều cấm vi phạm | Mô tả lỗi vi phạm | Hệ quả UI / UX |
|---|---|---|---|---|
| 1 | Dòng 24–30: Mảng `POPULAR_SPORTS` chứa emoji trực tiếp (`🏸`, `🏓`, `⚽`, `🎾`, `🏀`). | **CAM-04** (Emoji làm icon UI), mục 8 của `docs/07-design-system.md` | Sử dụng emoji hệ điều hành làm biểu tượng thể thao, hiển thị không đồng nhất giữa iOS, Android, Windows, Linux; kém chuyên nghiệp. | Giao diện giống blog cá nhân hoặc prototype nghiệp dư, phá vỡ hệ thống icon Lucide thống nhất của toàn dự án. |
| 2 | Dòng 52–105: Hero Section căn giữa toàn bộ (`items-center text-center`, form `max-w-xl mx-auto`, chips `justify-center`). | **CAM-02** (Hero căn giữa + SaaS landing cliché), **CAM-09** (Căn giữa mọi thứ) | Toàn bộ nội dung bị dồn vào một cột giữa màn hình; khoảng trống hai bên quá lớn trên desktop `lg:` và `xl:`; không có điểm nhấn thị giác trực quan. | Thị giác đơn điệu, khó đọc quét (scanability thấp), thiếu thông tin giá trị thực về sân trống và công nghệ realtime. |
| 3 | Dòng 109–150: Section "Lý do chọn nền tảng" căn giữa (`text-center`, card `items-center text-center`). | **CAM-02** (3 card feature giống nhau đổn giữa), **CAM-09** (Căn giữa mọi thứ) | 3 card giới thiệu tính năng dồn vào giữa với text căn giữa làm mất điểm neo mắt (left-aligned anchor), đoạn văn căn giữa rất khó đọc khi xuống dòng. | Giao diện bị đóng khung kiểu template marketing cổ điển, không thể hiện chất công nghệ dense/compact của dự án. |
| 4 | Dòng 153–170: Section "Số liệu thống kê" căn giữa (`text-center`, `flex flex-col items-center`). | **CAM-09** (Căn giữa mọi thứ), Thang cỡ chữ mục 4 của `docs/07-design-system.md` | Các khối số liệu đặt ở giữa, không có `tabular-nums`, thiếu phân cách cột số đo lường giữa các chỉ số. | Số liệu bị "trôi nổi" trên nền xám, khó so sánh và thiếu tính đáng tin cậy. |
| 5 | Dòng 173–191: Section CTA chủ sân căn giữa (`flex flex-col items-center text-center`). | **CAM-09** (Căn giữa mọi thứ), **CAM-08** (Nền gradient/căn giữa marketing) | Banner kêu gọi chủ sân dồn toàn bộ text và nút bấm vào giữa, nút bấm đặt bên dưới đoạn văn dài gây lãng phí chiều ngang desktop. | Tỉ lệ chuyển đổi thấp trên màn hình rộng, không tối ưu luồng hành vi đọc F-pattern của chủ sân. |
| 6 | Dòng 56, 114, 176–181: Chuỗi tiếng Việt hard-code trực tiếp trong JSX. | Quy tắc bắt buộc của `docs/09-frontend-conventions.md` (i18n next-intl) | Các chuỗi text: "Nền tảng đặt sân...", "Công nghệ tiên tiến...", "Bạn là chủ sân thể thao?", "Gia nhập mạng lưới...", "Đăng ký mở cơ sở ngay", "Xem thử kênh quản lý" không đi qua `tHome()`. | Vi phạm nguyên tắc zero hard-coded string; không thể mở rộng đa ngôn ngữ, không đồng bộ quản lý nội dung. |
| 7 | Dòng 54–57: Badge Hero dùng icon `Sparkles`. | Nguyên tắc Anti-AI Design (Cấm biểu tượng AI rình rang) | Icon `Sparkles` kiểu trợ lý AI làm loãng thông điệp sàn thương mại điện tử thể thao thực tế. | Giao diện bị nhầm lẫn với công cụ AI tạo sinh. |

---

## 2. Bảng đối chiếu vi phạm trước và sau cải tiến

| Thành phần | Trước khi sửa (Hiện tại) | Sau khi sửa (Chuẩn Anti-AI / Linear / Stripe) |
|---|---|---|
| **Chip môn thể thao** | Định nghĩa mảng: `{ name: 'Cầu lông', slug: 'cau-long', icon: '🏸' }`. Dùng emoji hệ điều hành. | Định nghĩa mảng với Lucide icon component: `Activity`, `CircleDot`, `Table2`, `Circle`, `CircleDashed`. Stroke 1.5, cỡ `size-3.5` (14px) hoặc `size-4` (16px). |
| **Hero Section** | Một cột duy nhất căn giữa (`container flex flex-col items-center text-center`), form tìm kiếm và chip dồn giữa. | Layout 2 cột bất đối xứng trên `lg:` (`grid lg:grid-cols-12 gap-12 items-center`). Cột trái (7 cols) căn trái tự nhiên (`text-left items-start`), cột phải (5 cols) là Live Visual Preview Card mô phỏng lịch trống và đặt sân realtime. |
| **Hero Badge** | Chuỗi hard-code dòng 56, icon `Sparkles`, căn giữa. | Icon `ShieldCheck` `size-3.5`, chuỗi lấy từ `tHome('heroBadge')`, căn trái cùng khối tiêu đề. |
| **Lý do chọn nền tảng** | Header căn giữa (`text-center`), 3 card căn giữa (`items-center text-center`). | Header căn trái (`text-left max-w-2xl`). 3 card căn trái toàn diện (`items-start text-left`), icon box vuông bo góc nhẹ `size-11 rounded-lg bg-primary-50 text-primary-700 border border-primary-100/60`, chuỗi phụ đề qua `tHome('whySubtitle')`. |
| **Số liệu thống kê** | Các khối số liệu dồn giữa `text-center sm:grid-cols-3`. | Grid 3 cột căn trái (`text-left items-start`), có divider mỏng `border-l border-neutral-200` giữa các cột trên `sm:`, dùng class `tabular-nums font-bold tracking-tight`, số ở trên nhãn ở dưới rõ ràng. |
| **CTA Chủ sân** | Section căn giữa toàn bộ trên nền `bg-primary-800`. | Banner split-layout 2 cột trên desktop (`md:flex md:items-center md:justify-between gap-8 text-left`). Bên trái là tiêu đề và mô tả căn trái; bên phải là 2 nút hành động (`/owner/apply` và `/owner/timeline`). |
| **Quản lý chuỗi i18n** | 6 chuỗi tiếng Việt viết tay trực tiếp trong file `page.tsx`. | 100% chuỗi hiển thị được khai báo trong namespace `home` của `apps/web/messages/vi.json` và được gọi thông qua `tHome(...)`. |

---

## 3. Danh mục yêu cầu kỹ thuật chi tiết

### REQ-HOME-01: Chuẩn hóa Chip môn thể thao bằng Lucide Icon
- **Mô tả:** Thay thế toàn bộ emoji trong mảng `POPULAR_SPORTS` bằng icon component từ thư viện `lucide-react`.
- **Ánh xạ icon – môn thể thao:**
  - Cầu lông (`cau-long`): Icon `Activity` (phù hợp nhịp vận động).
  - Pickleball (`pickleball`): Icon `Table2`.
  - Bóng đá mini (`bong-da`): Icon `CircleDot`.
  - Tennis (`tennis`): Icon `Circle`.
  - Bóng rổ (`bong-ro`): Icon `CircleDashed`.
- **Quy cách giao diện chip:**
  - Icon: kích thước `size-3.5` (14px) trên mobile, `size-4` (16px) trên desktop, `strokeWidth={1.5}`.
  - Tag HTML: `<Link href={`/venues?sport=${sport.slug}`}>`.
  - Class CSS: `inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-700 transition-colors duration-150 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-800 focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-1`.
  - Căn lề: Căn trái tự nhiên (`flex-wrap items-center justify-start gap-2`), không căn giữa `justify-center`.

### REQ-HOME-02: Tái cấu trúc Hero Section sang layout 2 cột (Linear / Stripe style)
- **Mô tả:** Chuyển đổi section Hero thành layout 2 cột bất đối xứng trên màn hình desktop (`lg:` trở lên).
- **Phân bố cột trên Desktop (`lg:grid-cols-12`):**
  - **Cột trái (`lg:col-span-7 flex flex-col items-start text-left`):**
    1. *Badge tin cậy:* `<div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-100/60 px-3.5 py-1 text-xs font-semibold text-primary-800">` với icon `ShieldCheck` (`size-3.5`) và text `{tHome('heroBadge')}`.
    2. *Tiêu đề H1:* `text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl lg:text-5xl lg:leading-tight`. Không dùng gradient text (tuân thủ CAM-10).
    3. *Mô tả Subtitle:* `mt-4 max-w-xl text-base text-neutral-600 sm:text-lg leading-relaxed text-left`.
    4. *Form tìm kiếm nhanh:* Form chiều ngang đầy đủ trong phạm vi cột trái (`w-full max-w-xl`), gồm input placeholder `{tHome('searchPlaceholder')}` và nút submit `{tHome('searchButton')}` variant primary.
    5. *Danh sách chip môn thể thao:* Hiển thị ngay dưới form tìm kiếm, căn trái, có nhãn `{tHome('popularSports')}:`.
  - **Cột phải (`lg:col-span-5 hidden lg:block`):**
    - Khối Live Visual Preview Card (`rounded-card border border-neutral-200 bg-white p-6 shadow-sm`):
      - Header card: badge trạng thái thời gian thực với điểm đến xanh lá (`size-2 rounded-full bg-emerald-500` + lớp `animate-ping` opacity 75%) và tiêu đề `{tHome('heroPreviewTitle')}`.
      - Nội dung card: Danh sách 2–3 slot mẫu mô phỏng đặt sân thực tế (tên sân, sân số, khung giờ, giá /slot), kèm badge `{tHome('heroPreviewHold')}` để truyền tải giá trị cốt lõi "giữ chỗ 10 phút".
      - 100% dùng token sẵn có: `bg-neutral-50`, `border-neutral-200`, `text-neutral-900`, `text-primary-700`; không dùng màu ngoài hệ thống.

### REQ-HOME-03: Tái cấu trúc Section "Lý do chọn nền tảng" căn trái toàn diện
- **Mô tả:** Xóa bỏ toàn bộ style `text-center` của section Lý do, đưa về bố cục căn trái rõ ràng và dễ đọc quét.
- **Quy cách:**
  - Header section: `<div className="mb-10 max-w-2xl text-left">` gồm `h2` (`text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl`) và `p` mô tả lấy từ `{tHome('whySubtitle')}` (`mt-2 text-sm text-neutral-600 leading-relaxed`).
  - Grid 3 card: `grid grid-cols-1 gap-6 md:grid-cols-3`.
  - Mỗi Card:
    - Container: `Card` với `border border-neutral-200 bg-white transition-all duration-150 hover:border-primary-200 hover:shadow-card`.
    - CardContent: `flex flex-col items-start p-6 text-left`.
    - Icon box: `mb-4 flex size-11 items-center justify-center rounded-lg border border-primary-100/60 bg-primary-50 text-primary-700`.
    - Title: `text-lg font-semibold tracking-tight text-neutral-900`.
    - Description: `mt-2 text-sm text-neutral-600 leading-relaxed text-left`.

### REQ-HOME-04: Tái cấu trúc Section "Số liệu thống kê" với `tabular-nums`
- **Mô tả:** Thiết kế lại section số liệu trên nền `bg-neutral-50` với bố cục căn trái và ngăn cách cột sạch sẽ.
- **Quy cách:**
  - Container: `grid grid-cols-1 gap-8 sm:grid-cols-3`.
  - Mỗi cột chỉ số: `flex flex-col items-start text-left` + `sm:border-l sm:border-neutral-200 sm:pl-8` cho cột thứ 2 và thứ 3.
  - Chỉ số chính: `text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl tabular-nums`.
  - Nhãn mô tả dưới chỉ số: `mt-1 text-sm font-medium text-neutral-600`.
  - Các con số:
    - `500+` kèm `{tHome('statsVenues')}`.
    - `25.000+` kèm `{tHome('statsBookings')}`.
    - `15.000+` kèm `{tHome('statsCustomers')}`.

### REQ-HOME-05: Tái cấu trúc CTA Chủ sân sang Banner 2 cột
- **Mô tả:** Chuyển section kêu gọi chủ sân trên nền `bg-primary-800` từ căn giữa thành layout 2 cột đối xứng ngang trên `md:`.
- **Quy cách:**
  - Container: `flex flex-col gap-8 md:flex-row md:items-center md:justify-between text-left`.
  - Khối nội dung trái:
    - Tiêu đề H2: `text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl` sử dụng `{tHome('ctaTitle')}`.
    - Mô tả: `mt-3 max-w-2xl text-base text-primary-100 leading-relaxed` sử dụng `{tHome('ctaDesc')}`.
  - Khối nút bấm phải:
    - Container: `flex flex-col sm:flex-row gap-3 shrink-0`.
    - Nút chính: `<Button variant="secondary" size="lg" asChild className="font-semibold shadow-sm">` trỏ tới `/owner/apply` kèm nhãn `{tHome('ctaRegisterOwner')}`.
    - Nút phụ: `<Button variant="outline" size="lg" asChild className="border-white/30 text-white hover:bg-white/10">` trỏ tới `/owner/timeline` kèm nhãn `{tHome('ctaExploreOwner')}`.

---

## 4. Hợp đồng i18n mới (`apps/web/messages/vi.json`)

Toàn bộ các chuỗi hiển thị phải được bổ sung vào namespace `home` của `apps/web/messages/vi.json`. Không được phép để sót bất kỳ chuỗi hard-code nào.

### 4.1. Bảng ánh xạ chuỗi cũ và key mới

| Chuỗi tiếng Việt hiện tại | Vị trí dòng cũ | Khóa i18n mới trong `home` | Giá trị đầy đủ |
|---|---|---|---|
| "Nền tảng đặt sân thể thao hàng đầu Việt Nam" | Dòng 56 | `home.heroBadge` | "Nền tảng đặt sân thể thao hàng đầu Việt Nam" |
| "Công nghệ tiên tiến giúp quy trình đặt sân mượt mà, minh bạch và chính xác tuyệt đối." | Dòng 114 | `home.whySubtitle` | "Công nghệ tiên tiến giúp quy trình đặt sân mượt mà, minh bạch và chính xác tuyệt đối." |
| "Bạn là chủ sân thể thao?" | Dòng 176 | `home.ctaTitle` | "Bạn là chủ sân thể thao?" |
| "Gia nhập mạng lưới BookSportsCourt để tiếp cận hàng ngàn người chơi, tối ưu công suất lấp đầy và quản lý lịch đặt sân dễ dàng với chi phí 0đ." | Dòng 178–181 | `home.ctaDesc` | "Gia nhập mạng lưới BookSportsCourt để tiếp cận hàng ngàn người chơi, tối ưu công suất lấp đầy và quản lý lịch đặt sân dễ dàng với chi phí 0đ." |
| "Đăng ký mở cơ sở ngay" | Dòng 184 | `home.ctaRegisterOwner` | "Đăng ký mở cơ sở ngay" |
| "Xem thử kênh quản lý" | Dòng 187 | `home.ctaExploreOwner` | "Xem thử kênh quản lý" |
| (Bổ sung cho Live Preview Card) | Không có | `home.heroPreviewTitle` | "Lịch sân thời gian thực" |
| (Bổ sung cho Live Preview Card) | Không có | `home.heroPreviewStatus` | "Cập nhật liên tục qua WebSocket" |
| (Bổ sung cho Live Preview Card) | Không có | `home.heroPreviewHold` | "Giữ chỗ 10 phút" |

### 4.2. JSON namespace `home` đầy đủ sau khi cập nhật

```json
{
  "home": {
    "heroBadge": "Nền tảng đặt sân thể thao hàng đầu Việt Nam",
    "heroTitle": "Đặt sân thể thao trong 30 giây",
    "heroSubtitle": "Hơn 500 sân cầu lông, bóng đá, pickleball trên toàn quốc. Xem lịch trống theo thời gian thực, giữ chỗ ngay, không cần gọi điện.",
    "searchPlaceholder": "Tìm sân theo tên, địa chỉ hoặc môn thể thao…",
    "searchButton": "Tìm sân ngay",
    "popularSports": "Môn thể thao phổ biến",
    "featuredVenues": "Sân nổi bật",
    "whyTitle": "Vì sao chọn BookSportsCourt",
    "whySubtitle": "Công nghệ tiên tiến giúp quy trình đặt sân mượt mà, minh bạch và chính xác tuyệt đối.",
    "whyRealtimeTitle": "Lịch trống thời gian thực",
    "whyRealtimeDesc": "Slot cập nhật tức thì qua WebSocket — không còn cảnh đến sân mới biết đã có người đặt.",
    "whyHoldTitle": "Giữ chỗ 10 phút",
    "whyHoldDesc": "Chọn giờ xong được giữ chỗ trong 10 phút để kịp chuyển khoản, không sợ mất sân.",
    "whyVerifiedTitle": "Cơ sở được kiểm duyệt",
    "whyVerifiedDesc": "Mọi cơ sở đều qua xét duyệt của ban quản trị trước khi hiển thị.",
    "statsVenues": "Cơ sở",
    "statsBookings": "Lượt đặt",
    "statsCustomers": "Khách hàng",
    "ctaTitle": "Bạn là chủ sân thể thao?",
    "ctaDesc": "Gia nhập mạng lưới BookSportsCourt để tiếp cận hàng ngàn người chơi, tối ưu công suất lấp đầy và quản lý lịch đặt sân dễ dàng với chi phí 0đ.",
    "ctaRegisterOwner": "Đăng ký mở cơ sở ngay",
    "ctaExploreOwner": "Xem thử kênh quản lý",
    "heroPreviewTitle": "Lịch sân thời gian thực",
    "heroPreviewStatus": "Cập nhật liên tục qua WebSocket",
    "heroPreviewHold": "Giữ chỗ 10 phút"
  }
}
```

> **Lưu ý:** Giữ nguyên các khóa `heroTitle`, `heroSubtitle`, `searchPlaceholder`, `searchButton`, `popularSports`, `featuredVenues`, `whyTitle`, `whyRealtimeTitle/Desc`, `whyHoldTitle/Desc`, `whyVerifiedTitle/Desc`, `statsVenues`, `statsBookings`, `statsCustomers` đã có — chỉ bổ sung 9 khóa mới liệt kê ở mục 4.1.

---

## 5. Layout & Responsive Breakpoint Specifications

### 5.1. Bảng quy định Breakpoints

| Breakpoint | Chiều rộng viewport | Bố cục Hero | Bố cục Lý do | Bố cục Thống kê | Bố cục CTA |
|---|---|---|---|---|---|
| **Mobile (`< 640px`)** | 375px – 639px | 1 cột căn trái, preview card ẩn, chips wrap tự nhiên | 1 cột căn trái, 3 card xếp dọc | 1 cột căn trái, 3 metric xếp dọc | Flex column, text căn trái, 2 nút full width |
| **Tablet (`md: 768px`)** | 768px – 1023px | 1 cột căn trái, preview card ẩn, form inline | 3 cột căn trái (`grid-cols-3`) | 3 cột căn trái kèm divider mỏng | Flex row ngang (`items-center justify-between`) |
| **Desktop (`lg: 1024px`)** | 1024px – 1279px | 2 cột bất đối xứng (7/5), preview card hiển thị | 3 cột căn trái | 3 cột căn trái kèm divider mỏng | Flex row ngang |
| **Large Desktop (`xl: 1280px+`)** | 1280px+ | 2 cột bất đối xứng (7/5), giới hạn bởi container | 3 cột căn trái | 3 cột căn trái kèm divider mỏng | Flex row ngang |

### 5.2. Cấu trúc JSX dự kiến của `apps/web/app/(public)/page.tsx`

```tsx
<main className="flex flex-col">
  {/* 1. Hero Section: 2 cột trên lg: */}
  <section className="relative overflow-hidden border-b border-neutral-200 bg-gradient-to-b from-primary-50/50 via-white to-white py-14 sm:py-16 lg:py-20">
    <div className="container">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
        {/* Cột trái: 7 phần */}
        <div className="flex flex-col items-start text-left lg:col-span-7">
          {/* Badge */}
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-100/60 px-3.5 py-1 text-xs font-semibold text-primary-800">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            <span>{tHome('heroBadge')}</span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl lg:text-5xl lg:leading-tight">
            {tHome('heroTitle')}
          </h1>

          <p className="mt-4 max-w-xl text-base leading-relaxed text-neutral-600 sm:text-lg">
            {tHome('heroSubtitle')}
          </p>

          {/* Form tìm kiếm */}
          <form
            onSubmit={handleSearch}
            className="mt-8 flex w-full max-w-xl flex-col gap-2 rounded-card border border-neutral-300 bg-white p-2 shadow-sm sm:flex-row sm:items-center"
          >
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
                aria-hidden="true"
              />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tHome('searchPlaceholder')}
                className="border-0 pl-9 pr-3 shadow-none focus-visible:ring-0"
              />
            </div>
            <Button type="submit" variant="primary" size="md" className="shrink-0">
              <Search className="size-4" aria-hidden="true" />
              <span>{tHome('searchButton')}</span>
            </Button>
          </form>

          {/* Chips thể thao: Lucide icons, căn trái */}
          <div className="mt-6 flex flex-wrap items-center justify-start gap-2">
            <span className="text-xs font-medium text-neutral-500">{tHome('popularSports')}:</span>
            {POPULAR_SPORTS.map((sport) => {
              const Icon = sport.icon;
              return (
                <Link
                  key={sport.slug}
                  href={`/venues?sport=${sport.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-700 transition-colors duration-150 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-800"
                >
                  <Icon className="size-3.5 text-neutral-500" aria-hidden="true" />
                  <span>{sport.name}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Cột phải: 5 phần - Live Visual Preview */}
        <div className="hidden lg:col-span-5 lg:block">
          <div className="rounded-card border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <div className="flex items-center gap-2">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                <span className="text-xs font-semibold text-neutral-900">
                  {tHome('heroPreviewTitle')}
                </span>
              </div>
              <span className="rounded bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-700">
                {tHome('heroPreviewHold')}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {/* 3 dòng slot mẫu (dữ liệu tĩnh minh hoạ, KHÔNG gọi API) */}
              <div className="flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50/60 p-3">
                <div className="flex flex-col text-left">
                  <span className="text-xs font-semibold text-neutral-900">Sân Cầu Lông Thăng Long</span>
                  <span className="text-[11px] text-neutral-500">Sân 01 · 18:00 - 18:30</span>
                </div>
                <span className="tabular-nums text-xs font-bold text-primary-700">120.000 ₫</span>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-1 pt-2 text-[11px] text-neutral-500">
              <Clock className="size-3 text-neutral-400" aria-hidden="true" />
              <span>{tHome('heroPreviewStatus')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  {/* 2. Lý do chọn nền tảng: Header căn trái, 3 Card căn trái */}
  <section className="border-b border-neutral-200 bg-white py-14 md:py-20">
    <div className="container">
      <div className="mb-10 max-w-2xl text-left">
        <h2 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
          {tHome('whyTitle')}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">{tHome('whySubtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card className="border border-neutral-200 bg-white transition-all duration-150 hover:border-primary-200 hover:shadow-card">
          <CardContent className="flex flex-col items-start p-6 text-left">
            <div className="mb-4 flex size-11 items-center justify-center rounded-lg border border-primary-100/60 bg-primary-50 text-primary-700">
              <Zap className="size-5" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-semibold tracking-tight text-neutral-900">
              {tHome('whyRealtimeTitle')}
            </h3>
            <p className="mt-2 text-left text-sm leading-relaxed text-neutral-600">
              {tHome('whyRealtimeDesc')}
            </p>
          </CardContent>
        </Card>
        {/* Card 2 (Clock – whyHoldTitle) và Card 3 (ShieldCheck – whyVerifiedTitle) cùng khuôn mẫu */}
      </div>
    </div>
  </section>

  {/* 3. Số liệu thống kê: căn trái + tabular-nums + divider */}
  <section className="border-b border-neutral-200 bg-neutral-50 py-12 md:py-16">
    <div className="container">
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
        <div className="flex flex-col items-start text-left">
          <div className="tabular-nums text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">500+</div>
          <span className="mt-1 text-sm font-medium text-neutral-600">{tHome('statsVenues')}</span>
        </div>
        <div className="flex flex-col items-start border-t border-neutral-200 pt-6 text-left sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0">
          <div className="tabular-nums text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">25.000+</div>
          <span className="mt-1 text-sm font-medium text-neutral-600">{tHome('statsBookings')}</span>
        </div>
        <div className="flex flex-col items-start border-t border-neutral-200 pt-6 text-left sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0">
          <div className="tabular-nums text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">15.000+</div>
          <span className="mt-1 text-sm font-medium text-neutral-600">{tHome('statsCustomers')}</span>
        </div>
      </div>
    </div>
  </section>

  {/* 4. Kêu gọi hợp tác chủ sân: Banner 2 cột ngang */}
  <section className="bg-primary-800 py-14 text-white md:py-16">
    <div className="container">
      <div className="flex flex-col gap-8 text-left md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
            {tHome('ctaTitle')}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-primary-100">{tHome('ctaDesc')}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
          <Button variant="secondary" size="lg" asChild className="font-semibold shadow-sm">
            <Link href="/owner/apply">{tHome('ctaRegisterOwner')}</Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            asChild
            className="border-white/30 text-white hover:bg-white/10"
          >
            <Link href="/owner/timeline">{tHome('ctaExploreOwner')}</Link>
          </Button>
        </div>
      </div>
    </div>
  </section>
</main>
```

> **Ghi chú kỹ thuật cho `senior-dev`:**
> - Giữ nguyên `'use client'`, `useAppRouter`, `handleSearch` hiện có (`encodeURIComponent(searchQuery.trim())`, fallback `/venues`) — chỉ đổi layout và chuỗi.
> - `POPULAR_SPORTS` phải đổi kiểu sang `{ name: string; slug: string; icon: LucideIcon }` và bỏ prop `icon` dạng chuỗi emoji. Nếu `Button` chưa hỗ trợ `asChild`, dùng pattern `Link` bọc `Button` (kiểm tra `apps/web/components/ui/button.tsx` trước khi code) — KHÔNG tự thêm API `asChild` ngoài phạm vi spec này.
> - Dữ liệu trong Live Preview là tĩnh (hard-code trong component, không gọi API, không dùng `useQuery`) để tránh phát sinh request thừa ở trang chủ và tránh trạng thái loading/error trên hero.

---

## 6. Tiêu chuẩn Anti-AI Design (Chuẩn Linear / Stripe)

### 6.1. Danh sách cấm tuyệt đối (CAM)
1. **CAM gradient tím/hồng/neon (CAM-01):** Không sử dụng `from-purple-500 to-indigo-500` hoặc bất kỳ gradient đa sắc nào. Chỉ dùng nền trung tính trắng (`bg-white`), nền xám nhẹ (`bg-neutral-50`) và gradient đơn sắc rất nhẹ `from-primary-50/50 via-white to-white` cho hero.
2. **CAM emoji làm icon UI (CAM-04):** Cấm tuyệt đối đặt ký tự emoji (`🏸`, `⚽`, `✨`, `🚀`...) trong button, chip, tiêu đề hay thẻ nội dung. Chỉ dùng Lucide icon, `strokeWidth` mặc định 1.5 (không truyền `strokeWidth` thấp hơn 1.5 để tránh nét quá mảnh).
3. **CAM bo góc quá đà (CAM-03):** Cấm `rounded-2xl`, `rounded-3xl` cho card thường. Card dùng `rounded-card`, button dùng `rounded-btn`, chip dùng `rounded-full`. Không hard-code `style={{ borderRadius: ... }}`.
4. **CAM căn giữa mọi thứ (CAM-09):** Không áp `text-center` + `items-center` cho toàn bộ section. Tuân thủ căn trái tự nhiên (`text-left`, `items-start`) để mắt người đọc tiếp nhận nội dung theo đường quét F/Z.
5. **CAM bóng đổ loá (Shadow):** Card ở trạng thái mặc định chỉ dùng viền `border border-neutral-200`; chỉ dùng `shadow-card` khi hover, `shadow-sm` cho preview box và form tìm kiếm.
6. **CAM popup alert cổ điển:** Mọi thông báo phải là inline message hoặc toast của hệ thống; cấm `window.alert`, `window.confirm`.
7. **CAM gradient text:** Cấm `bg-clip-text text-transparent` cho tiêu đề H1/H2.

### 6.2. Bảng 6 trạng thái bắt buộc (Component States)

| Trạng thái | Chip thể thao (`Link`) | Nút tìm kiếm (`Button`) | Thẻ lý do (`Card`) |
|---|---|---|---|
| **Default** | `border-neutral-200 bg-white text-neutral-700` | `bg-primary-700 text-white font-medium` | `border-neutral-200 bg-white` |
| **Hover** | `border-primary-300 bg-primary-50 text-primary-800` | `bg-primary-600 text-white` | `border-primary-200 shadow-card` |
| **Focus** | `focus-visible:ring-2 ring-primary-600 ring-offset-1` | `focus-visible:ring-2 ring-primary-600 ring-offset-2` | Không áp dụng (không interactive) |
| **Loading** | Không áp dụng | Icon `Spinner` cỡ `xs`, `disabled` | Không áp dụng |
| **Validation Error** | Không áp dụng (chip điều hướng) | Không áp dụng — input rỗng vẫn hợp lệ và điều hướng `/venues` | Không áp dụng |
| **Success** | Trạng thái sau điều hướng do trang `/venues` đảm nhiệm | Nút trả về trạng thái Default ngay sau khi `router.push` | Không áp dụng |

> Đối với `Input` trong hero: trạng thái `focus` dùng `focus-visible:ring-0` trên input và viền focus do wrapper form đảm nhiệm (`focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100`) để tránh viền kép.

---

## 7. Kiến trúc File & Component chỉ định

### 7.1. Danh sách file cần sửa

| Đường dẫn file | Mục tiêu cần thực hiện |
|---|---|
| `apps/web/messages/vi.json` | Thêm 9 khóa i18n mới vào namespace `home`: `heroBadge`, `whySubtitle`, `ctaTitle`, `ctaDesc`, `ctaRegisterOwner`, `ctaExploreOwner`, `heroPreviewTitle`, `heroPreviewStatus`, `heroPreviewHold`. |
| `apps/web/app/(public)/page.tsx` | 1. Import Lucide icons thay emoji: `Activity`, `CircleDot`, `Table2`, `Circle`, `CircleDashed`, `ShieldCheck`; bỏ `Sparkles`.<br>2. Xóa emoji khỏi `POPULAR_SPORTS`.<br>3. Thay `Sparkles` bằng `ShieldCheck` ở Hero Badge.<br>4. Tái cấu trúc Hero thành 2 cột (`lg:grid-cols-12`) gồm cột trái căn trái và cột phải Live Preview Card (ẩn `< lg`).<br>5. Section Lý do căn trái toàn bộ.<br>6. Section Thống kê căn trái, `tabular-nums`, divider dọc.<br>7. Section CTA thành banner 2 cột ngang trên `md:`.<br>8. Chuyển toàn bộ chuỗi sang `tHome(...)`. |

### 7.2. File test cần tạo mới

| Đường dẫn file | Mục tiêu |
|---|---|
| `apps/web/app/(public)/page.test.tsx` | Bộ test toàn diện cho HomePage: không còn emoji, render đủ 5 chip với Lucide icon, form search điều hướng đúng, các link CTA đúng route, các section căn trái, `tabular-nums` trên số liệu, Live Preview hiển thị ở desktop. |

### 7.3. Ràng buộc kiến trúc (không được vi phạm)
- Không tạo mới component dùng chung trong `apps/web/components/common/` cho trang chủ — Live Preview Card nằm nội bộ file `page.tsx` (chỉ dùng 1 lần, tránh over-engineering).
- Không sửa `apps/web/components/ui/{button,card,input}.tsx` nếu không thực sự cần; nếu cần `asChild` phải ghi chú rõ trong PR và không làm vỡ API hiện có.
- Không thêm dependency mới (`lucide-react@^0.468.0` đã có sẵn trong `apps/web/package.json`).
- Mọi icon phải có `aria-hidden="true"` vì kèm text nhãn; Live Preview Card dùng `aria-hidden` trên cụm trang trí hoặc bọc trong `<aside aria-label>` để screen reader không đọc dữ liệu giả như dữ liệu thật.

---

## 8. Test Matrix (bắt buộc cho `auto-tester`)

### 8.1. Unit test — Kiểm tra i18n schema (`apps/web/messages/vi.json`)

| Mã | Tên test case | Điều kiện | Kết quả mong đợi |
|---|---|---|---|
| `UT-HOME-I18N-01` | Tồn tại đủ khóa trong namespace `home` | Import `apps/web/messages/vi.json` | Các khóa `heroBadge`, `whySubtitle`, `ctaTitle`, `ctaDesc`, `ctaRegisterOwner`, `ctaExploreOwner`, `heroPreviewTitle`, `heroPreviewStatus`, `heroPreviewHold` tồn tại và là chuỗi không rỗng (`length > 0`). |
| `UT-HOME-I18N-02` | Không có placeholder rác | Duyệt toàn bộ giá trị của namespace `home` | Không chứa `TODO`, `Lorem ipsum`, `{...}` chưa nội suy, không chứa emoji. |

### 8.2. Widget test — `apps/web/app/(public)/page.test.tsx`

| Mã | Tên test case | Hành vi kiểm tra | Kết quả mong đợi |
|---|---|---|---|
| `WT-HOME-01` | Không còn emoji trong DOM | Render `<HomePage />` | `container.textContent` không khớp regex emoji (`/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u`). |
| `WT-HOME-02` | Render đủ 5 chip với Lucide icon | Render `<HomePage />` | Có 5 link chứa text `Cầu lông`, `Pickleball`, `Bóng đá mini`, `Tennis`, `Bóng rổ`; mỗi link chứa phần tử `svg`. |
| `WT-HOME-03` | Chip điều hướng đúng query | Render `<HomePage />` | `href` lần lượt là `/venues?sport=cau-long`, `/venues?sport=pickleball`, `/venues?sport=bong-da`, `/venues?sport=tennis`, `/venues?sport=bong-ro`. |
| `WT-HOME-04` | Submit có từ khóa | Nhập `"sân quận 1"`, click `Tìm sân ngay` | `router.push` được gọi với `/venues?q=s%C3%A2n%20qu%E1%BA%ADn%201` (đúng `encodeURIComponent`). |
| `WT-HOME-05` | Submit chuỗi rỗng | Để trống input, submit form | `router.push` được gọi với `/venues`. |
| `WT-HOME-06` | Submit chỉ có khoảng trắng | Nhập `"   "`, submit | `router.push` được gọi với `/venues` (đã `.trim()`). |
| `WT-HOME-07` | CTA chủ sân đúng route | Render `<HomePage />` | Link `Đăng ký mở cơ sở ngay` → `/owner/apply`; link `Xem thử kênh quản lý` → `/owner/timeline`. |
| `WT-HOME-08` | Bố cục căn trái (Anti-AI) | Render `<HomePage />` | Khối header hero, header section Lý do, 3 CardContent, 3 cột Thống kê chứa class `text-left`; không tồn tại `text-center` trên các container cấp section. |
| `WT-HOME-09` | `tabular-nums` trên số liệu | Render `<HomePage />` | Ba phần tử chứa `500+`, `25.000+`, `15.000+` đều có class `tabular-nums`. |
| `WT-HOME-10` | Live Preview chỉ hiển thị desktop | Render `<HomePage />` | Wrapper preview có `hidden` và `lg:block`; nội dung `Lịch sân thời gian thực` tồn tại trong DOM. |
| `WT-HOME-11` | Không có gradient cấm | Render `<HomePage />` | Không class nào chứa `from-purple`, `to-pink`, `bg-clip-text`, `rounded-3xl`. |
| `WT-HOME-12` | i18n được gọi thay vì hard-code | Render `<HomePage />` với messages vi | Text hiển thị khớp giá trị trong `vi.json`; khi mock `useTranslations` trả về chuỗi khác, DOM phản ánh chuỗi mock (chứng minh không hard-code). |

### 8.3. Kiểm thử thủ công / E2E (khuyến nghị `qa-inspector`)
- Mở `/` ở 375px, 768px, 1024px, 1440px: không có scroll ngang (`document.documentElement.scrollWidth <= clientWidth`).
- Tab qua toàn bộ phần tử tương tác: chip và nút đều có focus ring rõ ràng.
- Kiểm tra tương phản text theo `docs/07-design-system.md` (WCAG AA 4.5:1), đặc biệt text `text-primary-100` trên `bg-primary-800`.

---

## 9. Tiêu chí nghiệm thu (Acceptance Criteria)

- [ ] **AC-01 (No Emoji):** Không còn bất kỳ emoji nào trong `page.tsx` và trong `vi.json`; toàn bộ chip thể thao dùng Lucide icon.
- [ ] **AC-02 (Anti-AI Layout):** Hero là layout 2 cột trên `lg:` (cột trái text/form/chips căn trái; cột phải Live Preview). Section Lý do, Thống kê, CTA căn trái tự nhiên; không còn `text-center` cấp section.
- [ ] **AC-03 (100% i18n):** Không còn chuỗi tiếng Việt hard-code trong `page.tsx`; mọi text đi qua `tHome(...)`.
- [ ] **AC-04 (Design Tokens):** Màu sắc, bo góc, spacing dùng đúng token trong `tailwind.config.ts` / `globals.css`; không hex lạ, không `rounded-3xl`.
- [ ] **AC-05 (Test Coverage):** `page.test.tsx` phủ đủ 12 widget test + 2 unit test ở mục 8 và pass 100% khi chạy `pnpm --filter @bsc/web test`.
- [ ] **AC-06 (Zero Type/Lint Errors):** `pnpm typecheck` và `pnpm lint`(hoặc `pnpm --filter @bsc/web lint`) chạy sạch, không warning mới.

---

## 10. Thứ tự triển khai bàn giao

1. **Bước 1:** Cập nhật `apps/web/messages/vi.json` — bổ sung 9 khóa i18n mới vào namespace `home` theo mục 4.2.
2. **Bước 2:** Sửa `apps/web/app/(public)/page.tsx` theo cấu trúc JSX mục 5.2: thay emoji bằng Lucide icon, dựng Hero 2 cột, căn trái các section, nối i18n.
3. **Bước 3:** Bàn giao `auto-tester` viết `apps/web/app/(public)/page.test.tsx` theo Test Matrix mục 8.
4. **Bước 4:** Bàn giao `qa-inspector` chạy typecheck, lint, kiểm tra checklist Anti-AI (mục 6) và responsive (mục 8.3) trước khi nghiệm thu.
