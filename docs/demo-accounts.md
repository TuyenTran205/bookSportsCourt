# Danh Sách Tài Khoản Demo Hệ Thống (BookSportsCourt)

Tài liệu này tổng hợp toàn bộ các tài khoản người dùng mẫu đã được nạp tự động vào cơ sở dữ liệu `booksports_dev` thông qua lệnh:
```bash
pnpm --filter @bsc/api db:seed
```

> **Mật khẩu dùng chung cho tất cả tài khoản:**  
> `BookSportsCourt-Dev-Only-2026!`

---

## 1. Bảng Tổng Hợp Tài Khoản Theo Vai Trò

| Vai trò (Role) | Họ và tên | Email đăng nhập | Số điện thoại | Kịch bản kiểm thử chính |
| :--- | :--- | :--- | :---: | :--- |
| **Quản trị viên (Admin)** | Quản trị viên Demo | `admin.demo@booksportscourt.local` | `0901234567` | Duyệt sân mới, duyệt đơn đăng ký chủ sân, xem Audit Logs. |
| **Chủ sân (Owner 1)** | Trần Văn Đức | `owner.duc@booksportscourt.local` | `0912345678` | Quản lý cụm sân HN & ĐN, bảng giá 30p, duyệt cọc, trả lời review. |
| **Chủ sân (Owner 2)** | Lê Thu Thảo | `owner.thao@booksportscourt.local` | `0987654321` | Quản lý cụm sân TP.HCM, xử lý hoàn tiền cọc, xem hồ sơ ĐKKD. |
| **Khách hàng (Customer 1)** | Nguyễn Hoàng Long | `customer.long@booksportscourt.local` | `0934567890` | Đặt sân, xem lịch sử đơn hoàn tất, review 5 sao, Google OAuth. |
| **Khách hàng (Customer 2)** | Vũ Minh Trí | `customer.tri@booksportscourt.local` | `0945678901` | Trải nghiệm giữ chỗ 15p (held), kiểm tra đơn hủy được hoàn cọc. |
| **Ứng viên đối tác (Applicant)** | Đặng Tuấn Anh | `applicant.anh@booksportscourt.local` | `0956789012` | Kiểm tra luồng nộp hồ sơ xin làm chủ sân (đang chờ duyệt). |
| *Chủ sân cũ (Legacy)* | Chủ sân Demo | `owner.demo@booksportscourt.local` | `0919999999` | Tài khoản tương thích ngược cho các bài test cũ. |
| *Khách cũ (Legacy)* | Khách hàng Demo | `customer.demo@booksportscourt.local` | `0939999999` | Tài khoản tương thích ngược cho các bài test cũ. |

---

## 2. Chi Tiết Kịch Bản Nghiệp Vụ Từng Tài Khoản

### 2.1. Quản trị viên (Admin)
- **Tài khoản:** `admin.demo@booksportscourt.local`
- **Mục tiêu test:**
  - **Duyệt cụm sân:** Truy cập danh sách sân chờ kiểm duyệt để duyệt hoặc từ chối sân **`Cụm Sân Pickleball Mỹ Đình`** (hiện đang ở trạng thái `pending`).
  - **Duyệt đối tác chủ sân:** Kiểm tra danh sách đơn đăng ký đối tác (`Owner Applications`), duyệt đơn xin mở sân của ứng viên **Đặng Tuấn Anh** (`0109876543`).
  - **Giám sát hệ thống:** Xem nhật ký kiểm toán (`Audit Logs`) ghi lại các thao tác duyệt sân, duyệt đơn, thay đổi giá.

---

### 2.2. Chủ sân Hà Nội & Đà Nẵng (Trần Văn Đức)
- **Tài khoản:** `owner.duc@booksportscourt.local`
- **Tài khoản ngân hàng nhận cọc:** Vietcombank - STK `0011004567890` - Tên: `TRAN VAN DUC`.
- **Cụm sân quản lý:**
  1. **CLB Cầu Lông & Pickleball Cầu Giấy (Hà Nội)** - *Approved (Rating: 5.0 / 1 đánh giá)*:
     - Sân Cầu Lông A1 (VIP Thảm Yonex)
     - Sân Cầu Lông A2 (Tiêu chuẩn - đang có lịch bảo trì đèn LED tuần tới)
     - Sân Pickleball P1
  2. **Khu Phức Hợp Thể Thao Sông Hàn (Đà Nẵng)** - *Approved*:
     - Sân Cầu Lông S1 (Sàn gỗ giảm chấn)
  3. **Cụm Sân Pickleball Mỹ Đình (Hà Nội)** - *Đang chờ Admin duyệt*.
- **Mục tiêu test:**
  - Quản lý thông tin sân, khung giờ mở cửa (06:00 - 22:30) và cấu hình bảng giá slot 30 phút theo khung giờ thường, giờ cao điểm và cuối tuần.
  - Xem danh sách đặt sân của khách hàng, xem biên lai ủy nhiệm chi và xác nhận thanh toán cọc.
  - Trả lời đánh giá của khách hàng (đã có sẵn 1 phản hồi cảm ơn khách Long trên hệ thống).

---

### 2.3. Chủ sân TP. Hồ Chí Minh (Lê Thu Thảo)
- **Tài khoản:** `owner.thao@booksportscourt.local`
- **Tài khoản ngân hàng nhận cọc:** MBBank - STK `0987654321` - Tên: `LE THU THAO`.
- **Cụm sân quản lý:**
  - **Trung Tâm Bóng Đá & Tennis Nam Sài Gòn (Quận 7, TP.HCM)** - *Approved*:
    - Sân Bóng Đá Mini 7 Người - Sân 1 (Cỏ nhân tạo FIFA)
    - Sân Tennis T1 (Mặt sân cứng US Open)
- **Mục tiêu test:**
  - Quản lý hồ sơ đối tác kinh doanh đã được duyệt (Mã số thuế: `0315928374`).
  - Xem lịch sử đơn hủy trước 24h và đối soát khoản tiền cọc 225.000đ đã hoàn trả cho khách hàng.

---

### 2.4. Khách hàng thân thiết (Nguyễn Hoàng Long)
- **Tài khoản:** `customer.long@booksportscourt.local`
- **Tài khoản liên kết:** Google OAuth (`google-oauth2|109283746592837465`).
- **Sân yêu thích đã lưu:** CLB Cầu Giấy và Sân Thể Thao Sông Hàn.
- **Lịch sử đơn đặt sân:**
  - **Đơn 1 (Hoàn tất):** Sân Cầu Lông A1 tuần trước, đã thanh toán đủ 270.000đ cọc (Mã GD: `BSC2411001`), đã để lại đánh giá 5 sao khen ngợi mặt thảm.
  - **Đơn 2 (Đã xác nhận cọc):** Sân Pickleball P1 lúc 19:00 - 20:30 tối mai, tiền cọc 240.000đ (Mã GD: `BSC2411002`) đã được chủ sân duyệt.
- **Mục tiêu test:**
  - Kiểm tra xem danh sách sân yêu thích (`Favorites`).
  - Xem thông báo đặt sân thành công và nhắc nhở lịch thi đấu tối mai.

---

### 2.5. Khách hàng trải nghiệm giữ chỗ & hoàn tiền (Vũ Minh Trí)
- **Tài khoản:** `customer.tri@booksportscourt.local`
- **Lịch sử đơn đặt sân:**
  - **Đơn 3 (Đang giữ chỗ - Held):** Sân Cầu Lông A1 (đang trong thời gian đếm ngược 15 phút chờ chuyển khoản cọc).
  - **Đơn 4 (Đã hủy & hoàn cọc):** Sân Bóng Mini Nam Sài Gòn cuối tuần, lý do *"Đội bóng bận lịch thi đấu trường đột xuất"*, đã được hoàn trả 100% tiền cọc (225.000đ).
- **Mục tiêu test:**
  - Trải nghiệm giao diện chuyển khoản thanh toán khi đang giữ chỗ.
  - Xem thông báo hoàn tiền cọc trong hòm thư cá nhân.

---

### 2.6. Người dùng xin mở sân (Đặng Tuấn Anh)
- **Tài khoản:** `applicant.anh@booksportscourt.local`
- **Hồ sơ đăng ký:** CLB Pickleball Mỹ Đình (Nam Từ Liêm, Hà Nội), Mã số thuế: `0109876543`. Trạng thái: `pending`.
- **Mục tiêu test:**
  - Kiểm tra màn hình theo dõi tiến độ duyệt hồ sơ đối tác chủ sân từ góc nhìn người dùng.
