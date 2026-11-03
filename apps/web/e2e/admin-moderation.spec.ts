import { test, expect } from '@playwright/test';

test.describe('Luồng Quản trị viên kiểm duyệt đánh giá (ADM-10)', () => {
  test.beforeEach(async ({ context }) => {
    // Thiết lập cookie xác thực phiên quản trị viên
    await context.addCookies([
      {
        name: 'bsc_session',
        value: '019273c5-7f12-7000-8000-000000000007',
        domain: 'localhost',
        path: '/',
      },
      {
        name: 'bsc_role',
        value: 'admin',
        domain: 'localhost',
        path: '/',
      },
    ]);
  });

  test('Admin truy cập trang kiểm duyệt đánh giá và thao tác mở dialog xác nhận', async ({
    page,
  }) => {
    // 1. Truy cập Dashboard quản trị
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/.*\/admin\/dashboard/);

    // 2. Kiểm tra link menu Đánh giá và truy cập /admin/reviews
    const reviewsNavLink = page.getByRole('link', { name: /Quản lý đánh giá|Đánh giá/i });
    await expect(reviewsNavLink).toBeVisible();
    await reviewsNavLink.click();

    await page.waitForURL('**/admin/reviews');
    await expect(page.getByRole('heading', { name: /Kiểm duyệt đánh giá/i })).toBeVisible();

    // 3. Kiểm tra các bộ lọc có mặt trên giao diện
    const searchInput = page.getByPlaceholder(/Tìm theo nội dung, tên khách/i);
    await expect(searchInput).toBeVisible();

    // 4. Kiểm tra nút thao tác Ẩn/Hiện đánh giá và Dialog xác nhận
    const actionBtn = page.getByRole('button', { name: /Ẩn đánh giá|Hiện đánh giá/i }).first();
    if (await actionBtn.isVisible()) {
      await actionBtn.click();

      // Kiểm tra dialog Radix UI xuất hiện
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      // Kiểm tra có nút Hủy
      const cancelBtn = dialog.getByRole('button', { name: /Huỷ/i });
      await expect(cancelBtn).toBeVisible();
      await cancelBtn.click();

      // Dialog phải đóng lại sau khi bấm Hủy
      await expect(dialog).not.toBeVisible();
    }
  });
});
