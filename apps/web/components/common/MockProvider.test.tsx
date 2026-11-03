// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';

import { MockProvider } from './MockProvider';

vi.mock('@/mocks/browser', () => ({
  startMocking: vi.fn().mockResolvedValue(undefined),
}));

describe('MockProvider (TC-MOCK-PROVIDER)', () => {
  const originalEnv = process.env.NEXT_PUBLIC_API_MOCKING;

  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    process.env.NEXT_PUBLIC_API_MOCKING = originalEnv;
  });

  it('TC-MOCK-01: khi mocking bị tắt, render children ngay lập tức và tích hợp SplashBrandReveal', () => {
    process.env.NEXT_PUBLIC_API_MOCKING = 'disabled';

    render(
      <MockProvider>
        <div data-testid="test-child">App Content Ready</div>
      </MockProvider>
    );

    // Children được render ngay
    expect(screen.getByTestId('test-child')).not.toBeNull();
    expect(screen.getByText('App Content Ready')).not.toBeNull();

    // Màn hình loading của mock không hiển thị
    expect(screen.queryByText('Đang chuẩn bị dữ liệu mẫu…')).toBeNull();

    // Splash screen vẫn được tích hợp
    expect(screen.getByTestId('splash-brand-reveal')).not.toBeNull();
  });

  it('TC-MOCK-02: khi mocking được bật, hiển thị trạng thái chờ trong khi MSW khởi động', async () => {
    process.env.NEXT_PUBLIC_API_MOCKING = 'enabled';

    let resolveMocking: () => void;
    const mockingPromise = new Promise<void>((resolve) => {
      resolveMocking = resolve;
    });

    const { startMocking } = await import('@/mocks/browser');
    vi.mocked(startMocking).mockImplementation(() => mockingPromise);

    render(
      <MockProvider>
        <div data-testid="test-child">App Content Ready</div>
      </MockProvider>
    );

    // Chưa ready: hiển thị spinner loading của MockProvider và Splash screen
    expect(screen.getByRole('status')).not.toBeNull();
    expect(screen.getByText('Đang chuẩn bị dữ liệu mẫu…')).not.toBeNull();
    expect(screen.queryByTestId('test-child')).toBeNull();

    // Khi MSW hoàn tất khởi động
    resolveMocking!();

    await waitFor(() => {
      expect(screen.getByTestId('test-child')).not.toBeNull();
    });
    expect(screen.queryByText('Đang chuẩn bị dữ liệu mẫu…')).toBeNull();
  });

  it('TC-MOCK-03: khi MSW khởi động lỗi, log cảnh báo và vẫn chuyển sang ready để không chặn người dùng', async () => {
    process.env.NEXT_PUBLIC_API_MOCKING = 'enabled';
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { startMocking } = await import('@/mocks/browser');
    vi.mocked(startMocking).mockRejectedValueOnce(new Error('MSW SW registration failed'));

    render(
      <MockProvider>
        <div data-testid="test-child">App Content After Error</div>
      </MockProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('test-child')).not.toBeNull();
    });

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'MSW start failed, continuing anyway:',
      expect.any(Error)
    );
    consoleWarnSpy.mockRestore();
  });
});
