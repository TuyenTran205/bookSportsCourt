import { test, expect } from '@playwright/test';

test.describe('Luồng Chủ sân quản lý vận hành & đơn đặt (OWN-06, OWN-09)', () => {
  test.beforeEach(async ({ context }) => {
    // Thiết lập cookie xác thực phiên chủ sân
    await context.addCookies([
      {
        name: 'bsc_session',
        value: '019273c5-7f12-7000-8000-000000000001',
        domain: 'localhost',
        path: '/',
      },
      {
        name: 'bsc_role',
        value: 'owner',
        domain: 'localhost',
        path: '/',
      },
    ]);
  });

  test('Chủ sân truy cập Dashboard và quản lý danh sách đơn đặt sân', async ({ page }) => {
    // 1. Truy cập trang Dashboard chủ sân
    await page.goto('/owner/dashboard');
    await expect(page).toHaveURL(/.*\/owner\/dashboard/);

    // Kiểm tra render thanh điều hướng bên cạnh (DashboardShell)
    const ownerNav = page.getByRole('navigation', { name: /Kênh chủ sân|Chủ sân/i });
    await expect(ownerNav).toBeVisible();

    // 2. Chuyển sang trang Quản lý đơn đặt sân
    await page.goto('/owner/bookings');
    await expect(page).toHaveURL(/.*\/owner\/bookings/);

    // 3. Kiểm tra tiêu đề và bảng danh sách đơn đặt sân
    const bookingsHeading = page.getByRole('heading', { name: /Đơn đặt sân|Quản lý đơn/i });
    await expect(bookingsHeading).toBeVisible();

    // Kiểm tra sự xuất hiện của các nút hoặc bộ lọc trạng thái
    const statusFilter = page.locator('select, [role="tablist"]').first();
    await expect(statusFilter).toBeVisible();
  });
});
