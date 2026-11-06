@echo off
chcp 65001 >nul

echo ╔════════════════════════════════════════════════════════════════════╗
echo ║  BookSportsCourt - Drizzle Studio (Database GUI)                  ║
echo ╚════════════════════════════════════════════════════════════════════╝
echo.

echo Đang khởi động Drizzle Studio...
echo.
echo 📊 Drizzle Studio sẽ mở tại: http://localhost:4983
echo.
echo Bạn có thể:
echo   - Xem tất cả bảng (users, venues, courts, bookings...)
echo   - Thêm/sửa/xoá dữ liệu trực tiếp
echo   - Chạy SQL queries
echo.
echo Nhấn Ctrl+C để dừng Drizzle Studio.
echo.

cd /d %~dp0
pnpm --filter @bsc/api db:studio
