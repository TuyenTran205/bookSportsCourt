# 01 – Tổng quan sản phẩm

> **Phiên bản:** 1.2.0 | **Cập nhật lần cuối:** 2026-10-12

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
                    ┌── cron hết giờ sử dụng ──────► [completed]
                    │
[confirmed] ────────┼── Owner đánh dấu ────────────► [no_show]
                    │
                    └── huỷ theo chính sách ───────► [cancelled]

[held] ── 10 phút ─► [expired]
   │
   └─ khách gửi ảnh chuyển khoản ─► [pending_payment] ─ Owner duyệt ─► [confirmed]
                                             │
                                             └─ Owner từ chối / quá hạn duyệt (cron) ─► [cancelled]
```

> `completed` là trạng thái **kết thúc** (terminal): không có chuyển tiếp nào đi ra.
> `no_show` đi từ `confirmed` (khách đã xác nhận nhưng không đến), **không** đi từ `completed`.
> Bảng chuyển trạng thái đầy đủ ở [05-booking-and-realtime.md](05-booking-and-realtime.md).

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

API trả `status` ∈ **`available | held | booked | blocked | past`** (enum duy nhất, xem [11-api-contract.md](11-api-contract.md)).

`my_hold` **không phải** một giá trị `status` từ API — nó là **trạng thái hiển thị do FE suy ra** từ `status === 'held' && mine === true`. Tách như vậy để lưới slot không phải thêm giá trị enum chỉ vì lý do trình bày.

| State | Nguồn | Màu | Ý nghĩa |
|-------|-------|-----|---------|
| `available` | API | Xanh lá nhạt | Trống, có thể đặt |
| `held` | API | Vàng | Đang được giữ bởi người khác |
| `booked` | API | Xanh dương nhạt | Đã đặt (confirmed) |
| `my_hold` | FE suy ra (`held` + `mine`) | Tím nhạt | Đang giữ bởi chính khách hiện tại |
| `blocked` | API | Xám | Khoá (blackout, bảo trì) |
| `past` | API | Xám nhạt | Đã qua giờ |

> Màu lấy từ token ở [07-design-system.md](07-design-system.md#css-variables-thêm-vào-globalscss) — đó là nguồn đúng. Quy ước tên: **CSS variable dùng gạch nối** (`--color-slot-my-hold`, theo lệ CSS), còn **khoá trạng thái trong TS dùng gạch dưới** (`my_hold`, cho khớp cách đặt tên `status` của API).

## Phạm vi MVP (P0 – Bắt buộc)

> Danh sách này phải **đóng được vòng đời booking**: từ lúc khách giữ chỗ đến lúc đơn được xác nhận. Vì vậy thanh toán QR (CUS-09) và duyệt thanh toán (OWN-09) nằm ở P0 — thiếu chúng thì không booking nào tới được `confirmed`, và mọi tính năng phía sau (đánh giá, báo cáo doanh thu) đều vô nghĩa.
>
> Mỗi dòng ghi kèm mã tính năng ở [02-features-by-role.md](02-features-by-role.md) và work item ở [16-backlog.md](16-backlog.md).

**Nền tảng & tài khoản**
- [ ] Đăng ký / đăng nhập email + mật khẩu; phân quyền 3 vai trò (CUS-01, CUS-02)
- [ ] Xem và chỉnh sửa hồ sơ (CUS-15)
- [ ] Đăng ký làm chủ sân, chờ Admin duyệt (OWN-01)
- [ ] Admin duyệt Owner (ADM-01) và Venue (ADM-02); khoá/mở khoá tài khoản (ADM-03)

**Sân & giá**
- [ ] Quản lý Venue / Court / Sport / Amenity (OWN-02, OWN-03, ADM-04, ADM-05)
- [ ] Quản lý danh mục khu vực (tỉnh/quận) (ADM-06)
- [ ] Thiết lập giờ mở cửa theo từng court (OWN-04)
- [ ] Giá theo khung giờ (Pricing Rule) (OWN-05)
- [ ] Khoá giờ bảo trì & Mở khoá sân (Blackout Period) (OWN-08)

**Đặt sân (vòng đời chính)**
- [ ] Tìm kiếm & xem chi tiết sân (GST-01, GST-03; CUS-04, CUS-06)
- [ ] Lưới đặt sân block 30 phút (SlotGrid) (CUS-07)
- [ ] Chống trùng lịch bằng EXCLUDE constraint ở DB
- [ ] Giữ chỗ 10 phút + cron expire (CUS-08)
- [ ] **Thanh toán chuyển khoản QR + gửi ảnh xác nhận (CUS-09)** – P0 vì là bước duy nhất đưa booking sang `pending_payment`
- [ ] **Owner duyệt / từ chối thanh toán; đánh dấu no-show (OWN-09)** – P0, chốt `confirmed`
- [ ] Xem lịch sử đặt sân của khách (CUS-10)
- [ ] Realtime cập nhật trạng thái block trên mọi client
- [ ] OwnerTimeline + tạo booking thủ công (OWN-06, OWN-07)

**Vận hành & giám sát**
- [ ] Admin xem toàn bộ booking (ADM-07), thống kê hệ thống (ADM-08), audit log (ADM-09)
- [ ] Thông báo trong app: booking confirmed / sắp diễn ra / bị huỷ (CUS-14)

## Phạm vi P1 – Nên có

- [ ] Báo cáo doanh thu & tỷ lệ lấp đầy (Owner) (OWN-11, OWN-12)
- [ ] Chính sách huỷ và cọc (OWN-10); huỷ booking theo chính sách (CUS-11)
- [ ] Email thông báo (Resend)
- [ ] Đánh giá sân (CUS-13); Owner phản hồi đánh giá (OWN-13); Admin kiểm duyệt đánh giá (ADM-10)
- [ ] Yêu thích sân (CUS-12)
- [ ] Google OAuth (CUS-03)
- [ ] Quên mật khẩu / đặt lại mật khẩu (CUS-16)
- [ ] Xem sân trên bản đồ (GST-02, CUS-05); xem lưới chỉ đọc khi chưa đăng nhập (GST-04)
- [ ] Owner nhận thông báo booking mới (OWN-14)

**Ngoài phạm vi (P2 – KHÔNG làm trong đồ án)**

- Đặt lịch cố định hằng tuần (recurring booking)
- Voucher / khuyến mãi
- Nhân viên phân quyền cho Owner
- Đối soát thanh toán thật (webhook ngân hàng)
- Hoàn tiền tự động qua cổng thanh toán (MVP hoàn tiền thủ công, xem [05-booking-and-realtime.md](05-booking-and-realtime.md))
- SMS OTP
- Khiếu nại nâng cao
- App mobile (giai đoạn CUỐI và TÙY CHỌN)

> Cảnh báo trùng mã: `GST-*` là các tính năng **của khách vãng lai**, trùng chức năng với `CUS-*` nhưng khác điều kiện truy cập. Khi tạo issue, chọn một mã và ghi rõ — đừng tạo hai issue cho cùng một màn hình.

## Điểm nhấn kỹ thuật cho báo cáo

> Bài toán **chống đặt trùng lịch**: sử dụng PostgreSQL EXCLUDE constraint với extension `btree_gist` trên kiểu `tstzrange`, kết hợp cơ chế giữ chỗ có thời hạn và xử lý race condition trong transaction. Bắt buộc có test chứng minh 2 request đồng thời đặt cùng block chỉ 1 request thành công.
