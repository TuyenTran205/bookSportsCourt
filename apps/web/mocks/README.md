# Dữ liệu mẫu (MSW)

Thư mục này cung cấp tầng giả lập API bằng MSW (Mock Service Worker) phục vụ unit/component test FE và chạy độc lập giao diện khi không bật Backend thật (`http://localhost:3001`).
Bật/tắt bằng biến `NEXT_PUBLIC_API_MOCKING` trong `.env.local`:

```bash
NEXT_PUBLIC_API_MOCKING=enabled    # chặn request bằng MSW, trả dữ liệu mẫu từ localStorage
NEXT_PUBLIC_API_MOCKING=disabled   # gọi backend NestJS thật (mặc định khi chạy full-stack)
```

Sau khi đổi giá trị phải **khởi động lại `pnpm dev`** — biến `NEXT_PUBLIC_*`
được nhúng vào bundle lúc build, không đọc lại lúc chạy.

## Tài khoản demo (chế độ MSW mock)

> **Lưu ý:** Bảng dưới đây chỉ áp dụng khi `NEXT_PUBLIC_API_MOCKING=enabled`. Khi chạy với Backend PostgreSQL thật (`NEXT_PUBLIC_API_MOCKING=disabled`), hãy dùng danh sách tài khoản seed trong `docs/demo-accounts.md` (mật khẩu `BookSportsCourt-Dev-Only-2026!`).

Mật khẩu của **mọi** tài khoản MSW mock là `Password123`.

| Vai trò | Email | Xem được |
|---------|-------|----------|
| Khách đặt sân | `khach@example.com` | Tìm sân, đặt sân, lịch sử, yêu thích |
| Chủ sân | `owner@example.com` | `/owner/dashboard` – timeline, duyệt thanh toán, doanh thu, đánh giá |
| Quản trị viên | `admin@example.com` | `/admin/dashboard` – duyệt hồ sơ, duyệt cơ sở, người dùng, kiểm duyệt đánh giá, thống kê |

## Cấu trúc

```
mocks/
├── db.ts              # state sống + đồng bộ localStorage giữa các tab
├── browser.ts         # MSW cho trình duyệt
├── server.ts          # MSW cho test
├── utils.ts           # envelope { data, meta }, phân trang, mã lỗi
├── fixtures/          # dữ liệu mẫu
│   ├── catalogs.ts    # tỉnh/thành, xã/phường (ĐVHC 2 cấp + legacy quận), môn, tiện ích
│   ├── users.ts       # người dùng, hồ sơ chủ sân
│   ├── venues.ts      # cơ sở, sân con, giờ mở cửa, bảng giá, khoá sân
│   ├── bookings.ts    # booking phủ đủ 7 trạng thái + thanh toán
│   └── slots.ts       # sinh lưới slot từ giờ mở cửa + giá + booking
└── handlers/          # handler theo module, khớp docs/11-api-contract.md
```

## Dữ liệu có "sống"

State nằm trong `localStorage` nên **hai tab dùng chung một nguồn**. Đây là điều
kiện để demo Kịch bản B (race condition): mở hai tab, cùng giữ một khung giờ —
tab thứ hai nhận **409 `SLOT_TAKEN`**.

Các thao tác có hiệu lực thật trong phiên:

- Giữ chỗ → booking `held`, đếm ngược 10 phút, slot chuyển vàng.
- Gửi biên lai → `pending_payment`, slot giữ nguyên.
- Chủ sân duyệt → `confirmed`; từ chối → `cancelled` và **slot trả về trống**.
- Hết 10 phút không thanh toán → `expired`, slot tự trả về trống.
- Đặt lại dữ liệu: `POST /api/v1/admin/reset-mock`, hoặc xoá khoá
  `bsc-mock-db-v1` trong localStorage.

## Điểm cần lưu ý khi nối backend thật

- Handler trả đúng envelope `{ data, meta }`; `apiFetch` bóc sẵn `data` nên
  component **không** phải sửa khi tắt mock.
- Mã lỗi tranh chấp slot: tài liệu đang mâu thuẫn giữa `SLOT_TAKEN` và
  `BOOKING_CONFLICT`. Mock trả `SLOT_TAKEN` (theo bản mới nhất), FE bắt cả hai
  qua `SLOT_CONFLICT_CODES` trong `@bsc/shared`.
- Ảnh biên lai là URL `picsum.photos`, không phải file thật.
