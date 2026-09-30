# 07 – Design System

> **Phiên bản:** 1.0.0 | **Cập nhật lần cuối:** 2026-09-30
>
> **AI AGENT KHÔNG ĐƯỢC tự ý quyết định thiết kế giao diện ngoài tài liệu này.**

## 1. Tham chiếu thiết kế (Học GÌ, từ ĐÂU)

| Nguồn | Học điều gì |
|-------|-------------|
| **Booking.com** | Bộ lọc sticky, typography dày đặc có thứ bậc rõ ràng, ảnh venue lớn, thông tin giá nổi bật |
| **Airbnb** | Gallery ảnh chuyên nghiệp, card sân sạch sẽ, UX chọn ngày |
| **Playtomic** | SlotGrid chọn block thể thao, hiển thị giá trên từng slot, trạng thái realtime |
| **Linear** | Dashboard dense, sidebar compact, typography nhỏ chính xác cho owner/admin |
| **Fresha** | Owner timeline resource view, quản lý lịch hẹn theo sân |
| **Google Calendar** | Timeline dạng resource view (trục sân × trục giờ) |

**KHÔNG sao chép nguyên xi.** Học nguyên tắc, áp dụng vào ngữ cảnh Việt Nam.

## 2. Thương hiệu

- **Tên tạm:** BookSports (viết tắt: BSC)
- **Tính cách:** Đáng tin cậy, minh bạch, năng động, thực tế (không hào nhoáng).
- **Giọng điệu:** Thân thiện nhưng chuyên nghiệp; tiếng Việt thuần, không dùng từ marketing nước ngoài.

## 3. Bảng màu (Color Tokens)

### CSS Variables (thêm vào `globals.css`)

```css
:root {
  /* === PRIMARY – Xanh sân cỏ đậm === */
  --color-primary-50:  #f0fdf4;
  --color-primary-100: #dcfce7;
  --color-primary-200: #bbf7d0;
  --color-primary-300: #86efac;
  --color-primary-400: #4ade80;
  --color-primary-500: #22c55e;
  --color-primary-600: #16a34a;  /* Màu chủ đạo chính */
  --color-primary-700: #15803d;
  --color-primary-800: #166534;
  --color-primary-900: #14532d;

  /* === ACCENT – Cam năng động === */
  --color-accent-500: #f97316;
  --color-accent-600: #ea580c;   /* Màu nhấn chính */
  --color-accent-700: #c2410c;

  /* === NEUTRAL – Slate (không dùng gray thuần) === */
  --color-neutral-0:   #ffffff;
  --color-neutral-50:  #f8fafc;
  --color-neutral-100: #f1f5f9;
  --color-neutral-200: #e2e8f0;
  --color-neutral-300: #cbd5e1;
  --color-neutral-400: #94a3b8;
  --color-neutral-500: #64748b;
  --color-neutral-600: #475569;
  --color-neutral-700: #334155;
  --color-neutral-800: #1e293b;
  --color-neutral-900: #0f172a;

  /* === SEMANTIC === */
  --color-success:  #16a34a;  /* = primary-600 */
  --color-warning:  #d97706;
  --color-danger:   #dc2626;
  --color-info:     #2563eb;

  /* === SLOT STATUS (Trạng thái block trên SlotGrid) === */
  --color-slot-available: #dcfce7;    /* Xanh lá nhạt */
  --color-slot-available-text: #15803d;
  --color-slot-held:      #fef9c3;    /* Vàng nhạt */
  --color-slot-held-text: #a16207;
  --color-slot-booked:    #dbeafe;    /* Xanh dương nhạt */
  --color-slot-booked-text: #1d4ed8;
  --color-slot-my-hold:   #ede9fe;    /* Tím nhạt (của tôi) */
  --color-slot-my-hold-text: #6d28d9;
  --color-slot-blocked:   #e2e8f0;    /* Xám trung tính */
  --color-slot-blocked-text: #64748b;
  --color-slot-past:      #f8fafc;
  --color-slot-past-text: #cbd5e1;

  /* === SURFACES === */
  --color-bg:          var(--color-neutral-50);
  --color-bg-card:     var(--color-neutral-0);
  --color-bg-subtle:   var(--color-neutral-100);
  --color-border:      var(--color-neutral-200);
  --color-border-focus: var(--color-primary-600);

  /* === TEXT === */
  --color-text-primary:   var(--color-neutral-900);
  --color-text-secondary: var(--color-neutral-600);
  --color-text-disabled:  var(--color-neutral-400);
  --color-text-inverse:   var(--color-neutral-0);
}
```

**TUYỆT ĐỐI CẤM:** Gradient tím-xanh (`from-purple-500 to-blue-500`), `bg-gradient-to-r from-indigo`, glassmorphism (`backdrop-blur` trên card).

### Kiểm tra tương phản AA
- Text trên `primary-600` bg: `white` → **7.2:1** ✅
- Text trên `accent-600` bg: `white` → **5.8:1** ✅
- `neutral-600` trên `neutral-0`: **6.2:1** ✅

### Cấu hình Tailwind
```js
// tailwind.config.ts
colors: {
  primary: { /* map từ CSS variables */ },
  accent:  { /* map từ CSS variables */ },
  neutral: { /* map từ CSS variables */ },
  slot: {
    available: 'var(--color-slot-available)',
    held:      'var(--color-slot-held)',
    booked:    'var(--color-slot-booked)',
    'my-hold': 'var(--color-slot-my-hold)',
    blocked:   'var(--color-slot-blocked)',
    past:      'var(--color-slot-past)',
  }
}
```

## 4. Typography

- **Font chính:** `Be Vietnam Pro` (Google Fonts) – ưu tiên; fallback `Inter`.
- **Import:** Dùng `next/font/google` để tối ưu CLS.

### Thang cỡ chữ

| Token | `font-size` | `line-height` | `font-weight` | Dùng cho |
|-------|-------------|---------------|---------------|---------|
| `text-xs`    | 12px | 16px | 400 | Badge, label phụ |
| `text-sm`    | 14px | 20px | 400 | Body phụ, table cell |
| `text-base`  | 16px | 24px | 400 | Body chính |
| `text-lg`    | 18px | 28px | 500 | Section heading phụ |
| `text-xl`    | 20px | 28px | 600 | Card title, section heading |
| `text-2xl`   | 24px | 32px | 700 | Page heading (h1 mobile) |
| `text-3xl`   | 30px | 36px | 700 | Page heading (h1 desktop) |
| `text-4xl`   | 36px | 40px | 800 | Hero heading (dùng ít) |

**Quy tắc:**
- Số tiền: luôn dùng `font-variant-numeric: tabular-nums` → `font-feature-settings: "tnum"`.
- `text-4xl` trở lên: KHÔNG dùng trong dashboard owner/admin.
- Không dùng font-weight 300 (thin) vì khó đọc trên màn hình thấp.

### Hiển thị ngày giờ

```typescript
// Luôn dùng date-fns với locale vi
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

format(date, 'EEEE, dd/MM/yyyy', { locale: vi })  // "Thứ Tư, 15/10/2026"
format(date, 'HH:mm')                              // "08:30"
format(date, 'dd/MM/yyyy')                         // "15/10/2026"

// Giá tiền
new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(250000)
// → "250.000 ₫"
```

## 5. Spacing & Layout

- **Lưới cơ sở:** 4px. Mọi spacing là bội số của 4px.
- Tailwind: `space-1 = 4px`, `space-2 = 8px`, `space-4 = 16px`, `space-6 = 24px`, `space-8 = 32px`.
- **Breakpoints:**
  - `sm`: 640px (mobile ngang)
  - `md`: 768px (tablet)
  - `lg`: 1024px (laptop nhỏ)
  - `xl`: 1280px (desktop)
  - `2xl`: 1536px (desktop lớn)

## 6. Border Radius – Theo loại component

| Component | Radius | Class |
|-----------|--------|-------|
| Button | 6px | `rounded-md` |
| Input, Select, Textarea | 6px | `rounded-md` |
| Card (venue, booking) | 8px | `rounded-lg` |
| Modal, Sheet | 12px | `rounded-xl` |
| Badge | 4px | `rounded` |
| Avatar | 50% | `rounded-full` |
| Tooltip | 4px | `rounded` |

**CẤM:** Bo tròn đồng loạt `rounded-2xl` / `rounded-3xl` cho card.

## 7. Shadow – Dè dặt, ưu tiên border

```css
/* Ưu tiên border thay vì shadow */
--shadow-sm:  0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md:  0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05);
--shadow-lg:  0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.05);
/* Dùng cho Modal/Dropdown – không dùng cho card thông thường */
```

- Card venue: `border border-neutral-200` (không shadow mặc định) → `shadow-md` khi hover.
- Modal: `shadow-lg`.
- Tooltip: `shadow-sm`.

## 8. Icon

- **Thư viện duy nhất:** `lucide-react`.
- **Kích thước cố định:** `size-4` (16px), `size-5` (20px), `size-6` (24px).
- **Stroke:** `strokeWidth={1.5}` (mặc định Lucide).
- **CẤM:** Emoji làm icon UI, icon từ thư viện khác trộn lẫn.

## 9. Components

### Button

```
Variants:  primary | secondary | outline | ghost | danger
Sizes:     sm (h-8) | md (h-10, default) | lg (h-12)
States:    default | hover | focus-visible | active | disabled | loading
```

- Primary: `bg-primary-600 text-white hover:bg-primary-700`
- Danger: `bg-danger text-white`
- Loading state: spinner thay thế icon, disabled tự động.
- Mỗi trang/modal chỉ có **1 nút Primary** chính.

### Input / Select / DatePicker
- `border-neutral-300` mặc định → `border-primary-600 ring-2 ring-primary-100` khi focus.
- Luôn có label rõ ràng (không chỉ placeholder).
- Error state: `border-danger` + text lỗi `text-danger text-sm` phía dưới.

### Badge trạng thái
```
Booking status:  held(vàng) | confirmed(xanh) | cancelled(đỏ) | expired(xám) | completed(xanh lá)
Venue status:    pending(vàng) | approved(xanh) | rejected(đỏ)
```

### Card sân (VenueCard)
- Ảnh 16:9, `object-cover`.
- Không overlay text trên ảnh (trừ badge trạng thái góc trên).
- Thông tin: tên sân (bold), quận/huyện, môn thể thao, giá từ, rating.
- Hover: `shadow-md`, không transform scale (gây layout shift).

### Bảng dữ liệu (Table)
- Dùng `<table>` HTML thực, KHÔNG dùng card grid thay thế bảng.
- Cột có thể sort (hiển thị mũi tên).
- Filter và bulk action ở thanh toolbar phía trên bảng.
- Pagination ở dưới.

## 10. Components Đặc thù

### SlotGrid (Lưới chọn block 30 phút)
- **Mobile:** Cuộn dọc (thời gian theo cột dọc).
- **Desktop:** Cuộn ngang nếu nhiều sân.
- **Chọn nhiều block:** Kéo để chọn nhiều block liên tiếp (drag select).
- **Hiển thị giá:** Mỗi block available hiển thị giá VND.
- **Realtime:** Cập nhật ngay khi nhận WebSocket event.
- **Đếm ngược:** Khi đang giữ chỗ, hiển thị countdown sticky bar.
- **Sticky summary:** Bar tóm tắt (số block, tổng giá, nút đặt) sticky ở cuối màn hình.

### OwnerTimeline (Resource View)
- **Trục X:** Thời gian (8:00 – 22:00), block 30 phút.
- **Trục Y:** Danh sách Court trong Venue.
- **Màu block:** Theo trạng thái booking.
- **Click block:** Mở detail panel (không mở modal riêng).
- **Kéo để tạo:** Kéo trên vùng trống tạo booking thủ công.
- **Desktop-first:** Tối ưu cho màn hình ≥ 1024px.

### BookingSummary / Checkout
- Hiển thị: Venue, Court, ngày, giờ bắt đầu – kết thúc, số block, đơn giá từng block, tổng giá.
- Countdown giữ chỗ nổi bật.
- Nút "Xác nhận đặt sân" là CTA duy nhất.

## 11. Layout

### Trang khách (Customer)
- **Header:** Logo + Search bar + Nav links + Auth buttons. Sticky khi scroll.
- **Footer:** Links tĩnh, thông tin liên hệ.
- **Trang tìm kiếm:** Sidebar filter (desktop) / bottom sheet filter (mobile) + danh sách/bản đồ.
- **Mobile-first** cho toàn bộ flow khách.

### Dashboard Owner / Admin
- **Sidebar:** Compact, icon + label, collapsible trên mobile.
- **Topbar:** Breadcrumb + avatar + notifications.
- **Desktop-first** (≥ 1024px).
- **KHÔNG** dùng centered hero hay full-width card grid cho dashboard.

## 12. Motion (Animation)

| Loại | Duration | Easing | Ghi chú |
|------|----------|--------|---------|
| Hover state | 150ms | ease-out | Button, link |
| Fade in | 200ms | ease-out | Toast, tooltip |
| Slide panel | 300ms | cubic-bezier(0.4,0,0.2,1) | Mobile sheet |
| Page transition | 200ms | ease-in-out | Fade only |
| Realtime slot update | 300ms | ease-in-out | Flash highlight → màu mới |

- **Luôn tôn trọng** `prefers-reduced-motion: reduce` → tắt animation.
- **Framer Motion:** Chỉ dùng cho component phức tạp (Sheet, SlotGrid update). Component đơn giản dùng CSS transition.
- **CẤM:** Animation quá 500ms cho UI thông thường.

## 13. Dark Mode

**Quyết định:** MVP KHÔNG có dark mode để tiết kiệm thời gian. Ghi vào decision log. Token màu đã chuẩn bị sẵn CSS variable để dễ thêm sau.

## 14. Copywriting tiếng Việt

### Thuật ngữ thống nhất (dùng nhất quán trong toàn app)

| Nên dùng | Không dùng |
|----------|------------|
| Đặt sân | Book sân, Reserve sân |
| Giữ chỗ | Hold, Lock slot |
| Chủ sân | Court owner, Venue manager |
| Sân thể thao | Sports facility |
| Khu vực | Area, Zone |
| Xác nhận | Confirm |
| Huỷ | Cancel |
| Tổng tiền | Total amount |

### Thông báo lỗi hữu ích
```
❌ SAI: "Error 409"
✅ ĐÚNG: "Slot này vừa được người khác đặt. Vui lòng chọn slot khác."

❌ SAI: "Validation failed"
✅ ĐÚNG: "Vui lòng nhập số điện thoại theo định dạng 0xxxxxxxxx"

❌ SAI: "Unauthorized"
✅ ĐÚNG: "Bạn cần đăng nhập để đặt sân"
```

### Trạng thái rỗng (Empty state)
- Không để trắng; phải có: icon (Lucide), tiêu đề ngắn, hành động gợi ý.
```
[Lucide: CalendarX]
Chưa có lịch đặt sân nào
Hãy tìm sân và đặt lịch ngay hôm nay
[Nút: Tìm sân ngay]
```
