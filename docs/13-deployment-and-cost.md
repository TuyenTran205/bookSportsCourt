# 13 – Deploy & Chi phí

> **Phiên bản:** 1.0.0 | **Cập nhật lần cuối:** 2026-09-30

## Bảng chi phí mục tiêu (Đồ án – ~0đ đến ~800k/học kỳ)

| Dịch vụ | Gói | Giới hạn | Chi phí | Ghi chú |
|---------|-----|---------|---------|---------|
| **Neon** (PostgreSQL) | Free | 0.5 GB storage, 1 project | 0đ | Pause sau 5 ngày không hoạt động → cron ping |
| **Vercel** (FE) | Hobby | 100 GB bandwidth, serverless functions | 0đ | ⚠️ Cấm thương mại; deploy dưới tài khoản sinh viên |
| **Railway/Render** (BE) | Free | 500 MB RAM, 1 GB disk | 0đ | Sleep sau 15 phút; cron ping |
| **Cloudflare R2** | Free | 10 GB/tháng, 10M request | 0đ | Tốt cho ảnh venue |
| **Resend** (Email) | Free | 3,000 email/tháng | 0đ | |
| **Sentry** | Free | 5,000 event/tháng | 0đ | |
| **UptimeRobot** | Free | 50 monitors, 5 phút/lần | 0đ | Dùng ping chống sleep |
| **Domain** (tuỳ chọn) | .id.vn | 1 năm | ~100k | Tuỳ nhu cầu |
| **VPS sinh viên** | Azure/GitHub Education | $100 credit | 0đ | Thay thế Railway nếu có |

**Tổng dự kiến:** 0đ – 100k/học kỳ nếu tận dụng free tier.

## Cảnh báo quan trọng

> ⚠️ **Neon Free:** Tự động pause database sau **5 ngày** không có request. Cần UptimeRobot ping endpoint `/api/v1/health` mỗi 4 ngày.

> ⚠️ **Vercel Hobby:** Theo Terms of Service, **cấm sử dụng thương mại**. Đồ án phi thương mại là được phép. Deploy dưới tài khoản cá nhân sinh viên, không dùng tài khoản công ty.

> ⚠️ **Railway/Render Free:** Service ngủ sau 15 phút không có request. Cấu hình `keep-alive.yml` ping mỗi 10 phút khi cần demo.

## Môi trường

| Env | FE | BE | DB | Mục đích |
|-----|----|----|-----|---------|
| **local** | localhost:3000 | localhost:3001 | Docker PostgreSQL | Phát triển hằng ngày |
| **staging** | Vercel Preview | Railway | Neon (branch riêng) | Test trước merge |
| **demo** | Vercel Production | Railway | Neon (production branch) | Buổi demo/nộp bài |

## Docker Compose cho dev local

```yaml
# docker-compose.yml (chỉ mô tả, tạo file thực khi setup)
version: '3.9'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: booksports_dev
      POSTGRES_USER: bsc_user
      POSTGRES_PASSWORD: bsc_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    # Extensions bắt buộc: btree_gist
    command: >
      postgres -c shared_preload_libraries=''

volumes:
  postgres_data:
```

**Sau khi chạy docker-compose:**
```bash
pnpm --filter @bsc/api db:migrate    # Tạo schema
pnpm --filter @bsc/api db:seed       # Seed dữ liệu mẫu
```

## Backup DB

- **Local:** `pg_dump` hằng tuần, lưu vào thư mục ngoài repo.
- **Neon:** Bật automatic backup trong dashboard (free tier hỗ trợ).
- **Trước demo:** Dump backup thủ công và lưu cục bộ.

## Checklist trước buổi demo

- [ ] Ping health endpoint để đảm bảo Neon không bị pause: `curl https://api.bsc.example/api/v1/health`
- [ ] Seed dữ liệu demo (venue, court, user) vào production DB
- [ ] Kiểm tra Vercel deployment đang live
- [ ] Kiểm tra Socket.IO realtime hoạt động (demo 2 tab)
- [ ] Kiểm tra OAuth Google (nếu đã làm P1)
- [ ] Tắt rate limiting nghiêm ngặt (nếu cần demo liên tiếp nhiều lần)
- [ ] Chuẩn bị tài khoản demo: 1 customer, 1 owner, 1 admin
- [ ] Kiểm tra ảnh venue load đúng từ R2
- [ ] Backup DB trước demo
- [ ] Mở sẵn Swagger UI tại `/api/docs`

## Cron ping chống sleep (keep-alive.yml)

File `.github/workflows/keep-alive.yml` cấu hình ping mỗi 10 phút.  
Mặc định **tắt** (chỉ bật qua `workflow_dispatch` hoặc bật `schedule` khi cần).
