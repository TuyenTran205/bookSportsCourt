@echo off
if not defined DATABASE_URL (
    echo Set DATABASE_URL in this terminal before running this helper.
    exit /b 1
)
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ╔════════════════════════════════════════════════════════════════════╗
echo ║  BookSportsCourt - Kiểm tra hệ thống                              ║
echo ╚════════════════════════════════════════════════════════════════════╝
echo.

:: 1. Kiểm tra DATABASE_URL
echo [1/6] Kiểm tra DATABASE_URL...
type .env | findstr /C:"DATABASE_URL=" >nul 2>&1
if errorlevel 1 (
    echo    ❌ KHÔNG tìm thấy DATABASE_URL trong .env
    goto :error
) else (
    for /f "tokens=2 delims==" %%a in ('type .env ^| findstr /C:"DATABASE_URL="') do (
        echo    ✅ DATABASE_URL: %%a
    )
)
echo.

:: 2. Test kết nối PostgreSQL
echo [2/6] Test kết nối PostgreSQL...
psql "%DATABASE_URL%" -c "SELECT version();" >nul 2>&1
if errorlevel 1 (
    echo    ❌ Không kết nối được PostgreSQL
    echo    💡 Kiểm tra: PostgreSQL có đang chạy? Thông tin đăng nhập đúng chưa?
    echo    💡 Lệnh test: psql "%DATABASE_URL%" -c "SELECT 1;"
) else (
    echo    ✅ PostgreSQL đang hoạt động
)
echo.

:: 3. Kiểm tra migrations đã chạy chưa
echo [3/6] Kiểm tra migrations...
psql "%DATABASE_URL%" -t -c "SELECT COUNT(*) FROM drizzle.__drizzle_migrations;" 2>nul
if errorlevel 1 (
    echo    ⚠️  Bảng migrations chưa tồn tại
    echo    💡 Chạy: pnpm --filter @bsc/api db:migrate
) else (
    for /f "tokens=*" %%a in ('psql "%DATABASE_URL%" -t -c "SELECT COUNT(*) FROM drizzle.__drizzle_migrations;"') do (
        set COUNT=%%a
    )
    echo    ✅ Đã chạy !COUNT! migrations
)
echo.

:: 4. Kiểm tra có dữ liệu seed chưa
echo [4/6] Kiểm tra dữ liệu seed...
psql "%DATABASE_URL%" -t -c "SELECT COUNT(*) FROM users;" 2>nul
if errorlevel 1 (
    echo    ⚠️  Bảng users chưa tồn tại
) else (
    for /f "tokens=*" %%a in ('psql "%DATABASE_URL%" -t -c "SELECT COUNT(*) FROM users;"') do (
        set USER_COUNT=%%a
    )
    if "!USER_COUNT!"==" 0" (
        echo    ⚠️  Chưa có user nào
        echo    💡 Chạy: pnpm --filter @bsc/api db:seed
    ) else (
        echo    ✅ Có !USER_COUNT! users
    )
)
echo.

:: 5. Kiểm tra API server
echo [5/6] Kiểm tra API server (port 3001)...
netstat -ano | findstr ":3001" | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    echo    ❌ API server CHƯA chạy
    echo    💡 Chạy: pnpm --filter @bsc/api dev
) else (
    echo    ✅ API server đang LISTEN port 3001
    timeout /t 2 /nobreak >nul
    curl -s http://localhost:3001/api/v1/health >nul 2>&1
    if errorlevel 1 (
        echo    ⚠️  Port 3001 LISTEN nhưng health endpoint chưa phản hồi
        echo    💡 Đợi thêm vài giây hoặc check log server
    ) else (
        echo    ✅ Health endpoint OK
    )
)
echo.

:: 6. Kiểm tra Frontend server
echo [6/6] Kiểm tra Frontend server (port 3000)...
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    echo    ⚠️  Frontend CHƯA chạy
    echo    💡 Chạy: pnpm --filter @bsc/web dev
) else (
    echo    ✅ Frontend đang LISTEN port 3000
)
echo.

:: Tổng kết
echo ╔════════════════════════════════════════════════════════════════════╗
echo ║  HƯỚNG DẪN TIẾP THEO                                               ║
echo ╚════════════════════════════════════════════════════════════════════╝
echo.
echo 📊 XEM DATABASE (Drizzle Studio):
echo    pnpm --filter @bsc/api db:studio
echo    → Mở http://localhost:4983
echo.
echo 📖 XEM SWAGGER API DOCS:
echo    → Mở http://localhost:3001/api/docs
echo.
echo 🌐 XEM FRONTEND:
echo    → Mở http://localhost:3000
echo.
echo 🧪 CHẠY TEST:
echo    pnpm --filter @bsc/api test:auth
echo    pnpm --filter @bsc/api test:group1
echo.
pause
exit /b 0

:error
echo.
echo ❌ Có lỗi xảy ra. Kiểm tra lại cấu hình.
pause
exit /b 1
