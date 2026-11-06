# ĐẶC TẢ KỸ THUẬT: SỬA TRIỆT ĐỂ TOÀN BỘ DARK MODE TOÀN DỰ ÁN (DESIGN TOKENS & ANTI-AI DESIGN)

- **Mã tài liệu:** `SPEC-FE-DARKMODE-COMPLETE-01`
- **Tác giả:** Product Architect & UX Specifier (`ba-spec` - 9router_BA)
- **Dự án:** BookSportsCourt (Sàn thương mại điện tử đặt sân thể thao đa người dùng)
- **Nền tảng mục tiêu:** Web Client (`apps/web` - Next.js 14 App Router, TypeScript, Tailwind CSS, Radix UI, Lucide Icons)
- **Trạng thái:** Approved / Sẵn sàng bàn giao cho `senior-dev` (9router_DEV)
- **Tham chiếu:**
  - `AGENTS.md` (10 quy tắc tối thượng, đặc biệt: Quy tắc 6 Token CSS, Quy tắc 7 Lucide icon, Quy tắc 8 Đủ trạng thái UI)
  - `docs/07-design-system.md` (Hệ màu Neutral Slate, Surfaces, Typography, AA Contrast)
  - `docs/08-ui-quality-rules.md` (Checklist giao diện chuẩn Linear/Stripe, Anti-AI Design)
  - `docs/09-frontend-conventions.md` (Quy chuẩn Next.js 14 App Router, component architecture)
  - `docs/specs/frontend-batch3-completion-spec.md` (TODO-13 Dark Mode ban đầu)

---

## 1. Bối cảnh & Chẩn đoán Gốc rễ (Root Cause Analysis)

### 1.1. Hiện tượng lỗi thực tế (Màn hình `localhost:3000/admin/audit-logs`)
- Người dùng nhấn nút `ThemeToggle`, chuyển sang chế độ Dark Mode:
  - Icon trên nút chuyển thành Mặt trăng (`Moon`) thành công.
  - Thẻ `<html>` đã nhận class `dark`.
  - **TUY NHIÊN:** Nền toàn trang, thanh bên (Sidebar), thanh đầu trang (Header), thẻ bọc (Card), bảng dữ liệu (`table`, `thead`, `tbody`) vẫn **trắng tinh** (`#ffffff`).
  - Các nút bộ lọc danh mục (`Button variant="outline"`) bị **nền đen/tối loang lổ** nổi trên nền trắng, chữ xám khó đọc hoặc biến thành đen trên nền đen.
  - Các chip hành động (`formatAuditAction`) mang nền pastel nhạt (`bg-primary-50`, `bg-red-50`, `bg-amber-50`, `bg-blue-50`) với chữ màu tối, không có biến thể cho Dark Mode.

### 1.2. Chẩn đoán kỹ thuật gốc rễ
1. **Thiếu đảo chiều Ramp Neutral trong block `.dark` tại `apps/web/app/globals.css`:**
   - Trong `tailwind.config.ts`, `colors.neutral[0..900]` được map sang các biến CSS `var(--color-neutral-0..900)`.
   - Trong `globals.css`, block `.dark` chỉ định nghĩa lại các biến semantic surfaces (`--color-bg`, `--color-bg-card`, `--color-border`) nhưng **HOÀN TOÀN BỎ QUÊN** ramp 11 nấc `--color-neutral-0` đến `--color-neutral-900`.
   - Kết quả: Hơn 85 file trong `apps/web` sử dụng các class Tailwind trực tiếp (`text-neutral-900`, `text-neutral-600`, `border-neutral-200`, `bg-neutral-50`, `bg-neutral-100`) bị giữ nguyên giá trị màu của Light Mode, dẫn đến chữ đen trên nền tối, hoặc nền xám nhạt trên nền tối!
2. **Hard-code class màu sáng tuyệt đối (`bg-white`):**
   - Hàng chục UI Primitives (`card.tsx`, `input.tsx`, `select.tsx`, `textarea.tsx`, `dropdown-menu.tsx`, `dialog.tsx`, `data-table.tsx`, `pagination.tsx`) hard-code `bg-white` thay vì dùng token ngữ nghĩa `bg-bg-card`.
   - Trong Tailwind CSS, `bg-white` là `#ffffff` thuần túy (không phụ thuộc class `dark` trừ khi có `dark:bg-*`).
3. **Xung đột token trong `button.tsx`:**
   - Variant `outline` kết hợp: `border border-border bg-bg text-neutral-900 hover:bg-neutral-50`.
   - Khi bật Dark Mode: `bg-bg` đổi thành slate tối `#090d16`, nhưng `text-neutral-900` vẫn là slate đậm `#0f172a` (do neutral chưa đảo chiều). Nút trở thành nền đen - chữ đen, và nổi cộm loang lổ trên các trang chưa chuyển dark mode!
4. **Hard-code màu nền các Layout Shells:**
   - `DashboardShell.tsx`: Nền trang dùng `bg-neutral-50`, Sidebar dùng `border-neutral-200 bg-white`, Top Header dùng `border-neutral-200 bg-white`.
   - `Header.tsx`: Header container dùng `border-neutral-200 bg-white/95`.
   - `Footer.tsx`: Dùng `border-neutral-200 bg-neutral-50 text-neutral-600`.

---

## 2. Chiến lược Kiến trúc Tokens (Token Architecture)

### 2.1. Bảng Ánh Xạ Đảo Chiều Ramp Neutral trong `.dark` (CSS Variables)

Để giải quyết tận gốc cho toàn bộ 85 file đang sử dụng `neutral-*` mà không phải refactor thủ công từng class, ta thực hiện chiến lược **Đảo chiều Ramp Neutral (Inverted Neutral Ramp)** kết hợp với **Tokens Semantic**:

| Biến CSS | Light Mode (`:root`) | Dark Mode (`.dark`) | Vai trò ngữ nghĩa tương ứng | Tương phản WCAG AA |
|---|---|---|---|:---:|
| `--color-neutral-0` | `#ffffff` (Trắng) | `#0f172a` (Slate-900) | Nền thẻ Card / Surface chính | 15.8:1 |
| `--color-neutral-50` | `#f8fafc` (Slate-50) | `#090d16` (Slate-950 sâu) | Nền Canvas toàn trang | 17.5:1 |
| `--color-neutral-100` | `#f1f5f9` (Slate-100) | `#1e293b` (Slate-800) | Nền phụ / Subtle / Divider nhẹ | 13.2:1 |
| `--color-neutral-200` | `#e2e8f0` (Slate-200) | `#334155` (Slate-700) | Viền mặc định 1px (Border) | N/A (3:1 UI) |
| `--color-neutral-300` | `#cbd5e1` (Slate-300) | `#475569` (Slate-600) | Viền Form Input / Border nổi | N/A (3:1 UI) |
| `--color-neutral-400` | `#94a3b8` (Slate-400) | `#64748b` (Slate-500) | Chữ tắt (Disabled) / Placeholder | 3.5:1 |
| `--color-neutral-500` | `#64748b` (Slate-500) | `#94a3b8` (Slate-400) | Chữ phụ cấp 2 / Icon phụ | 6.6:1 |
| `--color-neutral-600` | `#475569` (Slate-600) | `#cbd5e1` (Slate-300) | Chữ thứ cấp (Secondary text) | 10.3:1 |
| `--color-neutral-700` | `#334155` (Slate-700) | `#e2e8f0` (Slate-200) | Chữ nội dung (Body text) | 13.5:1 |
| `--color-neutral-800` | `#1e293b` (Slate-800) | `#f1f5f9` (Slate-100) | Tiêu đề nhóm / Bold label | 15.2:1 |
| `--color-neutral-900` | `#0f172a` (Slate-900) | `#f8fafc` (Slate-50) | Tiêu đề chính / Heading h1-h3 | 17.5:1 |

### 2.2. Khối `.dark` chuẩn xác tại `apps/web/app/globals.css`

```css
.dark {
  /* === NEUTRAL INVERTED RAMP (Đảo chiều thông minh toàn hệ thống) === */
  --color-neutral-0: #0f172a;     /* Nền thẻ Card tối chuẩn Linear */
  --color-neutral-50: #090d16;    /* Nền trang Canvas slate sâu */
  --color-neutral-100: #1e293b;   /* Nền phụ subtle slate-800 */
  --color-neutral-200: #334155;   /* Viền 1px slate-700 */
  --color-neutral-300: #475569;   /* Viền ô input / select slate-600 */
  --color-neutral-400: #64748b;   /* Placeholder / Text disabled */
  --color-neutral-500: #94a3b8;   /* Text muted / Icon phụ */
  --color-neutral-600: #cbd5e1;   /* Text phụ rõ nét */
  --color-neutral-700: #e2e8f0;   /* Text nội dung chính */
  --color-neutral-800: #f1f5f9;   /* Text tiêu đề phụ */
  --color-neutral-900: #f8fafc;   /* Text tiêu đề chính nổi bật */

  /* === SURFACES === */
  --color-bg: #090d16;            /* Đồng bộ với neutral-50 */
  --color-bg-card: #0f172a;       /* Đồng bộ với neutral-0 */
  --color-bg-subtle: #1e293b;     /* Đồng bộ với neutral-100 */
  --color-border: #334155;        /* Đồng bộ với neutral-200 */
  --color-border-focus: #22c55e;  /* Viền focus primary-500 sáng rõ trên nền tối */

  /* === TEXT === */
  --color-text-primary: #f8fafc;   /* neutral-900 đã đảo chiều */
  --color-text-secondary: #94a3b8; /* neutral-500 đã đảo chiều */
  --color-text-disabled: #64748b;  /* neutral-400 đã đảo chiều */
  --color-text-inverse: #0f172a;   /* Nền card tối khi cần text tương phản */

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

  /* === SHADOWS (Tăng độ đục trên nền tối) === */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.4);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.5), 0 2px 4px -2px rgb(0 0 0 / 0.4);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.6), 0 4px 6px -4px rgb(0 0 0 / 0.4);
}
```

### 2.3. Danh Sách Trường Hợp Ngoại Lệ Cần Bảo Vệ (Special Protection Rules)

Khi đảo chiều neutral ramp, có một số thành phần đặc biệt **BẮT BUỘC KHÔNG ĐƯỢC ĐẢO CHIỀU** hoặc cần bảo vệ đặc biệt:

1. **Backdrop / Modal Overlay (`dialog.tsx`, `DashboardShell.tsx`):**
   - Lỗi nghiêm trọng nếu dùng `bg-neutral-900/50`: Do `neutral-900` ở dark mode thành `#f8fafc`, overlay sẽ biến thành **màn sương trắng mờ** che mắt người dùng!
   - **Quy tắc bắt buộc:** Overlay toàn bộ modal/drawer phải dùng `bg-black/60 dark:bg-black/75` (dùng màu đen thuần có độ trong suốt để luôn luôn làm tối màn hình nền trong mọi theme).
2. **Mã Barcode & VietQR Image (`CheckoutPaymentSection.tsx`, `PaymentPanel.tsx`):**
   - Camera điện thoại quét mã QR cần vùng đệm sáng (quiet zone) màu trắng tương phản với các điểm module đen.
   - **Quy tắc bắt buộc:** Khung chứa ảnh mã QR VietQR **phải giữ `bg-white p-2`**, viền `border border-neutral-200 dark:border-neutral-700`. Không được chuyển nền QR sang dark.
3. **Chữ trên nút Primary / Danger (`button.tsx`):**
   - Nút Primary (`bg-primary-700`) và Danger (`bg-danger`) luôn có nền đậm màu cả ở light và dark.
   - **Quy tắc bắt buộc:** Giữ nguyên `text-white`, tuyệt đối không dùng `text-neutral-0` (vì neutral-0 ở dark mode sẽ thành màu đen).
4. **Hệ thống Status Badges Pastel (`StatusBadge.tsx`, `AdminAuditLogsScreen.tsx`):**
   - Các nền pastel nhạt của Light Mode (`bg-amber-50`, `bg-blue-50`, `bg-red-50`, `bg-primary-50`) sẽ chói lóa trên nền tối nếu không có biến thể `dark:`.
   - **Quy tắc bắt buộc:** Mọi tone trạng thái phải có biến thể dark: nền đậm độ trong suốt 40% (`dark:bg-*-950/40`), viền đậm 50% (`dark:border-*-900/50`), chữ sáng màu cấp 300 (`dark:text-*-300`).
5. **Ring Offset trong SlotGrid (`SlotGrid.tsx`):**
   - Class chọn slot đang dùng `ring-offset-white`, tạo viền trắng lem luốc khi chọn slot trên nền tối.
   - **Quy tắc bắt buộc:** Đổi sang `ring-offset-bg-card` hoặc `ring-offset-neutral-0`.

---

## 3. Quy Chuẩn Di Trú UI Primitives Sang Tokens Semantic

Tất cả các file trong `apps/web/components/ui/` phải được chuẩn hóa triệt để:

### 3.1. `apps/web/components/ui/card.tsx`
- **Trước:** `className={cn('rounded-card border border-neutral-200 bg-white', className)}`
- **Sau:** `className={cn('rounded-card border border-border bg-bg-card text-text-primary', className)}`
- **CardTitle:** `text-lg font-medium text-text-primary`
- **CardDescription:** `text-sm text-text-secondary`

### 3.2. `apps/web/components/ui/button.tsx`
Chuẩn hóa các variants:
- **`primary`:** `bg-primary-700 text-white hover:bg-primary-600 active:bg-primary-800 focus-visible:ring-primary-600`
- **`secondary`:** `bg-bg-subtle text-text-primary hover:bg-neutral-200 dark:hover:bg-neutral-700 active:bg-neutral-300 dark:active:bg-neutral-600`
- **`outline`:** `border border-border bg-bg text-text-primary hover:bg-bg-subtle active:bg-neutral-200 dark:active:bg-neutral-700` (Tuyệt đối không trộn `bg-bg` với `text-neutral-900`)
- **`ghost`:** `text-text-secondary hover:bg-bg-subtle hover:text-text-primary active:bg-neutral-200 dark:active:bg-neutral-700`
- **`danger`:** `bg-danger text-white hover:bg-red-700 active:bg-red-800`

### 3.3. `apps/web/components/ui/input.tsx`, `select.tsx`, `textarea.tsx`
- Thay thế toàn bộ `border-neutral-300 bg-white text-neutral-900` thành:
  - `border border-border bg-bg-card text-text-primary`
  - `placeholder:text-text-disabled`
  - `disabled:bg-bg-subtle disabled:text-text-disabled`
  - `focus-visible:border-border-focus focus-visible:ring-primary-600/20`
- `SelectContent`: `border border-border bg-bg-card text-text-primary shadow-md`
- `SelectItem`: `text-text-primary data-[highlighted]:bg-bg-subtle data-[disabled]:text-text-disabled`

### 3.4. `apps/web/components/ui/dropdown-menu.tsx`
- `DropdownMenuContent` / `DropdownMenuSubContent`: `border border-border bg-bg-card text-text-primary shadow-md`
- `DropdownMenuItem`: `text-text-secondary focus:bg-bg-subtle focus:text-text-primary`
- `DropdownMenuSeparator`: `-mx-1 my-1 h-px bg-border`
- `DropdownMenuLabel`: `text-xs font-semibold text-text-secondary`

### 3.5. `apps/web/components/ui/dialog.tsx`
- `DialogOverlay`: `fixed inset-0 z-50 bg-black/60 dark:bg-black/75 backdrop-blur-xs`
- `DialogContent`: `rounded-card border border-border bg-bg-card text-text-primary p-6 shadow-lg`
- `DialogTitle`: `text-lg font-semibold text-text-primary`
- `DialogDescription`: `text-sm text-text-secondary`
- `DialogClose`: `text-text-secondary hover:bg-bg-subtle hover:text-text-primary`

### 3.6. `apps/web/components/ui/data-table.tsx`
- Wrapper bảng: `overflow-x-auto rounded-card border border-border bg-bg-card`
- `thead tr`: `border-b border-border bg-bg-subtle`
- `th`: `font-medium text-text-secondary`
- `tbody tr`: `border-b border-border/60 last:border-0 hover:bg-bg-subtle/50`
- `tbody tr[isSelected]`: `bg-primary-50 dark:bg-primary-950/40`
- `td`: `text-text-primary`
- Dấu gạch rỗng: `text-text-disabled`

### 3.7. `apps/web/components/ui/status-badge.tsx`
Cập nhật đầy đủ dark variants cho `badgeVariants`:
```typescript
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-colors',
  {
    variants: {
      tone: {
        yellow: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300',
        'yellow-strong': 'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/60 dark:text-amber-200',
        blue: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300',
        green: 'border-primary-200 bg-primary-50 text-primary-800 dark:border-primary-900/50 dark:bg-primary-950/40 dark:text-primary-300',
        red: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300',
        gray: 'border-border bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
        'gray-light': 'border-border bg-neutral-50 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400',
        orange: 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900/50 dark:bg-orange-950/40 dark:text-orange-300',
        'gray-strong': 'border-neutral-400 bg-neutral-200 text-neutral-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200',
        purple: 'border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-900/50 dark:bg-purple-950/40 dark:text-purple-300',
      },
      size: {
        sm: 'px-2 py-0 text-[11px]',
        md: '',
      },
    },
    defaultVariants: { tone: 'gray', size: 'md' },
  },
);
```

### 3.8. `apps/web/components/ui/pagination.tsx` & `components/common/Pagination.tsx`
- Nút phân trang thường: `border border-border bg-bg-card text-text-primary hover:bg-bg-subtle active:bg-neutral-200 dark:active:bg-neutral-700`
- Nút trang hiện tại: `bg-primary-700 text-white font-semibold shadow-xs hover:bg-primary-600`
- Dấu ba chấm: `text-text-disabled`

### 3.9. `apps/web/components/ui/skeleton.tsx` & `page-skeleton.tsx`
- `Skeleton`: `className={cn('animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-800', className)}`
- `Bar` trong `page-skeleton.tsx`: `<Skeleton className={cn('bg-neutral-100 dark:bg-neutral-800/80', className)} {...props} />`
- Các thẻ card giả lập trong `DashboardSkeleton`, `ListSkeleton`, `DetailSkeleton`, `FormSkeleton`: đổi `border-neutral-200 bg-white` sang `border-border bg-bg-card`.

### 3.10. `apps/web/components/ui/tabs.tsx`
- `TabsList`: `border-b border-border`
- `TabsTrigger`: `text-text-secondary hover:text-text-primary data-[state=active]:border-primary-600 data-[state=active]:text-primary-600 dark:data-[state=active]:text-primary-400`

---

## 4. Sửa Triệt Để Các Layout Shells

### 4.1. `apps/web/components/layout/DashboardShell.tsx` (Dành cho Owner & Admin)
1. **Nền trang chính:**
   - Đổi dòng 174: `<div className="flex min-h-screen w-full min-w-0 bg-neutral-50">` thành `<div className="flex min-h-screen w-full min-w-0 bg-bg text-text-primary">`.
2. **Sidebar Desktop:**
   - Đổi dòng 185: `<aside className={cn('... border-r border-neutral-200 bg-white ...')}>` thành `<aside className={cn('... border-r border-border bg-bg-card ...')}>`.
   - Sidebar header: `border-b border-border`.
   - Sidebar footer collapse button: `border-t border-border`, nút bấm `text-text-secondary hover:bg-bg-subtle hover:text-text-primary`.
3. **Thanh điều hướng Sidebar (`NavList`):**
   - Active: `bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 font-semibold`
   - Inactive: `text-text-secondary hover:bg-bg-subtle hover:text-text-primary`
4. **Header Topbar:**
   - Đổi dòng 258: `<header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b border-neutral-200 bg-white px-4 lg:px-6">` thành `<header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b border-border bg-bg-card px-4 lg:px-6">`.
   - Account trigger button: `hover:bg-bg-subtle`, chữ `text-text-primary`.
5. **Mobile Drawer:**
   - Backdrop overlay: đổi `bg-neutral-900/50` sang `bg-black/60 dark:bg-black/75`.
   - Drawer container: `bg-bg-card border-r border-border`.

### 4.2. `apps/web/components/common/Header.tsx` (Dành cho Public & Khách hàng)
1. **Header Container:**
   - Đổi dòng 80: `<header className="sticky top-0 z-40 w-full border-b border-neutral-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">`
   - Thành: `<header className="sticky top-0 z-40 w-full border-b border-border bg-bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-bg-card/80">`.
2. **Nav Links Desktop:**
   - Active: `bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300`
   - Inactive: `text-text-secondary hover:bg-bg-subtle hover:text-text-primary`
3. **User Account Trigger:**
   - `border border-border hover:bg-bg-subtle text-text-primary`
4. **Mobile Menu Drawer:**
   - `border-b border-border bg-bg-card text-text-primary`
   - Các nút liên kết bên trong: `text-text-primary hover:bg-bg-subtle`

### 4.3. `apps/web/components/common/Footer.tsx`
- **Footer Container:** Đổi dòng 16 từ `border-t border-neutral-200 bg-neutral-50 text-neutral-600` sang `border-t border-border bg-bg text-text-secondary`.
- **Tiêu đề cột:** `text-sm font-semibold text-text-primary`.
- **Liên kết:** `hover:text-primary-600 dark:hover:text-primary-400`.
- **Dòng bản quyền chân trang:** `border-t border-border text-xs text-text-disabled`.

---

## 5. Rà Soát & Sửa Triệt Để 4 Phân Hệ Màn Hình

### 5.1. Phân hệ Admin (`apps/web/components/features/admin/`)

1. **`AdminAuditLogsScreen.tsx` (Sửa ngay lập tức màn hình lỗi trong ảnh):**
   - **Hàm `formatAuditAction`:** Bổ sung dark variants cho toàn bộ các tone:
     ```typescript
     function formatAuditAction(action: string): { label: string; tone: string } {
       if (action.includes("approve")) {
         return {
           label: "Phê duyệt",
           tone: "bg-primary-50 text-primary-800 border-primary-200 dark:bg-primary-950/40 dark:text-primary-300 dark:border-primary-900/50"
         };
       }
       if (action.includes("reject")) {
         return {
           label: "Từ chối",
           tone: "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50"
         };
       }
       if (action.includes("suspend") || action.includes("cancel")) {
         return {
           label: "Khoá / Huỷ bỏ",
           tone: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50"
         };
       }
       if (action.includes("create")) {
         return {
           label: "Thêm mới",
           tone: "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50"
         };
       }
       if (action.includes("delete")) {
         return {
           label: "Xoá bỏ",
           tone: "bg-neutral-100 text-neutral-800 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700"
         };
       }
       return {
         label: action,
         tone: "bg-neutral-50 text-neutral-700 border-neutral-200 dark:bg-neutral-800/60 dark:text-neutral-300 dark:border-neutral-700"
       };
     }
     ```
   - **Bảng Audit Logs:**
     - `thead tr`: `border-b border-border bg-bg-subtle text-xs font-semibold uppercase text-text-secondary`
     - `tbody`: `divide-y divide-border`
     - `tbody tr`: `hover:bg-bg-subtle/50`
     - Text thời gian, actor, entity: sử dụng `text-text-primary` và `text-text-secondary`.
2. **`AdminDashboardScreen.tsx`:**
   - Sửa các nút hành động nhanh (dòng 103, 125) có `bg-white`: chuyển sang `dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300` và `dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300`.
3. **`AdminReviewsScreen.tsx`:**
   - 3 bộ lọc native `<select>` (dòng 150, 170, 187): chuyển sang `border-border bg-bg-card text-text-primary`.
   - `thead`: `border-b border-border bg-bg-subtle text-text-secondary`.
   - Reply note box: `border-border bg-bg-subtle text-text-secondary`.
4. **Các màn hình Admin khác (`AdminVenuesScreen`, `AdminUsersScreen`, `AdminOwnerApplicationsScreen`, `AdminBookingsScreen`, `AdminCatalogsScreen`):**
   - Đảm bảo các modal form (`RejectVenueDialog`, `AreaFormDialog`, `SportFormDialog`, `ForceCancelDialog`) kế thừa `Dialog` đã di trú chuẩn token.

### 5.2. Phân hệ Chủ sân (`apps/web/components/features/owner/`)

1. **`OwnerTimeline.tsx`:**
   - Khung Timeline container (dòng 512): `<section className="min-w-0 overflow-hidden rounded-card border border-border bg-bg-card">`.
   - Cột cố định tên sân (dòng 546): `sticky left-0 z-10 flex items-center border-r border-border bg-bg-card px-3 py-2 text-xs font-medium text-text-primary`.
   - Trạng thái slot `available` (dòng 562): Đổi `'bg-white hover:bg-primary-50 focus-visible:bg-primary-50'` sang `'bg-bg-card hover:bg-bg-subtle focus-visible:bg-bg-subtle'`.
   - Bộ chọn ngày và sân (dòng 435, 452): Đổi sang `border-border bg-bg-card text-text-primary`.
   - Khung chi tiết slot (dòng 647): `rounded-card border border-border bg-bg-card p-4`.
2. **`OwnerBookingsScreen.tsx`, `OwnerVenuesScreen.tsx`, `PaymentsManagement.tsx`:**
   - Loại bỏ các class hardcode `border-neutral-200 bg-white` trong các thẻ Card và Section, dùng `border-border bg-bg-card`.
   - Bộ chọn bộ lọc thanh toán (dòng 158): `border-border bg-bg-card text-text-primary`.

### 5.3. Phân hệ Khách hàng (`apps/web/components/features/` customer & booking)

1. **`ProfileScreen.tsx`:**
   - Avatar placeholder box (dòng 97): `border-border bg-bg-subtle`.
   - Toàn bộ FormField và Input đã tự động chuyển dark theo UI Primitives.
2. **`CheckoutScreen.tsx` & `CheckoutPaymentSection.tsx`:**
   - Khung chứa ảnh mã QR VietQR (dòng 76): **BẮT BUỘC GIỮ `bg-white`**, viền `border border-neutral-200 dark:border-neutral-700`.
   - Card Tóm tắt thanh toán (`CheckoutSummary.tsx`): `border-border bg-bg-card`.
3. **`NotificationsScreen.tsx`:**
   - Hàng thông báo chưa đọc (dòng 215): `border-primary-200 bg-primary-50/40 dark:border-primary-900/50 dark:bg-primary-950/30`.
   - Hàng thông báo đã đọc: `border-border bg-bg-card hover:bg-bg-subtle`.
4. **`SlotGrid.tsx` & `BookingSummary.tsx`:**
   - Đổi `ring-offset-white` thành `ring-offset-bg-card`.
   - `BookingSummary` wrapper: `border-border bg-bg-card`.

### 5.4. Phân hệ Công khai (`apps/web/app/(public)/` & public components)

1. **Trang chủ (`apps/web/app/(public)/page.tsx`):**
   - Hero section (dòng 60): Đổi `bg-gradient-to-b from-primary-50/50 via-white to-white` thành `bg-gradient-to-b from-primary-50/20 via-bg to-bg dark:from-primary-950/30 dark:via-bg dark:to-bg border-b border-border`.
   - Ô tìm kiếm nhanh (dòng 82): `border border-border bg-bg-card p-2 shadow-sm`.
   - Chip môn thể thao phổ biến (dòng 119): `border border-border bg-bg-card text-text-primary hover:bg-bg-subtle hover:border-primary-500`.
   - Live visual preview card (dòng 138): `border border-border bg-bg-card shadow-card`.
   - Mục "Vì sao chọn chúng tôi" (dòng 221, 235, 249): `border-border bg-bg-card`.
   - Mục số liệu thống kê (dòng 267): `border-b border-border bg-bg`.
2. **Trang Tìm sân (`apps/web/app/(public)/venues/page.tsx`):**
   - Thanh chuyển đổi ViewMode Lưới / Bản đồ (dòng 222-260):
     - Container: `border border-border bg-bg-subtle p-1`.
     - Nút active: `bg-bg-card text-text-primary shadow-xs`.
     - Nút inactive: `text-text-secondary hover:text-text-primary`.
3. **`VenueDetailScreen.tsx`:**
   - Thanh đặt sân cố định trên mobile (dòng 451): `border-t border-border bg-bg-card p-4 shadow-lg lg:hidden`.
   - Chip tiện ích (dòng 311): `border border-border bg-bg-card text-text-primary`.
4. **`VenueOpeningHours.tsx`:**
   - Container: `border border-border bg-bg-card`.
   - Highlight hôm nay (dòng 71): `border border-primary-300 bg-primary-50/50 text-primary-900 dark:border-primary-800 dark:bg-primary-950/40 dark:text-primary-200`.
5. **`VenueCard.tsx`:**
   - Dọn dẹp các class dư thừa/xung đột `dark:border-neutral-800 dark:bg-neutral-900`, chuyển về `border border-border bg-bg-card text-text-primary hover:shadow-md`.
   - Thẻ môn thể thao (dòng 111): `bg-bg-subtle text-text-secondary`.

---

## 6. Tiêu Chuẩn Anti-AI Design & Trải Nghiệm Người Dùng Cao Cấp

1. **CẤM Màu Đen Tuyệt Đối (`#000000`):**
   - Nền canvas là `#090d16` (slate cực sâu có sắc xanh đêm dịu mắt).
   - Nền card là `#0f172a` (slate-900).
   - Tuyệt đối không dùng màu đen `#000000` làm nền card/canvas vì sẽ gây rách thị giác (black smearing trên màn OLED khi cuộn) và làm mất chiều sâu phân lớp.
2. **CẤM Gradient Neon Tím/Hồng Cliche Kiểu AI:**
   - Giữ vững bản sắc thương hiệu thể thao xanh lá cây: `primary-600` (#16a34a) ở Light Mode, `primary-500` (#22c55e) hoặc `primary-400` (#4ade80) ở Dark Mode.
3. **Độ Tương Phản Chuẩn WCAG AA:**
   - Chữ chính (`#f8fafc`) trên nền card (`#0f172a`): Tương phản đạt **15.8:1** (vượt xa mức 4.5:1).
   - Chữ phụ (`#94a3b8`) trên nền card (`#0f172a`): Tương phản đạt **6.6:1** (đạt chuẩn AA cho mọi cỡ chữ).
4. **Không Giật Cục FOUC (Flash of Unstyled Content):**
   - Giữ nguyên script inline đồng bộ sớm trong thẻ `<head>` của `apps/web/app/layout.tsx` đã được thiết lập từ trước.

---

## 7. Danh Mục File Cần Chỉnh Sửa (Senior Dev File Checklist)

| STT | Đường dẫn file | Nhiệm vụ chính cần xử lý |
|:---:|---|---|
| 1 | `apps/web/app/globals.css` | Thêm toàn bộ ramp neutral `--color-neutral-0..900` đảo chiều trong block `.dark`. |
| 2 | `apps/web/components/ui/card.tsx` | Chuyển sang `border-border bg-bg-card text-text-primary`, `CardTitle`, `CardDescription`. |
| 3 | `apps/web/components/ui/button.tsx` | Sửa variant `outline`, `secondary`, `ghost` dùng `border-border`, `bg-bg`, `text-text-primary`. |
| 4 | `apps/web/components/ui/input.tsx` | Di trú `border-border bg-bg-card text-text-primary placeholder:text-text-disabled`. |
| 5 | `apps/web/components/ui/select.tsx` | Di trú `SelectTrigger`, `SelectContent`, `SelectItem`, `NativeSelect` sang tokens semantic. |
| 6 | `apps/web/components/ui/textarea.tsx` | Di trú tương tự `input.tsx`. |
| 7 | `apps/web/components/ui/dropdown-menu.tsx` | Di trú Content, Item, Separator sang `bg-bg-card border-border text-text-primary`. |
| 8 | `apps/web/components/ui/dialog.tsx` | Đổi overlay sang `bg-black/60 dark:bg-black/75`, Content sang `bg-bg-card border-border`. |
| 9 | `apps/web/components/ui/data-table.tsx` | Di trú wrapper, thead, tbody hover, td sang `border-border`, `bg-bg-card`, `bg-bg-subtle`. |
| 10 | `apps/web/components/ui/status-badge.tsx` | Bổ sung đầy đủ dark variants cho tất cả các tone trạng thái. |
| 11 | `apps/web/components/ui/pagination.tsx` | Di trú nút phân trang sang `border-border bg-bg-card text-text-primary`. |
| 12 | `apps/web/components/ui/skeleton.tsx` | Cập nhật `bg-neutral-200 dark:bg-neutral-800`. |
| 13 | `apps/web/components/ui/page-skeleton.tsx` | Sửa `Bar` và các container card giả lập sang tokens semantic. |
| 14 | `apps/web/components/ui/tabs.tsx` | Di trú `TabsList` và `TabsTrigger` sang `border-border text-text-secondary`. |
| 15 | `apps/web/components/layout/DashboardShell.tsx` | Đổi nền trang `bg-bg`, sidebar `border-border bg-bg-card`, top header `bg-bg-card`, nav link active/hover. |
| 16 | `apps/web/components/common/Header.tsx` | Đổi container sang `bg-bg-card/95 border-border`, nav links active/hover, mobile menu drawer. |
| 17 | `apps/web/components/common/Footer.tsx` | Đổi container sang `border-border bg-bg text-text-secondary`, heading `text-text-primary`. |
| 18 | `apps/web/components/common/Pagination.tsx` | Đổi text sang `text-text-secondary`. |
| 19 | `apps/web/components/features/admin/AdminAuditLogsScreen.tsx` | Sửa `formatAuditAction` có dark variants, sửa thead, tbody, text table sang semantic tokens. |
| 20 | `apps/web/components/features/admin/AdminReviewsScreen.tsx` | Sửa select filters, thead, reply note box. |
| 21 | `apps/web/components/features/admin/AdminDashboardScreen.tsx` | Sửa quick action buttons `dark:bg-...`. |
| 22 | `apps/web/components/features/owner/OwnerTimeline.tsx` | Sửa timeline container, sticky court column, available slot `bg-bg-card`, filter inputs. |
| 23 | `apps/web/components/features/booking/SlotGrid.tsx` | Sửa `ring-offset-white` sang `ring-offset-bg-card`. |
| 24 | `apps/web/components/features/booking/BookingSummary.tsx` | Sửa wrapper `border-border bg-bg-card`. |
| 25 | `apps/web/components/features/notification/NotificationsScreen.tsx` | Sửa thông báo đã đọc/chưa đọc với dark variants. |
| 26 | `apps/web/app/(public)/page.tsx` | Sửa hero section gradient, search box, sports chips, preview card, stats divider. |
| 27 | `apps/web/app/(public)/venues/page.tsx` | Sửa ViewMode switcher buttons sang `bg-bg-card text-text-primary`. |
| 28 | `apps/web/components/features/venue/VenueDetailScreen.tsx` | Sửa sticky mobile bar sang `bg-bg-card border-border`, amenity chips. |
| 29 | `apps/web/components/features/venue/VenueOpeningHours.tsx` | Sửa container và highlight "Hôm nay" dark variants. |
| 30 | `apps/web/components/features/venue/VenueCard.tsx` | Chuẩn hóa thẻ sang `border-border bg-bg-card`, tags `bg-bg-subtle`. |

---

## 8. Ma Trận Kiểm Thử (Test Matrix) Dành Cho `auto-tester`

| Mã Test | Loại Test | File thực thi | Mô tả kịch bản kiểm thử | Kết quả kỳ vọng |
|:---:|:---:|---|---|---|
| `TC-DM-01` | Unit | `apps/web/lib/hooks/useTheme.test.ts` | Bật dark mode, kiểm tra class `dark` trên `documentElement` và giá trị `localStorage`. | `classList.contains('dark') === true`, `localStorage === 'dark'`. |
| `TC-DM-02` | Unit | `apps/web/components/common/ThemeToggle.test.tsx` | Render nút toggle, bấm chọn Sáng/Tối/Hệ thống, kiểm tra gọi `setTheme`. | Dropdown mở ra, trigger icon hiển thị đúng (`Sun` / `Moon`). |
| `TC-DM-03` | Component | `apps/web/components/ui/button.test.tsx` (tạo/bổ sung) | Render Button với `variant="outline"`. | Không chứa class hardcode gây lỗi đen nền trên đen chữ. Chứa `border-border bg-bg text-text-primary`. |
| `TC-DM-04` | Component | `apps/web/components/ui/card.test.tsx` (tạo/bổ sung) | Render Card, CardTitle, CardDescription. | Khung Card chứa `bg-bg-card border-border text-text-primary`. |
| `TC-DM-05` | Component | `apps/web/components/ui/dialog.test.tsx` (tạo/bổ sung) | Render Dialog đang mở, kiểm tra DialogOverlay. | Overlay chứa `bg-black/60` hoặc `dark:bg-black/75`, tuyệt đối không dùng `bg-neutral-900/50`. |
| `TC-DM-06` | Component | `apps/web/components/ui/status-badge.test.tsx` (tạo/bổ sung) | Render StatusBadge với các tone `yellow`, `blue`, `green`, `red`. | Chứa đầy đủ các class `dark:bg-*-950/40` và `dark:text-*-300`. |
| `TC-DM-07` | Component | `apps/web/components/features/admin/AdminAuditLogsScreen.test.tsx` (bổ sung) | Render bảng Audit Logs. | Header thead chứa `bg-bg-subtle text-text-secondary`, hàng chứa `hover:bg-bg-subtle/50`. |
| `TC-DM-GATE-01` | Gate | Terminal command | Chạy `pnpm --filter @bsc/web typecheck` | 0 lỗi TypeScript compiler (`tsc --noEmit`). |
| `TC-DM-GATE-02` | Gate | Terminal command | Chạy `pnpm --filter @bsc/web lint` | 0 lỗi ESLint vi phạm. |
| `TC-DM-GATE-03` | Gate | Terminal command | Chạy `pnpm --filter @bsc/web test` | 100% test suites pass (bao gồm toàn bộ tests hiện có). |
| `TC-DM-GATE-04` | Gate | Terminal command | Chạy `pnpm --filter @bsc/web build` | Next.js production build compile thành công 100%. |

---

## 9. Hướng Dẫn Chuyển Giao Cho `senior-dev`

1. Đọc kỹ Mục 2 để cập nhật ngay `apps/web/app/globals.css`.
2. Tuân thủ nghiêm ngặt danh sách ngoại lệ ở Mục 2.3 (đặc biệt `dialog.tsx` overlay và mã VietQR).
3. Tuân thủ quy chuẩn di trú UI Primitives ở Mục 3 trước khi sửa các màn hình chi tiết ở Mục 5.
4. Lần lượt hoàn thành 30 files trong Checklist Mục 7.
5. Sau khi code xong, chuyển giao cho `auto-tester` chạy Test Matrix ở Mục 8.
