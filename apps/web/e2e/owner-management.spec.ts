import { test, expect } from '@playwright/test';
import { loginViaUi } from './helpers/auth';

test.describe('Luồng Chủ sân vận hành thật trên BE + PostgreSQL (OWN-06, OWN-09, OWN-10)', () => {
  test('Chủ sân đăng nhập thật, xem Dashboard và lọc đơn đặt sân thật ở /owner/bookings', async ({
    page,
  }) => {
    await loginViaUi(page, 'owner');

    await page.goto('/owner/dashboard');
    await expect(page).toHaveURL(/.*\/owner\/dashboard/);
    await expect(page.getByRole('navigation', { name: /Kênh chủ sân|Chủ sân/i })).toBeVisible();

    await page.goto('/owner/bookings');
    await expect(page).toHaveURL(/.*\/owner\/bookings/);
    await expect(page.getByRole('heading', { name: /Đơn đặt sân|Quản lý đơn/i })).toBeVisible();
    await expect(
      page.getByText(/Nguyễn Hoàng Long|Vũ Minh Trí/i).locator('visible=true').first(),
    ).toBeVisible({
      timeout: 15_000,
    });
  });

  test('Chủ sân xem & kiểm tra cấu hình ngân hàng + chính sách huỷ sân trên Tablet 768px (/owner/settings)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await loginViaUi(page, 'owner');

    await page.goto('/owner/settings');
    await expect(page).toHaveURL(/.*\/owner\/settings/);
    await expect(page.getByRole('heading', { name: /Cài đặt & Chính sách/i })).toBeVisible();

    // Tài khoản ngân hàng nhận tiền của chủ sân Trần Văn Đức trong seed PostgreSQL
    await expect(page.locator('#accountNo')).toHaveValue(/^(0011004567890|19034567890123)$/, {
      timeout: 15_000,
    });
    await expect(page.locator('#accountName')).toHaveValue('TRAN VAN DUC');
    await expect(page.getByText(/Chính sách huỷ & Đặt cọc/i)).toBeVisible();
  });

  test('Chủ sân thao tác timeline ở màn hình di động 360px với dữ liệu thật (OWN-06, P2)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await loginViaUi(page, 'owner');

    await page.goto('/owner/timeline');
    await expect(page).toHaveURL(/.*\/owner\/timeline/);
    await expect(page.getByRole('heading', { name: /Lịch sân theo ngày/i })).toBeVisible();

    const fitBtn = page.getByRole('button', { name: 'Vừa màn' });
    const stdBtn = page.getByRole('button', { name: 'Chuẩn' });
    await expect(fitBtn).toBeVisible({ timeout: 15_000 });
    await fitBtn.click();
    await stdBtn.click();
  });
});
