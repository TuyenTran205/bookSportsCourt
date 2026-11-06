@echo off
chcp 65001 >nul

echo ╔════════════════════════════════════════════════════════════════════╗
echo ║  BookSportsCourt - Dừng tất cả server                             ║
echo ╚════════════════════════════════════════════════════════════════════╝
echo.

:: Tìm và kill process Node.js đang dùng port 3000 và 3001
echo Đang tìm process trên port 3000 (Frontend) và 3001 (API)...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000.*LISTENING"') do (
    echo Đang dừng Frontend (PID %%a)...
    taskkill /F /PID %%a >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001.*LISTENING"') do (
    echo Đang dừng API server (PID %%a)...
    taskkill /F /PID %%a >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4983.*LISTENING"') do (
    echo Đang dừng Drizzle Studio (PID %%a)...
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo ✅ Đã dừng tất cả server.
echo.
pause
