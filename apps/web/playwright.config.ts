import { defineConfig, devices } from '@playwright/test';

/**
 * Cấu hình Playwright E2E cho ứng dụng web BookSportsCourt.
 * Tuân thủ tiêu chuẩn BATCH 2 & docs/14-github-workflow.md.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @bsc/api dev',
      url: 'http://127.0.0.1:3001/api/v1/health/ping',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      cwd: '../..',
      env: {
        PORT: process.env.PORT ?? '3001',
        ALLOWED_ORIGINS:
          process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000,http://127.0.0.1:3000',
        AUTH_RATE_LIMIT_MAX: process.env.AUTH_RATE_LIMIT_MAX ?? '200',
        PROOF_STORAGE_DRIVER: process.env.PROOF_STORAGE_DRIVER ?? 'local',
      },
    },
    {
      command: 'pnpm dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
        NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:3001',
        NEXT_PUBLIC_API_MOCKING: process.env.NEXT_PUBLIC_API_MOCKING ?? 'disabled',
      },
    },
  ],
});
