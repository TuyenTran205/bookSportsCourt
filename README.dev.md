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

# Test riêng API
pnpm --filter @bsc/api test:auth
pnpm --filter @bsc/api test:group1

# Test Frontend
pnpm --filter @bsc/web test

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

## 🔑 Tài khoản test (sau khi seed)

| Role     | Email              | Password       |
|----------|-------------------|----------------|
| Admin    | admin@bsc.vn      | Admin@123456   |
| Owner    | owner1@bsc.vn     | Owner@123456   |
| Customer | customer1@bsc.vn  | Customer@123456|

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
# Xoá DB và chạy lại từ đầu
psql postgresql://<user>:<password>@localhost:5432/<database> -c "DROP DATABASE IF EXISTS booksportscourt;"
psql postgresql://<user>:<password>@localhost:5432/<database> -c "CREATE DATABASE booksportscourt;"
pnpm --filter @bsc/api db:migrate
pnpm --filter @bsc/api db:seed
```

---

## 📚 Tài liệu

- **Quy tắc tối thượng**: `AGENTS.md`
- **Tổng quan**: `docs/00-README.md`
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

**Lưu ý**: Tất cả lệnh chạy từ thư mục gốc `d:\BTL_Chuyende\bookSportsCourt\`
