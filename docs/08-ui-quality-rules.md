# 08 – Quy tắc chất lượng UI

> **Phiên bản:** 1.1.0 | **Cập nhật lần cuối:** 2026-10-12
>
> **Mọi PR có thay đổi UI PHẢI tự kiểm tra checklist này trước khi mở PR.**

---

## PHẦN A – CÁC ĐIỀU CẤM (với ví dụ)

### 🚫 CẤM-01: Gradient tím/xanh mặc định
```html
<!-- ❌ SAI – "AI default UI" -->
<div class="bg-gradient-to-r from-purple-500 to-blue-500">

<!-- ✅ ĐÚNG – Màu từ design token -->
<div class="bg-primary-600">
```

### 🚫 CẤM-02: Hero căn giữa + 3 card feature giống nhau
```html
<!-- ❌ SAI – SaaS landing page clichê -->
<section class="text-center py-24">
  <h1 class="text-5xl font-bold">Seamless Booking Experience</h1>
  <div class="grid grid-cols-3 gap-6 mt-12">
    <Card icon="⚡" title="Fast" />
    <Card icon="🔒" title="Secure" />
    <Card icon="🎯" title="Smart" />
  </div>
</section>

<!-- ✅ ĐÚNG – Khu vực search với ảnh venue thật, lọc theo môn/quận -->
<section class="bg-primary-700 px-6 py-10">
  <h1 class="text-2xl font-bold text-white">Đặt sân thể thao gần bạn</h1>
  <SearchBar />
</section>
```

### 🚫 CẤM-03: Mọi card đều rounded-2xl + shadow mềm
```html
<!-- ❌ SAI -->
<div class="rounded-2xl shadow-lg p-6 bg-white">

<!-- ✅ ĐÚNG – Card venue: rounded-lg, border, shadow chỉ khi hover -->
<div class="rounded-lg border border-neutral-200 bg-white hover:shadow-md transition-shadow">
```

### 🚫 CẤM-04: Emoji làm icon UI
```html
<!-- ❌ SAI -->
<span>⚽ Bóng đá</span>
<button>🔍 Tìm kiếm</button>

<!-- ✅ ĐÚNG -->
<Lucide.Search size={20} strokeWidth={1.5} />
<span>Bóng đá</span>
```

### 🚫 CẤM-05: Ảnh placeholder xám / lorem ipsum
```html
<!-- ❌ SAI -->
<img src="/placeholder.jpg" alt="placeholder" />
<p>Lorem ipsum dolor sit amet...</p>

<!-- ✅ ĐÚNG – Dữ liệu mẫu tiếng Việt thực tế -->
<img src="/demo/san-bong-da-phu-tho.jpg" alt="Sân bóng đá Phú Thọ" />
<p>Sân bóng đá mini chất lượng cao tại Quận 11, TP.HCM</p>
```

### 🚫 CẤM-06: Văn phong marketing rỗng
```
❌ SAI: "Seamless Booking Experience" / "Elevate Your Game" / "Unlock the Power"
✅ ĐÚNG: "Đặt sân thể thao online, xác nhận ngay trong 30 giây"
```

### 🚫 CẤM-07: Nút và badge cùng một kiểu cho mọi thứ
```html
<!-- ❌ SAI – Tất cả nút đều primary blue rounded-full -->
<button class="rounded-full bg-blue-500 px-6 py-3">Tìm sân</button>
<button class="rounded-full bg-blue-500 px-6 py-3">Huỷ đặt sân</button>

<!-- ✅ ĐÚNG – Phân biệt variant rõ ràng -->
<Button variant="primary">Đặt sân</Button>
<Button variant="danger" size="sm">Huỷ</Button>
```

### 🚫 CẤM-08: Spacing/màu/font-size hardcode ngoài token
```html
<!-- ❌ SAI -->
<div style="color: #3B82F6; font-size: 13px; margin-top: 11px">

<!-- ✅ ĐÚNG -->
<div class="text-info text-sm mt-3">
```

### 🚫 CẤM-09: Căn giữa mọi thứ
```html
<!-- ❌ SAI – Dashboard owner mà text-center -->
<div class="text-center">
  <h2>Doanh thu tháng này</h2>
  <p class="text-4xl">15.000.000đ</p>

<!-- ✅ ĐÚNG – Left-aligned, compact, scannable -->
<div>
  <p class="text-sm text-neutral-500">Doanh thu tháng này</p>
  <p class="text-2xl font-bold tabular-nums">15.000.000 ₫</p>
```

### 🚫 CẤM-10: Gradient text
```html
<!-- ❌ SAI -->
<h1 class="bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500">

<!-- ✅ ĐÚNG -->
<h1 class="text-primary-700">
```

### 🚫 CẤM-11: Glassmorphism lạm dụng
```html
<!-- ❌ SAI – backdrop-blur trên card bình thường -->
<div class="backdrop-blur-md bg-white/30 border border-white/20">

<!-- ✅ ĐÚNG – Chỉ dùng blur ở overlay modal backdrop nếu cần -->
```

### 🚫 CẤM-12: Chữ quá to trên dashboard
```html
<!-- ❌ SAI – Dashboard mà dùng text-5xl -->
<p class="text-5xl font-black">250.000đ</p>

<!-- ✅ ĐÚNG – text-2xl là tối đa cho metric dashboard -->
<p class="text-2xl font-bold tabular-nums">250.000 ₫</p>
```

### 🚫 CẤM-13: Bảng dữ liệu dạng card rời rạc
```html
<!-- ❌ SAI – Dùng div grid thay table -->
<div class="grid grid-cols-1 gap-4">
  {bookings.map(b => <div class="card">{b.id}...</div>)}

<!-- ✅ ĐÚNG – Dùng <table> HTML thực -->
<table class="w-full text-sm">
  <thead>...</thead>
  <tbody>...</tbody>
</table>
```

---

## PHẦN B – BẮT BUỘC

### ✅ BẮT-01: Dùng token design system
Không có exception. Nếu màu/size cần thiết chưa có trong token → đề xuất thêm vào `07-design-system.md` trong cùng PR.

### ✅ BẮT-02: Dữ liệu mẫu tiếng Việt thực tế
```
Tên sân:  "Sân Pickleball Phú Nhuận", "Sân Cầu Lông Thủ Đức"
Địa chỉ:  "123 Lê Văn Việt, Phường Hiệp Phú, TP. Thủ Đức"
Giá:      "250.000 ₫", "180.000 ₫/block"
Khách:    "Nguyễn Minh Khoa", "Trần Thị Lan"
```

### ✅ BẮT-03: Ảnh đúng tỷ lệ object-cover
```html
<img src="..." alt="Sân Pickleball Phú Nhuận"
     class="w-full aspect-video object-cover rounded-t-lg" />
```

### ✅ BẮT-04: Đủ trạng thái component
Mọi component UI phải có:
- [ ] **Loading** – Skeleton placeholder (không spinner toàn trang)
- [ ] **Empty** – Empty state có icon + text + CTA
- [ ] **Error** – Thông báo lỗi thân thiện + nút retry
- [ ] **Disabled** – Opacity 0.5, cursor-not-allowed
- [ ] **Hover** – Visual feedback
- [ ] **Focus-visible** – Ring outline cho keyboard navigation

### ✅ BẮT-05: Điều hướng bàn phím
- Tất cả interactive element có thể focus bằng Tab.
- Modal trap focus; đóng bằng Escape.
- SlotGrid có thể điều hướng bằng phím mũi tên.

### ✅ BẮT-06: Touch target tối thiểu 44px (mobile)
```html
<!-- Icon 16px: cần tổng vùng chạm ≥ 44px -->
<!-- p-3 = 12px mỗi bên → 16 + 12 + 12 = 40px, VẪN THIẾU 4px -->
<button class="p-3 -m-1">   <!-- ❌ chỉ đạt 40px -->
  <Lucide.X size={16} />
</button>

<!-- Đúng: p-3.5 = 14px mỗi bên → 16 + 14 + 14 = 44px -->
<button class="p-3.5 -m-1.5"> <!-- ✅ đạt 44px -->
  <Lucide.X size={16} />
</button>

<!-- Hoặc đặt kích thước tối thiểu tường minh, không phụ thuộc phép cộng padding -->
<button class="min-h-11 min-w-11 inline-flex items-center justify-center">
  <Lucide.X size={16} />      <!-- ✅ 11 × 4px = 44px -->
</button>
```
> `min-h-11 min-w-11` (44px) là cách an toàn nhất vì không phải cộng nhẩm padding + icon mỗi lần.

### ✅ BẮT-07: Hiển thị giá ở mọi nơi chọn giờ
SlotGrid, BookingSummary, OwnerTimeline đều phải hiển thị giá per slot.

### ✅ BẮT-08: Một màn hình = một mục đích, một CTA chính
Không có 2 nút Primary trên cùng màn hình.

---

## PHẦN C – Checklist tự kiểm (≥ 20 mục trước khi mở PR UI)

```
[ ] Không có màu hardcode (hex, rgb) trong code
[ ] Không có font-size hardcode ngoài Tailwind
[ ] Không có emoji làm icon UI
[ ] Không dùng gradient màu mặc định
[ ] Không dùng rounded-2xl/3xl cho card bình thường
[ ] Không có text placeholder "lorem ipsum" hay ảnh xám
[ ] Không có văn phong marketing tiếng Anh
[ ] Ảnh dùng object-cover và đúng aspect ratio
[ ] Mọi số tiền dùng tabular-nums và định dạng VND
[ ] Mọi ngày giờ hiển thị theo múi giờ Asia/Ho_Chi_Minh
[ ] Dữ liệu demo là tiếng Việt, địa chỉ thực tế
[ ] Component có đủ trạng thái: loading/empty/error/disabled
[ ] Hover state rõ ràng (không chỉ cursor-pointer)
[ ] Focus-visible ring hiển thị khi dùng bàn phím
[ ] Touch target ≥ 44px trên mobile
[ ] Responsive: kiểm tra ở 375 / 768 / 1280 / 1440 (bộ breakpoint chuẩn, xem 09-frontend-conventions.md)
[ ] Màn hình chỉ có 1 CTA primary
[ ] Bảng dữ liệu dùng <table> thực, không phải card grid
[ ] Empty state có icon + text + CTA
[ ] Thông báo lỗi viết tiếng Việt thân thiện, không phải HTTP status
[ ] Không có backdrop-blur trên card bình thường
[ ] Slot grid hiển thị giá tại mỗi block
[ ] PR có ảnh chụp màn hình ở 2 đầu mút: 375px (mobile) và 1440px (desktop)
```

---

## PHẦN D – Khi không chắc

1. Đối chiếu `07-design-system.md`.
2. Không tự chế component mới nếu đã có trong shadcn/ui.
3. Nếu muốn thêm component → cập nhật `07-design-system.md` trước khi code.
4. Nếu muốn thêm màu mới → kiểm tra tương phản AA trước.
