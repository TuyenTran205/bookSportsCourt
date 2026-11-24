import { test, expect } from '@playwright/test';
import { loginViaUi } from './helpers/auth';

test.describe('Luồng Quản trị viên kiểm duyệt thật trên BE + PostgreSQL (ADM-04, ADM-08, ADM-10, ADM-11)', () => {
  test('Admin xem & kiểm duyệt đánh giá thật ở /admin/reviews', async ({ page }) => {
    await loginViaUi(page, 'admin');

    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/.*\/admin\/dashboard/);

    const reviewsNavLink = page.getByRole('link', { name: /Quản lý đánh giá|Đánh giá/i });
    await expect(reviewsNavLink).toBeVisible();
    await reviewsNavLink.click();

    await page.waitForURL('**/admin/reviews');
    await expect(page.getByRole('heading', { name: /Kiểm duyệt đánh giá/i })).toBeVisible();
    await expect(
      page.getByText(/Mặt thảm Yonex cực êm/i).locator('visible=true').first(),
    ).toBeVisible({
      timeout: 15_000,
    });

    const actionBtn = page.getByRole('button', { name: /Ẩn đánh giá|Hiện đánh giá/i }).first();
    await expect(actionBtn).toBeVisible();
    await actionBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /Huỷ/i }).click();
    await expect(dialog).not.toBeVisible();
  });

  test('Admin mở pop-up KPI thật trên Dashboard, xem danh mục IconPicker và Nhật ký hoạt động (/admin/audit-logs)', async ({
    page,
  }) => {
    await loginViaUi(page, 'admin');

    // 1. Dashboard KPI Popup với số liệu PostgreSQL thật
    await page.goto('/admin/dashboard');
    const usersDetailBtn = page.getByRole('button', { name: 'Xem cơ cấu người dùng' });
    await expect(usersDetailBtn).toBeVisible({ timeout: 15_000 });
    await usersDetailBtn.click();
    const usersDialog = page.getByRole('dialog');
    await expect(usersDialog).toBeVisible();
    await usersDialog.getByRole('button', { name: /Đóng/i }).first().click();
    await expect(usersDialog).not.toBeVisible();

    // 2. Danh mục môn thể thao thật + IconPicker hiển thị "Đã có"
    await page.goto('/admin/catalogs');
    await page.getByRole('button', { name: /Thêm môn thể thao/i }).click();
    const catalogDialog = page.getByRole('dialog');
    await expect(catalogDialog).toBeVisible();
    await expect(catalogDialog.getByText('Đã có').first()).toBeVisible();
    await catalogDialog.getByRole('button', { name: /Huỷ|Hủy/i }).click();

    // 3. Nhật ký hoạt động /admin/audit-logs thật
    await page.goto('/admin/audit-logs');
    await expect(page.getByRole('heading', { name: /Nhật ký hoạt động/i })).toBeVisible();
    await expect(
      page.getByText(/Phê duyệt|Cơ sở thể thao/i).locator('visible=true').first(),
    ).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole('button', { name: 'Cơ sở thể thao' }).click();
    await expect(page.getByText(/Phê duyệt/i).locator('visible=true').first()).toBeVisible();
  });
});
