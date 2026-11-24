import { test, expect } from '@playwright/test';

test.describe('Luồng khách tìm sân & chọn lịch đặt (GST-01, GST-02, GST-03)', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
    await context.addCookies([
      {
        name: 'bsc_session',
        value: 'guest',
        domain: 'localhost',
        path: '/',
      },
    ]);
  });

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
    const hoursTab = page.getByRole('tab', { name: /Giờ mở|Giờ hoạt động/i });
    if (await hoursTab.isVisible()) {
      await hoursTab.click();
    }

    // Bảng phải hiển thị nhãn "Hôm nay" cho ngày hiện tại
    const todayBadge = page.getByText('Hôm nay');
    await expect(todayBadge).toBeVisible();

    // 5. Kiểm tra lưới slot đặt sân
    const slotGridHeading = page.getByRole('heading', { name: /Chọn giờ chơi|Lịch trống/i });
    await expect(slotGridHeading).toBeVisible();

    // Chuyển sang ngày mai để luôn có slot khả dụng bất kể thời điểm chạy CI trong ngày
    const nextDayBtn = page.getByRole('button', { name: /Hôm sau|Ngày sau/i });
    await expect(nextDayBtn).toBeVisible();
    await nextDayBtn.click();

    // 6. Chờ lưới slot tải xong, chọn một slot khả dụng và kiểm tra nút yêu cầu đăng nhập khi khách chưa có phiên
    const availableSlot = page.locator('button[data-slot-cell]:not([disabled])').first();
    await expect(availableSlot).toBeVisible({ timeout: 15000 });
    await availableSlot.click();

    const loginToContinueBtn = page.getByRole('link', { name: /Đăng nhập để tiếp tục/i });
    await expect(loginToContinueBtn).toBeVisible({ timeout: 15000 });
    await expect(loginToContinueBtn).toHaveAttribute('href', /login\?next=/);
  });

  test('Khách đăng nhập, giữ chỗ sân và tải lên minh chứng chuyển khoản ở màn checkout (CUS-06..CUS-09)', async ({
    page,
    context,
  }) => {
    await context.clearCookies();

    // 1. Đăng nhập với tài khoản khách mẫu
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('khach@example.com');
    await page.locator('input[type="password"]').fill('Password123');
    await page.getByRole('button', { name: /^Đăng nhập$/i }).click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });

    // 2. Mở chi tiết sân & chọn ngày mai để có slot khả dụng
    await page.goto('/venues/san-cau-long-thang-long');
    await expect(page.getByRole('heading', { level: 1, name: /Sân Cầu Lông Thăng Long/i })).toBeVisible();

    const nextDayBtn = page.getByRole('button', { name: /Hôm sau|Ngày sau/i });
    await expect(nextDayBtn).toBeVisible();
    await nextDayBtn.click();

    // 3. Chọn slot trống, mở dialog xác nhận & tạo hold
    const availableSlot = page.locator('button[data-slot-cell]:not([disabled])').first();
    await expect(availableSlot).toBeVisible({ timeout: 15000 });
    await availableSlot.click();

    const continueBtn = page.getByRole('button', { name: /Tiếp tục/i });
    await expect(continueBtn).toBeEnabled({ timeout: 10000 });
    await continueBtn.click();

    const confirmDialog = page.getByRole('dialog');
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole('button', { name: /Xác nhận & Giữ chỗ/i }).click();

    // 4. Chuyển sang màn Checkout & tải lên biên lai chuyển khoản
    await page.waitForURL('**/checkout/**', { timeout: 15000 });
    await expect(page.getByRole('heading', { name: /Thanh toán giữ chỗ/i })).toBeVisible();

    const pngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'bien-lai.png',
      mimeType: 'image/png',
      buffer: Buffer.from(pngBase64, 'base64'),
    });

    const submitProofBtn = page.getByRole('button', { name: /Xác nhận đã chuyển khoản/i });
    await expect(submitProofBtn).toBeEnabled();
    await submitProofBtn.click();

    await expect(page.getByText(/Đơn đặt sân đang chờ chủ sân duyệt/i)).toBeVisible({ timeout: 15000 });
  });
});
