import { test, expect } from '@playwright/test';
import { loginViaUi } from './helpers/auth';

const SEEDED_VENUE_SLUG = 'clb-cau-long-pickleball-cau-giay';
const VALID_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

test.describe('Luồng khách & đặt sân thật qua BE + PostgreSQL + Realtime (GST-01..CUS-09, PAY-02)', () => {
  test('Khách xem danh sách sân thật, mở chi tiết, xem giờ mở cửa và thấy CTA đăng nhập khi chọn slot (GST-01..03)', async ({
    page,
    context,
  }) => {
    await context.clearCookies();

    // 1. Trang chủ -> Khám phá danh sách sân từ PostgreSQL
    await page.goto('/');
    await expect(page).toHaveTitle(/BookSportsCourt/);

    await page.goto('/venues');
    await expect(page.getByText(/CLB Cầu Lông & Pickleball Cầu Giấy/i).first()).toBeVisible({
      timeout: 15_000,
    });

    // 2. Chi tiết sân thật & bảng giờ mở cửa
    await page.goto(`/venues/${SEEDED_VENUE_SLUG}`);
    await expect(
      page.getByRole('heading', { level: 1, name: /CLB Cầu Lông & Pickleball Cầu Giấy/i }),
    ).toBeVisible();

    const hoursTab = page.getByRole('tab', { name: /Giờ mở|Giờ hoạt động/i });
    if (await hoursTab.isVisible()) {
      await hoursTab.click();
    }
    await expect(page.getByText('Hôm nay')).toBeVisible();

    // 3. Chuyển sang ngày mai để chọn slot trống
    const nextDayBtn = page.getByRole('button', { name: /Hôm sau|Ngày sau/i });
    await expect(nextDayBtn).toBeVisible();
    await nextDayBtn.click();

    const availableSlot = page.locator('button[data-slot-cell]:not([disabled])').first();
    await expect(availableSlot).toBeVisible({ timeout: 15_000 });
    await availableSlot.click();

    const loginToContinueBtn = page.getByRole('link', { name: /Đăng nhập để tiếp tục/i });
    await expect(loginToContinueBtn).toBeVisible({ timeout: 15_000 });
    await expect(loginToContinueBtn).toHaveAttribute('href', /login\?next=/);
  });

  test('End-to-End thật: Socket.IO đa tab đồng bộ giữ chỗ + Upload biên lai PNG + Chủ sân duyệt thanh toán', async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    // 1. Tab A (Khách xem cùng sân & ngày) lắng nghe Socket.IO room `venue:<id>:date:<date>`
    const viewerContext = await browser.newContext();
    const viewerPage = await viewerContext.newPage();
    await viewerPage.goto(`/venues/${SEEDED_VENUE_SLUG}`);
    await expect(
      viewerPage.getByRole('heading', { level: 1, name: /CLB Cầu Lông & Pickleball Cầu Giấy/i }),
    ).toBeVisible({ timeout: 15_000 });

    const viewerNextDay = viewerPage.getByRole('button', { name: /Hôm sau|Ngày sau/i });
    await viewerNextDay.click();
    await expect(viewerPage.locator('button[data-slot-cell]:not([disabled])').first()).toBeVisible({
      timeout: 15_000,
    });

    // Chờ Socket.IO client join_venue hoàn tất trước khi Tab B thao tác giữ chỗ
    await viewerPage.waitForTimeout(1000);

    // 2. Tab B (Khách hàng thật đăng nhập, giữ chỗ và tải lên biên lai thật qua multipart/form-data)
    const customerContext = await browser.newContext();
    const customerPage = await customerContext.newPage();
    await loginViaUi(customerPage, 'customer');

    await customerPage.goto(`/venues/${SEEDED_VENUE_SLUG}`);
    await customerPage.getByRole('button', { name: /Hôm sau|Ngày sau/i }).click();

    const targetSlot = customerPage.locator('button[data-slot-cell]:not([disabled])').first();
    await expect(targetSlot).toBeVisible({ timeout: 15_000 });
    const slotIndex = await targetSlot.getAttribute('data-slot-index');
    expect(slotIndex).not.toBeNull();
    const slotLabelPrefix = (await targetSlot.getAttribute('aria-label'))?.slice(0, 5) ?? '';

    await targetSlot.click();
    await customerPage.getByRole('button', { name: /Tiếp tục/i }).click();

    const confirmDialog = customerPage.getByRole('dialog');
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole('button', { name: /Xác nhận & Giữ chỗ/i }).click();

    await customerPage.waitForURL('**/checkout/**', { timeout: 20_000 });
    await expect(
      customerPage.getByRole('heading', { name: /Thanh toán giữ chỗ/i }),
    ).toBeVisible();

    // 3. Kiểm tra Socket.IO đa tab thật: Tab A (không reload) phải thấy đúng ô vừa giữ bị khoá
    const watchedSlotOnViewer = viewerPage.locator(
      `button[data-slot-cell][data-slot-index="${slotIndex}"]`,
    );
    await expect(watchedSlotOnViewer).toBeDisabled({ timeout: 15_000 });

    // 4. Tab B upload biên lai PNG thật (qua Sharp + ProofStorage)
    const fileInput = customerPage.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'bien-lai-that.png',
      mimeType: 'image/png',
      buffer: Buffer.from(VALID_PNG_BASE64, 'base64'),
    });
    const submitProofBtn = customerPage.getByRole('button', { name: /Xác nhận đã chuyển khoản/i });
    await expect(submitProofBtn).toBeEnabled();
    await submitProofBtn.click();

    await expect(customerPage.getByText(/Đơn đặt sân đang chờ chủ sân duyệt/i)).toBeVisible({
      timeout: 20_000,
    });

    // 5. Tab C (Chủ sân thật đăng nhập -> /owner/payments -> xem ảnh biên lai thật & Duyệt)
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await loginViaUi(ownerPage, 'owner');
    await ownerPage.goto('/owner/payments');
    await expect(ownerPage).toHaveURL(/.*\/owner\/payments/);

    await ownerPage.locator('#payment-status').selectOption('submitted');

    const viewProofBtn = ownerPage
      .locator('table button:has-text("Xem"), button:has-text("Xem biên lai")')
      .locator('visible=true')
      .first();
    await expect(viewProofBtn).toBeVisible({ timeout: 15_000 });
    await viewProofBtn.click();

    const reviewDialog = ownerPage.getByRole('dialog');
    await expect(reviewDialog).toBeVisible();
    if (slotLabelPrefix) {
      await expect(reviewDialog.getByText(/CLB Cầu Lông & Pickleball Cầu Giấy/i)).toBeVisible();
    }

    // Xác nhận ảnh biên lai load thật (naturalWidth > 0)
    const proofImg = reviewDialog.locator('img').first();
    await expect(proofImg).toBeVisible({ timeout: 10_000 });
    await expect
      .poll(async () => proofImg.evaluate((el: HTMLImageElement) => el.naturalWidth), {
        timeout: 10_000,
      })
      .toBeGreaterThan(0);

    await reviewDialog.getByRole('button', { name: /^Duyệt$/i }).click();
    await expect(ownerPage.getByText(/Đã duyệt thanh toán thành công/i)).toBeVisible({
      timeout: 15_000,
    });

    await viewerContext.close();
    await customerContext.close();
    await ownerContext.close();
  });
});
