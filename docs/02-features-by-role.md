# 02 – Tính năng theo vai trò

> **Phiên bản:** 1.2.0 | **Cập nhật lần cuối:** 2026-10-12

Mọi mã tính năng (CUS-XX, OWN-XX, ADM-XX) là tiền tố cho GitHub Issue và được tham chiếu trong `16-backlog.md`.

---

## Guest (Khách vãng lai – chưa đăng nhập)

| Mã | Tính năng | Ưu tiên | Tiêu chí chấp nhận |
|----|-----------|---------|---------------------|
| GST-01 | Tìm kiếm sân (khu vực, môn, giá, tiện ích) | P0 | Lọc được theo: tỉnh/quận, môn thể thao, giá tối đa, tiện ích; hiển thị kết quả pagination; không cần đăng nhập |
| GST-02 | Xem sân trên bản đồ (Leaflet + OpenStreetMap) | P0 | Hiển thị pin venue, click vào pin mở card venue; không cần đăng nhập |
| GST-03 | Xem chi tiết sân (Venue detail) | P0 | Hiển thị thông tin venue, danh sách court, ảnh gallery, đánh giá, giờ mở cửa; không cần đăng nhập |
| GST-04 | Xem lưới block 30 phút (chỉ đọc) | P0 | Hiển thị đúng trạng thái block (available/booked/held) theo realtime; không thể chọn block; hiển thị nút CTA "Đăng nhập để đặt sân" |
| GST-05 | Xem đánh giá sân | P1 | Hiển thị danh sách review (sao, nhận xét, ngày); không cần đăng nhập; không thể gửi đánh giá |
| GST-06 | Đăng ký / Đăng nhập | P0 | Hiển thị form đăng ký và đăng nhập; sau khi đăng nhập thành công redirect về trang trước đó |

---

## Customer (Khách đặt sân)

| Mã | Tính năng | Ưu tiên | Tiêu chí chấp nhận |
|----|-----------|---------|---------------------|
| CUS-01 | Đăng ký tài khoản (email + mật khẩu) | P0 | Tạo được tài khoản, nhận email xác nhận (P1), không cho trùng email |
| CUS-02 | Đăng nhập / Đăng xuất | P0 | Access token + Refresh token httpOnly; tự động refresh; logout xoá cookie |
| CUS-03 | Đăng nhập Google OAuth | P1 | Redirect OAuth, tạo profile nếu chưa có, merge account nếu email trùng |
| CUS-04 | Tìm kiếm sân (khu vực, môn, giá, tiện ích) | P0 | Lọc được theo: tỉnh/quận, môn thể thao, giá tối đa, tiện ích; hiển thị kết quả pagination |
| CUS-05 | Xem sân trên bản đồ (Leaflet + OpenStreetMap) | P0 | Hiển thị pin venue, click vào pin mở card venue |
| CUS-06 | Xem chi tiết sân (Venue detail) | P0 | Hiển thị thông tin venue, danh sách court, ảnh gallery, đánh giá, giờ mở cửa |
| CUS-07 | Chọn ngày và xem lưới block 30 phút (SlotGrid) | P0 | Hiển thị đúng trạng thái block realtime; giá hiển thị ở mỗi block; kéo chọn nhiều block liên tiếp |
| CUS-08 | Giữ chỗ (Hold) và đếm ngược 10 phút | P0 | Sau khi chọn block, server tạo hold; client hiển thị countdown; hết hạn tự động trả về available |
| CUS-09 | Thanh toán chuyển khoản QR | **P0** | Người đặt chuyển khoản qua mã QR của chủ sân (số tiền cọc + nội dung chuyển khoản điền sẵn), lúc xác nhận thanh toán thì gửi ảnh đã chuyển khoản trong 10 phút; booking sang pending_payment, chờ Owner duyệt |
| CUS-10 | Xem lịch sử đặt sân | P0 | Danh sách booking với filter trạng thái; xem chi tiết từng booking |
| CUS-11 | Huỷ booking | P1 | Tuân theo chính sách huỷ của Owner; hiển thị điều kiện huỷ trước khi xác nhận |
| CUS-12 | Yêu thích sân (Favorite) | P1 | Toggle yêu thích; xem danh sách sân đã yêu thích |
| CUS-13 | Đánh giá sân sau khi hoàn thành | P1 | Chỉ đánh giá được booking trạng thái completed; 1-5 sao + nhận xét văn bản |
| CUS-14 | Thông báo trong app | P1 | Thông báo khi booking confirmed, sắp diễn ra (24h trước), huỷ |
| CUS-15 | Xem và chỉnh sửa hồ sơ | P0 | Cập nhật tên, số điện thoại, ảnh đại diện |
| CUS-16 | Quên / đặt lại mật khẩu | P1 | Gửi email chứa link đặt lại (`POST /auth/forgot-password`); luôn trả 204 để không lộ email có tồn tại; link chứa token dùng một lần, hết hạn 15 phút (`auth_tokens.type = 'password_reset'`); đặt lại xong thu hồi mọi refresh token cũ |

---

## Owner (Chủ sân)

| Mã | Tính năng | Ưu tiên | Tiêu chí chấp nhận |
|----|-----------|---------|---------------------|
| OWN-01 | Đăng ký làm chủ sân (gửi hồ sơ) | P0 | Form đăng ký, chờ Admin duyệt; trạng thái pending/approved/rejected |
| OWN-02 | Tạo và quản lý Venue | P0 | CRUD venue: tên, địa chỉ, mô tả, ảnh, môn thể thao, tiện ích, toạ độ GPS |
| OWN-03 | Tạo và quản lý Court | P0 | CRUD court trong venue: tên, mô tả, ảnh, trạng thái active/inactive |
| OWN-04 | Thiết lập giờ mở cửa (Opening Hours) | P0 | Cấu hình giờ mở/đóng theo thứ trong tuần cho từng court |
| OWN-05 | Thiết lập giá theo khung giờ (Pricing Rules) | P0 | Giá khác nhau theo giờ, thứ, ngày đặc biệt; ưu tiên rule cụ thể hơn rule chung |
| OWN-06 | Xem OwnerTimeline (Resource view) | P0 | Timeline sân × giờ, block 30 phút, màu theo trạng thái, kéo để tạo booking thủ công |
| OWN-07 | Tạo booking thủ công | P0 | Tạo booking trực tiếp cho khách đến trực tiếp; bỏ qua bước thanh toán online |
| OWN-08 | Khoá giờ bảo trì (Blackout Period) | P0 | Tạo blackout trên court cho khoảng thời gian cụ thể; không cho khách đặt |
| OWN-09 | Duyệt / Từ chối thanh toán, Đánh dấu No-show | P0 | Owner xem ảnh chuyển khoản của booking pending_payment, duyệt (→ confirmed) hoặc từ chối kèm lý do (→ cancelled); quá 2 giờ không xử lý tự huỷ |
| OWN-10 | Thiết lập chính sách huỷ và cọc | P1 | Cấu hình: huỷ trước X giờ được hoàn Y%; yêu cầu cọc Z% |
| OWN-11 | Báo cáo doanh thu | P1 | Biểu đồ doanh thu theo ngày/tuần/tháng; lọc theo venue/court |
| OWN-12 | Báo cáo tỷ lệ lấp đầy | P1 | Phần trăm block được đặt; peak hours; so sánh kỳ |
| OWN-13 | Quản lý đánh giá | P1 | Xem và phản hồi đánh giá từ khách |
| OWN-14 | Nhận thông báo booking mới | P1 | Thông báo realtime + email khi có booking mới, huỷ |

---

## Admin (Quản trị nền tảng)

| Mã | Tính năng | Ưu tiên | Tiêu chí chấp nhận |
|----|-----------|---------|---------------------|
| ADM-01 | Duyệt / Từ chối Owner đăng ký | P0 | Xem hồ sơ, approve/reject với ghi chú; Owner nhận email thông báo |
| ADM-02 | Duyệt / Từ chối Venue | P0 | Xem thông tin venue, approve/reject; Venue chỉ hiển thị cho khách sau khi được duyệt |
| ADM-03 | Khoá / Mở khoá tài khoản | P0 | Khoá tài khoản Customer hoặc Owner; tài khoản bị khoá không thể đăng nhập |
| ADM-04 | Quản lý danh mục môn thể thao | P0 | CRUD sport: tên, icon, slug |
| ADM-05 | Quản lý danh mục tiện ích (Amenity) | P0 | CRUD amenity: tên, icon |
| ADM-06 | Quản lý danh mục khu vực (Area/District) | P0 | CRUD area: tỉnh/thành, quận/huyện |
| ADM-07 | Xem toàn bộ booking hệ thống | P0 | Danh sách booking với filter đầy đủ; xem chi tiết |
| ADM-08 | Xem thống kê toàn hệ thống | P0 | Tổng booking, doanh thu, số venue, số user theo kỳ |
| ADM-09 | Audit log | P0 | Ghi lại mọi hành động admin; không thể sửa/xoá |
| ADM-10 | Kiểm duyệt đánh giá | P1 | Ẩn/hiển thị review vi phạm tiêu chuẩn cộng đồng |
