# 13 – Deploy & Chi phí

> **Phiên bản:** 1.1.0 | **Cập nhật lần cuối:** 2026-10-12

## Bảng chi phí mục tiêu (Đồ án – ~0đ đến ~800k/học kỳ)

| Dịch vụ | Gói | Giới hạn | Chi phí | Ghi chú |
|---------|-----|---------|---------|---------|
| **Neon** (PostgreSQL) | Free | 0.5 GB storage, 1 project | 0đ | Pause sau 5 ngày không hoạt động → cron ping |
| **Vercel** (FE) | Hobby | 100 GB bandwidth, serverless functions | 0đ | ⚠️ Cấm thương mại; deploy dưới tài khoản sinh viên |
| **Railway/Render** (BE) | Free | 500 MB RAM, 1 GB disk | 0đ | Sleep sau 15 phút; cron ping |
| **Cloudflare R2** | Free | 10 GB/tháng, 10M request | 0đ | Lưu ảnh venue và ảnh xác nhận chuyển khoản (presigned URL) |
| **Resend** (Email) | Free | 3,000 email/tháng | 0đ | |
| **Sentry** | Free | 5,000 event/tháng | 0đ | |
| **UptimeRobot** | Free | 50 monitors, ping mỗi **5 phút** | 0đ | Dùng ping chống sleep; tần suất tối thiểu của free tier là 5 phút |
| **Domain** (tuỳ chọn) | .id.vn | 1 năm | ~100k | Tuỳ nhu cầu |
| **VPS sinh viên** | Azure/GitHub Education | $100 credit | 0đ | Thay thế Railway nếu có |

**Tổng dự kiến:** 0đ nếu không mua domain; tối đa **~100k/học kỳ** nếu mua domain `.id.vn`. Phần chênh tới mốc ~800k ở tiêu đề chỉ phát sinh khi trả phí cho Railway/Render hoặc Neon ở gói trả tiền — các gói đó **không** mặc định trong đồ án.

## Cảnh báo quan trọng

> ⚠️ **Neon Free:** Tự động pause database sau **5 ngày** không có request. Neon dùng chung cơ chế với UptimeRobot: ping endpoint `/api/v1/health` định kỳ. Không cần ping mỗi 4 ngày — ping thưa như vậy vẫn để DB pause giữa các lần ping; dùng tần suất 5 phút của UptimeRobot (hoặc `keep-alive.yml`) là đủ và miễn phí.

> ⚠️ **Vercel Hobby:** Theo Terms of Service, **cấm sử dụng thương mại**. Đồ án phi thương mại là được phép. Deploy dưới tài khoản cá nhân sinh viên, không dùng tài khoản công ty.

> ⚠️ **Railway/Render Free:** Service ngủ sau 15 phút không có request. **Trong lúc phát triển, `keep-alive.yml` mặc định TẮT** (không đốt runner-hours vô ích). **Chỉ bật khi cần demo liên tục:** mở comment `schedule: "*/10 * * * *"` trong `.github/workflows/keep-alive.yml`, hoặc chạy tay qua `workflow_dispatch` với `duration_minutes`. Hai cách này không mâu thuẫn: mặc định tắt, bật có chủ đích trong tuần demo.

## Môi trường

| Env | FE | BE | DB | Mục đích |
|-----|----|----|-----|---------|
| **local** | localhost:3000 | localhost:3001 | Docker PostgreSQL | Phát triển hằng ngày |
| **staging** | Vercel Preview | Railway | Neon (branch riêng) | Test trước merge |
| **demo** | Vercel Production | Railway | Neon (production branch) | Buổi demo/nộp bài |

## Docker Compose cho dev local

```yaml
# docker-compose.yml (chỉ mô tả, tạo file thực khi setup)
# Lưu ý: từ Compose v2 không cần khai báo `version:` (đã lỗi thời và gây cảnh báo).
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
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U bsc_user -d booksports_dev"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

> **Về `btree_gist`:** đây là **contrib extension** đi kèm image `postgres:16-alpine`, **không** phải shared library cần preload. Vì vậy **không** dùng `shared_preload_libraries`, cũng **không** cần `command:` ghi đè. Extension được bật bằng migration:
> ```sql
> CREATE EXTENSION IF NOT EXISTS btree_gist;
> ```
> `btree_gist` là bắt buộc để dùng `EXCLUDE USING gist` cho ràng buộc chống trùng lịch (xem `docs/04-database-schema.md` và `docs/05-booking-and-realtime.md`).

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

- [ ] Ping health endpoint để đảm bảo Neon không bị pause: `curl "$API_HEALTH_URL"` (giá trị thật lấy từ repo variable `API_HEALTH_URL`, xem `.github/workflows/keep-alive.yml`)
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

File `.github/workflows/keep-alive.yml` **mặc định tắt**; chỉ bật khi cần demo liên tục, bằng một trong hai cách:
- Mở comment `schedule: "*/10 * * * *"` trong file, hoặc
- Chạy tay qua `workflow_dispatch` và truyền `duration_minutes`.

Workflow **không** hard-code domain. Nó đọc hai repo variable (Settings → Secrets and variables → Actions → Variables):

| Variable | Ý nghĩa | Ví dụ giá trị thật |
|----------|---------|--------------------|
| `API_HEALTH_URL` | URL health check của BE | `https://<be-domain>/api/v1/health` |
| `FE_URL` | URL gốc của FE | `https://<fe-domain>` |

> **Quy ước placeholder:** trong toàn bộ repo, chỗ nào cần minh hoạ URL mà chưa biết domain thật thì dùng dạng `<be-domain>` / `<fe-domain>`, **không** bịa domain giả kiểu `api.bsc.example` hay `placeholder.example.com` — ba file từng dùng ba domain giả khác nhau, gây nhầm lẫn và dễ bị copy nhầm vào cấu hình thật. Trong CI, `NEXT_PUBLIC_API_URL` dùng `http://localhost:3001` cho khớp bảng môi trường bên trên.
>
> Thiếu variable → workflow **fail ngay** với thông báo rõ, không báo xanh giả. Ping lỗi cũng làm job đỏ, để không im lặng bỏ qua việc service đã sleep.
