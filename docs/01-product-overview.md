# 01 – Tổng quan sản phẩm

> **Phiên bản:** 1.1.0 | **Cập nhật lần cuối:** 2026-10-07

## Mục tiêu sản phẩm

BookSportsCourt là nền tảng marketplace đặt sân thể thao trực tuyến tại Việt Nam, cho phép:
- **Khách (Customer):** tìm kiếm, so sánh và đặt sân theo block 30 phút với giá minh bạch.
- **Chủ sân (Owner):** đăng ký sân, quản lý lịch, giá và doanh thu trên một dashboard duy nhất.
- **Admin nền tảng:** duyệt chủ sân, kiểm soát nội dung, xem thống kê toàn hệ thống.

**Ưu tiên:** chi phí vận hành gần như 0đ (free tier), đúng đắn về nghiệp vụ (chống trùng lịch), dễ trình bày trong báo cáo đồ án.

## Vai trò người dùng

| Vai trò | Mô tả | Điều kiện |
|---------|-------|-----------|
| **Guest** | Chưa đăng nhập, chỉ xem danh sách sân | Không cần tài khoản |
| **Customer** | Khách đặt sân, quản lý lịch cá nhân | Đăng ký tài khoản |
| **Owner** | Chủ sân, quản lý venue/court/giá | Được Admin duyệt |
| **Admin** | Quản trị nền tảng | Tài khoản seeded nội bộ |

## Thuật ngữ thống nhất

| Thuật ngữ | Định nghĩa | Ghi chú |
|-----------|------------|---------|
| **Venue** (cơ sở/sân) | Địa điểm thể thao do một Owner quản lý (vd: "Sân bóng đá Mini Thủ Đức") | Một Owner có thể có nhiều Venue |
| **Court** (sân con) | Đơn vị sân cụ thể bên trong một Venue (vd: "Sân số 1", "Sân Pickleball A") | Một Venue có nhiều Court |
| **Sport** (môn thể thao) | Loại hình thể thao (bóng đá, cầu lông, pickleball, tennis, bóng rổ...) | Danh mục do Admin quản lý |
| **Slot / Block** | Khoảng thời gian 30 phút, đơn vị đặt sân nhỏ nhất | Thời điểm bắt đầu/kết thúc là bội số 30 phút |
| **Hold** (giữ chỗ) | Trạng thái tạm giữ block khi khách đang thanh toán, có thời hạn 10 phút | Hết hạn tự động chuyển sang `expired` |
| **Booking** (đặt sân) | Một giao dịch đặt một hoặc nhiều block liên tiếp trên một Court | Đơn vị thanh toán |
| **Pricing Rule** | Quy tắc giá theo khung giờ, thứ trong tuần hoặc ngày đặc biệt | Giá tính ở server |
| **Opening Hours** | Giờ mở cửa mặc định của một Court theo thứ | Có thể ghi đè bằng Blackout |
| **Blackout Period** | Khoảng thời gian Court không hoạt động (bảo trì, sự kiện riêng) | Không cho đặt |
| **Owner Timeline** | Giao diện xem tất cả Court trong Venue theo trục thời gian × sân | Resource view |
| **Slot State** | Trạng thái hiển thị của một block 30 phút trên lưới | Xem bên dưới |

### Trạng thái Booking (Booking Status)

```
held → pending_payment → confirmed → completed
                      ↘               ↘ cancelled
held → expired                        ↘ no_show
```

| Trạng thái | Mô tả |
|------------|-------|
| `held` | Đang giữ chỗ (10 phút), chờ khách chuyển khoản qua mã QR chủ sân và tải ảnh xác nhận |
| `pending_payment` | Khách đã gửi ảnh chuyển khoản, chờ Owner duyệt (vẫn chiếm block) |
| `confirmed` | Owner đã duyệt đã nhận tiền, booking hợp lệ |
| `completed` | Đã sử dụng xong |
| `cancelled` | Bị huỷ (bởi Customer hoặc Owner theo chính sách; Owner từ chối thanh toán; quá hạn Owner duyệt) |
| `expired` | Hold hết hạn 10 phút, khách không gửi ảnh xác nhận chuyển khoản |
| `no_show` | Khách không đến (Owner đánh dấu) |

### Trạng thái Block trên lưới (Slot State)

| State | Màu | Ý nghĩa |
|-------|-----|---------|
| `available` | Xanh lá nhạt | Trống, có thể đặt |
| `held` | Vàng | Đang được giữ bởi người khác |
| `booked` | Xanh dương đậm | Đã đặt (confirmed) |
| `my_hold` | Xanh dương nhạt | Đang giữ bởi chính khách hiện tại |
| `blocked` | Xám | Khoá (blackout, bảo trì) |
| `past` | Xám nhạt | Đã qua giờ |

## Phạm vi MVP (P0 – Bắt buộc)

- [ ] Đăng ký / đăng nhập email + mật khẩu; phân quyền 3 vai trò
- [ ] Quản lý Venue / Court / Sport / Amenity
- [ ] Giá theo khung giờ (Pricing Rule)
- [ ] Lưới đặt sân block 30 phút (SlotGrid)
- [ ] Chống trùng lịch bằng EXCLUDE constraint ở DB
- [ ] Giữ chỗ 10 phút + cron expire
- [ ] Realtime cập nhật trạng thái block
- [ ] OwnerTimeline (giao diện quản lý sân cho Owner)
- [ ] Admin duyệt Owner / Venue

## Phạm vi P1 – Nên có

- [ ] Báo cáo doanh thu & tỷ lệ lấp đầy (Owner)
- [ ] Thanh toán chuyển khoản qua QR chủ sân + gửi ảnh xác nhận + Owner duyệt
- [ ] Email thông báo (Resend)
- [ ] Đánh giá sân
- [ ] Huỷ booking theo chính sách
- [ ] Google OAuth

## Ngoài phạm vi (P2 – KHÔNG làm trong đồ án)

- Đặt lịch cố định hằng tuần (recurring booking)
- Voucher / khuyến mãi
- Nhân viên phân quyền cho Owner
- Đối soát thanh toán thật
- SMS OTP
- Khiếu nại nâng cao
- App mobile (giai đoạn CUỐI và TÙY CHỌN)

## Điểm nhấn kỹ thuật cho báo cáo

> Bài toán **chống đặt trùng lịch**: sử dụng PostgreSQL EXCLUDE constraint với extension `btree_gist` trên kiểu `tstzrange`, kết hợp cơ chế giữ chỗ có thời hạn và xử lý race condition trong transaction. Bắt buộc có test chứng minh 2 request đồng thời đặt cùng block chỉ 1 request thành công.
