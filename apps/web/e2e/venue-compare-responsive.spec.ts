import { test, expect } from '@playwright/test';

test.describe('So sánh sân (/venues/compare) & Kiểm tra đa màn hình trên dữ liệu BE thật', () => {
  test('Chọn 2 sân thật từ /venues và đối chiếu song song trên Tablet 768px + Mobile 360px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/venues');

    const compareButtons = page.locator('button[aria-label^="So sánh:"]');
    await expect(compareButtons.nth(1)).toBeVisible({ timeout: 15_000 });

    await compareButtons.nth(0).click();
    await compareButtons.nth(1).click();

    const compareNowLink = page.getByRole('link', { name: /So sánh ngay/i });
    await expect(compareNowLink).toBeVisible({ timeout: 10_000 });
    await compareNowLink.click();

    await page.waitForURL('**/venues/compare');
    await expect(page.getByRole('heading', { name: /So sánh cơ sở thể thao/i })).toBeVisible();
    await expect(page.getByText(/Thông số đối chiếu/i)).toBeVisible();
    await expect(page.getByText(/Giá tốt nhất/i)).toBeVisible();

    // Kiểm tra Mobile 360px không tràn chiều ngang
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/venues');
    await expect(page.getByText(/CLB Cầu Lông & Pickleball Cầu Giấy/i).first()).toBeVisible({
      timeout: 15_000,
    });
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 2,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });
});
