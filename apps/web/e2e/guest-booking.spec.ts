import { test, expect } from '@playwright/test';

test.describe('Luồng khách tìm sân & chọn lịch đặt (GST-01, GST-02, GST-03)', () => {
  test('Khách truy cập trang chủ, xem danh sách sân, mở chi tiết và xem bảng giờ mở cửa', async ({
    page,
  }) => {
    // 1. Mở trang chủ
    await page.goto('/');
    await expect(page).toHaveTitle(/BookSportsCourt/);

    // 2. Chuyển sang trang danh sách sân
    const exploreLink = page.getByRole('link', { name: /Tìm sân|Khám phá|Đặt sân/i }).first();
    if (await exploreLink.isVisible()) {
      await exploreLink.click();
    } else {
      await page.goto('/venues');
    }

    await page.waitForURL('**/venues**');
    await expect(page.locator('main')).toBeVisible();

    // 3. Mở chi tiết sân Cầu Lông Thăng Long
    await page.goto('/venues/san-cau-long-thang-long');
    await expect(page.getByRole('heading', { level: 1, name: /Sân Cầu Lông Thăng Long/i })).toBeVisible();

    // 4. Kiểm tra khối hiển thị bảng giờ mở cửa (TODO-07)
    const openingHoursHeading = page.getByRole('heading', { name: /Giờ hoạt động/i });
    await expect(openingHoursHeading).toBeVisible();

    // Bảng phải hiển thị nhãn "Hôm nay" cho ngày hiện tại
    const todayBadge = page.getByText('Hôm nay');
    await expect(todayBadge).toBeVisible();

    // 5. Kiểm tra lưới slot đặt sân
    const slotGridHeading = page.getByRole('heading', { name: /Chọn giờ chơi|Lịch trống/i });
    await expect(slotGridHeading).toBeVisible();

    // 6. Kiểm tra nút yêu cầu đăng nhập khi khách chưa có phiên
    const loginToContinueBtn = page.getByRole('link', { name: /Đăng nhập để tiếp tục/i });
    await expect(loginToContinueBtn).toBeVisible();
    await expect(loginToContinueBtn).toHaveAttribute('href', /login\?next=/);
  });
});
