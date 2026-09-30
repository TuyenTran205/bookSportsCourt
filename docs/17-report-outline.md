# 17 – Dàn ý báo cáo đồ án

> **Phiên bản:** 1.0.0 | **Cập nhật lần cuối:** 2026-09-30

## Dàn ý các chương

### Chương 1 – Giới thiệu đề tài
- Lý do chọn đề tài (bài toán đặt sân thể thao tại Việt Nam)
- Mục tiêu và phạm vi
- Đối tượng sử dụng (Customer, Owner, Admin)
- Công nghệ sử dụng (tổng quan, lý do chọn)

**Trích từ docs:** `01-product-overview.md` (mục tiêu, vai trò, thuật ngữ)

---

### Chương 2 – Phân tích yêu cầu
- 2.1 Use case diagram (3 actor: Guest/Customer, Owner, Admin)
- 2.2 Danh sách use case theo vai trò (bảng)
- 2.3 Đặc tả use case chi tiết: Đặt sân, Quản lý venue, Duyệt chủ sân
- 2.4 Phi chức năng: hiệu năng, bảo mật, khả năng mở rộng, chi phí

**Trích từ docs:** `02-features-by-role.md` (toàn bộ); `06-security-and-permissions.md` (phi chức năng)

**Sơ đồ cần có:**
```
[ Use case diagram – 3 actor ]
```

---

### Chương 3 – Thiết kế hệ thống
- 3.1 Kiến trúc tổng thể (sơ đồ component: FE ↔ API ↔ DB ↔ dịch vụ ngoài)
- 3.2 Thiết kế CSDL
  - ERD (sơ đồ quan hệ)
  - Mô tả bảng chính: bookings, courts, pricing_rules
  - EXCLUDE constraint và lý do chọn PostgreSQL + btree_gist
- 3.3 Thiết kế API (REST + WebSocket)
- 3.4 Thiết kế bảo mật (auth, RBAC, rate limit)
- 3.5 Thiết kế giao diện (design system, personas)

**Trích từ docs:** `03-architecture.md`, `04-database-schema.md`, `11-api-contract.md`, `06-security-and-permissions.md`, `07-design-system.md`

**Sơ đồ cần có:**
```
[ Kiến trúc hệ thống – Mermaid từ 03-architecture.md ]
[ ERD – Mermaid từ 04-database-schema.md ]
[ Sequence diagram: Luồng đặt sân (tạo hold → thanh toán → confirmed) ]
[ State machine: Vòng đời Booking ]
```

---

### Chương 4 – Điểm nhấn kỹ thuật: Chống đặt trùng lịch
> **Đây là chương quan trọng nhất cho điểm kỹ thuật.**

- 4.1 Bài toán race condition trong đặt sân
- 4.2 Giải pháp 1: Pessimistic locking (SELECT FOR UPDATE) – nhược điểm
- 4.3 Giải pháp 2: EXCLUDE constraint với btree_gist (giải pháp chọn)
  - Giải thích EXCLUDE USING gist (court_id WITH =, during WITH &&)
  - Tại sao tstzrange và toán tử &&
  - Lợi ích: DB tự từ chối, không cần logic application
- 4.4 Cơ chế giữ chỗ (Hold) có thời hạn
  - Vòng đời hold → expire
  - Cron job vs trigger
  - Tại sao expire trong cùng transaction với hold mới
- 4.5 Xử lý race condition
  - Sequence diagram: 2 user đặt cùng block đồng thời
  - Ai nhận 201, ai nhận 409
- 4.6 Test chứng minh
  - Code test đồng thời (Supertest, Promise.all)
  - Kết quả test: N request → 1 thành công, N-1 nhận 409

**Trích từ docs:** `05-booking-and-realtime.md` (toàn bộ)

**Sơ đồ cần có:**
```
[ Sequence diagram: Race condition – 2 user đặt cùng slot ]
[ State machine: Booking status transitions ]
[ Code snippet: EXCLUDE constraint SQL ]
[ Kết quả test: screenshot hoặc output ]
```

---

### Chương 5 – Cài đặt & Kiểm thử
- 5.1 Môi trường phát triển (monorepo, công cụ)
- 5.2 Cấu trúc code (feature-based, module NestJS)
- 5.3 Chiến lược kiểm thử
  - Unit test (Vitest/Jest)
  - API test (Supertest)
  - E2E test (Playwright)
- 5.4 CI/CD pipeline

**Trích từ docs:** `12-coding-standards.md`, `09-frontend-conventions.md`, `10-backend-conventions.md`

---

### Chương 6 – Kịch bản Demo
*(Xem chi tiết bên dưới)*

---

### Chương 7 – Kết luận & Hướng phát triển
- Những gì đã làm được (P0, P1)
- Những gì chưa làm (P2)
- Hướng phát triển: mobile app, recurring booking, thanh toán thật

**Trích từ docs:** `01-product-overview.md` (phạm vi P2)

---

## Kịch bản Demo từng bước

### Kịch bản A – Luồng khách đặt sân
1. Mở trang chủ → tìm "sân cầu lông Thủ Đức"
2. Xem danh sách kết quả + bản đồ
3. Chọn "Sân Cầu Lông Thủ Đức Xanh" → xem chi tiết
4. Chọn ngày mai, chọn Sân 1
5. SlotGrid hiển thị: một số slot đang `held`, `booked`, `available`
6. Kéo chọn 2 block liên tiếp 08:00 – 09:00
7. Countdown 10 phút hiển thị, sticky summary bar xuất hiện
8. Nhấn "Xác nhận đặt sân" → trang checkout
9. VietQR sandbox: hiển thị QR, chờ confirm
10. Booking chuyển sang `confirmed` → slot xanh dương trên lưới

### Kịch bản B – Demo race condition (2 trình duyệt)
1. Mở 2 tab trình duyệt, đăng nhập 2 tài khoản khác nhau
2. Cả 2 cùng vào trang chọn sân cùng ngày, cùng court
3. Cả 2 chọn CÙNG block 08:00 – 08:30
4. Nhấn "Giữ chỗ" gần như cùng lúc
5. **Kết quả:** Tab 1 thành công (slot chuyển `my_hold` xanh nhạt), Tab 2 nhận thông báo "Slot vừa được người khác đặt"
6. Tab 1 thấy slot của mình; Tab 2 thấy slot đó là `held`
7. Sau 10 phút không thanh toán: slot trở lại `available` realtime trên cả 2 tab

### Kịch bản C – Owner quản lý
1. Đăng nhập với tài khoản Owner
2. Mở OwnerTimeline → xem toàn bộ booking ngày hôm nay
3. Click block đã có booking → xem chi tiết
4. Tạo booking thủ công cho khách đến trực tiếp
5. Tạo blackout "Bảo trì Sân 2" ngày mai

### Kịch bản D – Admin duyệt
1. Đăng nhập Admin
2. Xem danh sách Owner chờ duyệt
3. Duyệt một Owner → Owner nhận email thông báo
4. Duyệt Venue của Owner đó → Venue xuất hiện trên trang tìm kiếm

---

## Mục nào trích từ docs nào

| Nội dung báo cáo | Nguồn docs |
|-----------------|-----------|
| Mục tiêu, vai trò | `01-product-overview.md` |
| Use case, tính năng | `02-features-by-role.md` |
| Kiến trúc, sơ đồ | `03-architecture.md` |
| ERD, schema | `04-database-schema.md` |
| EXCLUDE, hold, race condition | `05-booking-and-realtime.md` |
| Bảo mật, phân quyền | `06-security-and-permissions.md` |
| Quyết định kỹ thuật | `18-decision-log.md` |
| Chi phí, deploy | `13-deployment-and-cost.md` |

---

## Checklist nộp bài

- [ ] Báo cáo đủ các chương (1–7)
- [ ] Tất cả sơ đồ có caption và số thứ tự
- [ ] Code snippet có syntax highlighting
- [ ] Có screenshot demo các màn hình chính
- [ ] Có video demo (đặc biệt race condition)
- [ ] Repo GitHub public hoặc đã share với giáo viên
- [ ] README.md ở gốc repo có hướng dẫn chạy local
- [ ] Tài khoản demo được ghi trong README (không dùng mật khẩu nhạy cảm)
- [ ] Mọi link trong báo cáo còn hoạt động
- [ ] Kiểm tra chính tả, định dạng bảng, số trang
