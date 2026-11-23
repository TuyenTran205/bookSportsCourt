# 🚀 Hướng dẫn chạy dự án BookSportsCourt

## ⚡ Khởi động nhanh (Quick Start)

### 1️⃣ Kiểm tra hệ thống
```cmd
check-system.bat
```
Script này sẽ kiểm tra:
- ✅ DATABASE_URL có trong `.env`
- ✅ PostgreSQL đang chạy
- ✅ Migrations đã chạy chưa
- ✅ Dữ liệu seed đã có chưa
- ✅ API server (port 3001) đang chạy
- ✅ Frontend (port 3000) đang chạy

### 2️⃣ Khởi động toàn bộ hệ thống
```cmd
start-dev.bat
```
Script này sẽ:
1. Kiểm tra PostgreSQL
2. Chạy migrations
3. Chạy seed (nếu chưa có dữ liệu)
4. Khởi động API server (port 3001)
5. Khởi động Frontend (port 3000)
6. Mở browser tự động:
   - Frontend: http://localhost:3000
   - Swagger API: http://localhost:3001/api/docs
   - Drizzle Studio: http://localhost:4983

### 3️⃣ Dừng toàn bộ server
```cmd
stop-dev.bat
```

---

## 📋 Lệnh thủ công (Manual Commands)

### Cài đặt dependencies
```cmd
pnpm install
```

### Database
```cmd
# Chạy migrations
pnpm --filter @bsc/api db:migrate

# Seed dữ liệu mẫu
pnpm --filter @bsc/api db:seed

# Mở Drizzle Studio (GUI xem DB)
pnpm --filter @bsc/api db:studio
# → Mở http://localhost:4983
```

### Chạy API server (Backend)
```cmd
pnpm --filter @bsc/api dev
# → API chạy ở http://localhost:3001
# → Swagger docs: http://localhost:3001/api/docs
```

### Chạy Frontend
```cmd
pnpm --filter @bsc/web dev
# → Frontend chạy ở http://localhost:3000
```

### Chạy cả hai cùng lúc
```cmd
pnpm dev
# Chạy cả API và Frontend trong cùng terminal
```

### Test
```cmd
# Test tất cả
pnpm test

# Test riêng API (Node.js test runner)
pnpm --filter @bsc/api test
pnpm --filter @bsc/api test:auth
pnpm --filter @bsc/api test:venues
pnpm --filter @bsc/api test:business-mail
pnpm --filter @bsc/api test:google-oauth
pnpm --filter @bsc/api test:password-recovery

# Test Frontend (Vitest)
pnpm --filter @bsc/web test

# Test Shared (Vitest)
pnpm --filter @bsc/shared test

# E2E tests (cần DB + API + FE đang chạy)
pnpm test:e2e
```

### Lint & Typecheck
```cmd
pnpm lint
pnpm typecheck
```

### Build
```cmd
# Build tất cả
pnpm build

# Build riêng
pnpm --filter @bsc/api build
pnpm --filter @bsc/web build
```

---

## 🔑 Tài khoản test (sau khi chạy `pnpm --filter @bsc/api db:seed`)

Mật khẩu mặc định dùng chung cho toàn bộ tài khoản seed DB (có thể ghi đè qua biến môi trường `SEED_PASSWORD`):
`BookSportsCourt-Dev-Only-2026!`

| Vai trò | Email | Họ tên | Ghi chú kịch bản |
|---------|-------|--------|------------------|
| **Admin** | `admin.demo@booksportscourt.local` | Quản trị viên Demo | Duyệt sân mới, duyệt hồ sơ chủ sân, kiểm duyệt báo cáo đánh giá, thống kê, Audit Logs |
| **Owner 1** | `owner.duc@booksportscourt.local` | Trần Văn Đức | Cụm sân Cầu Giấy (HN), Mỹ Đình (HN - `pending`), Sông Hàn (ĐN); bảng giá 30p, duyệt cọc, phản hồi/báo cáo review |
| **Owner 2** | `owner.thao@booksportscourt.local` | Lê Thu Thảo | Cụm sân Nam Sài Gòn (TP.HCM); đối soát đơn hủy hoàn cọc |
| **Customer 1** | `customer.long@booksportscourt.local` | Nguyễn Hoàng Long | Đặt sân, đơn `completed`/`confirmed`, đánh giá 5 sao, sân yêu thích, liên kết Google OAuth |
| **Customer 2** | `customer.tri@booksportscourt.local` | Vũ Minh Trí | Đơn đang giữ chỗ (`held`) và đơn đã hủy hoàn cọc (`cancelled`) |
| **Applicant** | `applicant.anh@booksportscourt.local` | Đặng Tuấn Anh | Khách hàng đã nộp hồ sơ đăng ký chủ sân đang chờ duyệt (`pending`) |
| *Owner (Legacy)* | `owner.demo@booksportscourt.local` | Chủ sân Demo | Tài khoản tương thích ngược |
| *Customer (Legacy)* | `customer.demo@booksportscourt.local` | Khách hàng Demo | Tài khoản tương thích ngược |

> Chi tiết kịch bản từng tài khoản xem tại `docs/demo-accounts.md`.
> Nếu chạy FE ở chế độ MSW mock (`NEXT_PUBLIC_API_MOCKING=enabled`), dùng các tài khoản mock `admin@example.com`, `owner@example.com`, `khach@example.com` với mật khẩu `Password123` (xem `apps/web/mocks/README.md`).

---

## 🌐 Endpoints quan trọng

- **Frontend**: http://localhost:3000
- **API**: http://localhost:3001
- **Swagger API Docs**: http://localhost:3001/api/docs
- **Drizzle Studio**: http://localhost:4983 (chạy `pnpm --filter @bsc/api db:studio`)
- **Health Check**: http://localhost:3001/api/v1/health

---

## 🐛 Troubleshooting

### ❌ PostgreSQL không kết nối được
```cmd
# Kiểm tra PostgreSQL có chạy không
pg_isready -h localhost -p 5432

# Nếu dùng Docker
docker compose up -d

# Nếu dùng PostgreSQL local service
net start postgresql-x64-XX

# Test kết nối thủ công
psql postgresql://<user>:<password>@localhost:5432/<database> -c "SELECT 1;"
```

### ❌ Port 3001 đã được sử dụng
```cmd
# Xem process nào đang dùng port 3001
netstat -ano | findstr ":3001"

# Kill process (thay PID bằng số process)
taskkill /F /PID <PID>

# Hoặc dùng script
stop-dev.bat
```

### ❌ Migration lỗi
```cmd
# Xem lại schema hiện tại
pnpm --filter @bsc/api db:studio

# Generate lại migration
pnpm --filter @bsc/api db:generate

# Chạy lại migration
pnpm --filter @bsc/api db:migrate
```

### ❌ Seed lỗi
```cmd
# Xoá DB và chạy lại từ đầu (mặc định docker-compose dùng database booksports_dev)
psql postgresql://<user>:<password>@localhost:5432/postgres -c "DROP DATABASE IF EXISTS booksports_dev;"
psql postgresql://<user>:<password>@localhost:5432/postgres -c "CREATE DATABASE booksports_dev;"
pnpm --filter @bsc/api db:migrate
pnpm --filter @bsc/api db:seed
```

---

## 📚 Tài liệu

- **Quy tắc tối thượng**: `AGENTS.md`
- **Tổng quan**: `docs/00-README.md`
- **Danh sách API đã triển khai**: `docs/implemented-apis.md`
- **Tài khoản demo chi tiết**: `docs/demo-accounts.md`
- **Frontend conventions**: `docs/09-frontend-conventions.md`
- **Backend conventions**: `docs/10-backend-conventions.md`
- **API contract**: `docs/11-api-contract.md`
- **Database schema**: `docs/04-database-schema.md`
- **Booking & Realtime**: `docs/05-booking-and-realtime.md`

---

## 🎯 Workflow phát triển

1. Tạo nhánh từ `develop`: `git checkout -b feat/ten-tinh-nang`
2. Làm việc, commit thường xuyên
3. Test: `pnpm test`
4. Tạo PR về `develop` (KHÔNG push trực tiếp vào `develop`)
5. Sau khi review, merge vào `develop`
6. Chi tiết: `docs/14-github-workflow.md`

---

**Lưu ý**: Tất cả lệnh chạy từ thư mục gốc của repository `bookSportsCourt`.
