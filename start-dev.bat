@echo off
if not defined DATABASE_URL (
    echo Set DATABASE_URL in this terminal before running this helper.
    exit /b 1
)
chcp 65001 >nul
setlocal

echo ╔════════════════════════════════════════════════════════════════════╗
echo ║  BookSportsCourt - Khởi động môi trường DEV                        ║
echo ╚════════════════════════════════════════════════════════════════════╝
echo.

:: Kiểm tra PostgreSQL
echo [1/5] Kiểm tra PostgreSQL...
pg_isready -h localhost -p 5432 >nul 2>&1
if errorlevel 1 (
    echo    ❌ PostgreSQL chưa chạy
    echo    💡 Khởi động PostgreSQL trước:
    echo       - Nếu dùng Docker: docker compose up -d
    echo       - Nếu dùng service: net start postgresql-x64-XX
    pause
    exit /b 1
) else (
    echo    ✅ PostgreSQL đang chạy
)
echo.

:: Chạy migrations
echo [2/5] Chạy migrations...
pnpm --filter @bsc/api db:migrate
if errorlevel 1 (
    echo    ❌ Migration thất bại
    pause
    exit /b 1
) else (
    echo    ✅ Migrations hoàn tất
)
echo.

:: Chạy seed (nếu chưa có dữ liệu)
echo [3/5] Kiểm tra dữ liệu seed...
psql "%DATABASE_URL%" -t -c "SELECT COUNT(*) FROM users;" 2>nul | findstr "^ *[1-9]" >nul
if errorlevel 1 (
    echo    ⚠️  Chưa có dữ liệu, đang seed...
    pnpm --filter @bsc/api db:seed
    if errorlevel 1 (
        echo    ❌ Seed thất bại
        pause
        exit /b 1
    ) else (
        echo    ✅ Seed hoàn tất
    )
) else (
    echo    ✅ Đã có dữ liệu
)
echo.

:: Khởi động API server
echo [4/5] Khởi động API server (port 3001)...
start "BSC API Server" cmd /k "cd /d %~dp0 && pnpm --filter @bsc/api dev"
echo    ✅ API server đang khởi động...
echo.

:: Đợi API server sẵn sàng
echo [5/5] Đợi API server sẵn sàng...
timeout /t 5 /nobreak >nul
:wait_api
curl -s http://localhost:3001/api/v1/health >nul 2>&1
if errorlevel 1 (
    echo    ⏳ Đang đợi API server...
    timeout /t 2 /nobreak >nul
    goto :wait_api
)
echo    ✅ API server đã sẵn sàng
echo.

:: Khởi động Frontend
echo    Khởi động Frontend (port 3000)...
start "BSC Frontend" cmd /k "cd /d %~dp0 && pnpm --filter @bsc/web dev"
echo    ✅ Frontend đang khởi động...
echo.

:: Mở browser
timeout /t 5 /nobreak >nul
echo    Mở browser...
start http://localhost:3000
start http://localhost:3001/api/docs
start http://localhost:4983
echo.

echo ╔════════════════════════════════════════════════════════════════════╗
echo ║  HỆ THỐNG ĐÃ KHỞI ĐỘNG                                            ║
echo ╚════════════════════════════════════════════════════════════════════╝
echo.
echo 🌐 Frontend:        http://localhost:3000
echo 📖 Swagger API:     http://localhost:3001/api/docs
echo 📊 Drizzle Studio:  http://localhost:4983  (chạy: pnpm --filter @bsc/api db:studio)
echo.
echo 🔑 TÀI KHOẢN TEST (sau khi seed):
echo    Admin:    admin@bsc.vn / Admin@123456
echo    Owner:    owner1@bsc.vn / Owner@123456
echo    Customer: customer1@bsc.vn / Customer@123456
echo.
echo Đóng cửa sổ này sẽ KHÔNG tắt server. Tắt từng cửa sổ "BSC API Server" và "BSC Frontend" để dừng.
echo.
pause
