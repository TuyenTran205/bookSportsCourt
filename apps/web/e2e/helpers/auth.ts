import { expect, type Page } from '@playwright/test';

export type SeedRole = 'customer' | 'owner' | 'admin';

const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'BookSportsCourt-Dev-Only-2026!';

const SEED_ACCOUNTS: Record<SeedRole, string> = {
  customer: 'customer.demo@booksportscourt.local',
  owner: 'owner.duc@booksportscourt.local',
  admin: 'admin.demo@booksportscourt.local',
};

/**
 * Đăng nhập qua màn hình `/login` thật vào Backend NestJS & PostgreSQL.
 * Nhận cookie phiên `access_token`, `refresh_token`, `bsc_session`, `bsc_role` thật.
 */
export async function loginViaUi(page: Page, role: SeedRole): Promise<void> {
  await page.context().clearCookies();
  await page.goto('/login');

  await page.locator('input[type="email"]').fill(SEED_ACCOUNTS[role]);
  await page.locator('input[type="password"]').fill(SEED_PASSWORD);
  await page.getByRole('button', { name: /^Đăng nhập$/i }).click();

  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20_000 });
  await expect
    .poll(
      async () => {
        const cookies = await page.context().cookies();
        return cookies.some((c) => c.name === 'bsc_session' && c.value.length > 0);
      },
      { timeout: 10_000 },
    )
    .toBe(true);
}
