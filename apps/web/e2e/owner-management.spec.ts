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

  test('Chủ sân kiểm tra trang duyệt thanh toán và mở hộp thoại đối soát biên lai (OWN-10, PAY-02)', async ({
    page,
  }) => {
    await page.goto('/owner/payments');
    await expect(page).toHaveURL(/.*\/owner\/payments/);
    await expect(page.getByRole('heading', { name: /Duyệt thanh toán/i })).toBeVisible();

    const pendingFilterBtn = page.getByRole('button', { name: /Chờ duyệt/i }).first();
    if (await pendingFilterBtn.isVisible()) {
      await pendingFilterBtn.click();
    }

    const viewProofBtn = page.locator('table button:has-text("Xem"), button:has-text("Xem biên lai")').first();
    if (await viewProofBtn.isVisible()) {
      await viewProofBtn.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('button', { name: /Duyệt/i })).toBeVisible();
      await dialog.getByRole('button', { name: /Đóng/i }).click();
      await expect(dialog).not.toBeVisible();
    }
  });

  test('Chủ sân sử dụng timeline ở màn hình di động 360px với cụm nút thu phóng (OWN-06, P2)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/owner/timeline');
    await expect(page).toHaveURL(/.*\/owner\/timeline/);
    await expect(page.getByRole('heading', { name: /Lịch sân theo ngày/i })).toBeVisible();

    const fitBtn = page.getByRole('button', { name: 'Vừa màn' });
    const stdBtn = page.getByRole('button', { name: 'Chuẩn' });
    await expect(fitBtn).toBeVisible({ timeout: 15000 });
    await fitBtn.click();
    await stdBtn.click();
  });
});
