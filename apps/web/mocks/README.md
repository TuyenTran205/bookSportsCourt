# Dữ liệu mẫu (MSW)

Toàn bộ giao diện chạy bằng dữ liệu giả ở đây cho tới khi backend hoàn thành.
Bật/tắt bằng biến `NEXT_PUBLIC_API_MOCKING` trong `.env.local`:

```bash
NEXT_PUBLIC_API_MOCKING=enabled    # chặn request, trả dữ liệu mẫu
NEXT_PUBLIC_API_MOCKING=disabled   # gọi backend thật
```

Sau khi đổi giá trị phải **khởi động lại `pnpm dev`** — biến `NEXT_PUBLIC_*`
được nhúng vào bundle lúc build, không đọc lại lúc chạy.

## Tài khoản demo

Mật khẩu của **mọi** tài khoản là `Password123`.

| Vai trò | Email | Xem được |
|---------|-------|----------|
| Khách đặt sân | `khach@example.com` | Tìm sân, đặt sân, lịch sử, yêu thích |
| Chủ sân | `owner@example.com` | `/dashboard` – timeline, duyệt thanh toán, doanh thu |
| Quản trị viên | `admin@example.com` | `/admin` – duyệt hồ sơ, người dùng, thống kê |

## Cấu trúc

```
mocks/
├── db.ts              # state sống + đồng bộ localStorage giữa các tab
├── browser.ts         # MSW cho trình duyệt
├── server.ts          # MSW cho test
├── utils.ts           # envelope { data, meta }, phân trang, mã lỗi
├── fixtures/          # dữ liệu mẫu
│   ├── catalogs.ts    # tỉnh/quận, môn, tiện ích
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
