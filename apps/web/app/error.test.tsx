// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import ErrorBoundary from './error';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      retry: 'Thử lại',
      error: 'Đã có lỗi xảy ra',
    };
    return translations[key] ?? key;
  },
}));

describe('App Router Error Boundary (SPEC-FE-BATCH3-01 / TODO-11)', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('TC-ERR-01: render giao diện lỗi với ErrorState, nút Thử lại và link Về trang chủ', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const resetMock = vi.fn();
    const testError = new Error('Sự cố kết nối API mạng');

    render(<ErrorBoundary error={testError} reset={resetMock} />);

    expect(consoleSpy).toHaveBeenCalledWith('[AppError]', testError);

    // Kiểm tra thông điệp lỗi
    expect(screen.getByText('Sự cố kết nối API mạng')).toBeDefined();

    // Kiểm tra nút Thử lại
    const retryButton = screen.getByRole('button', { name: /thử lại/i });
    expect(retryButton).toBeDefined();

    fireEvent.click(retryButton);
    expect(resetMock).toHaveBeenCalledTimes(1);

    // Kiểm tra liên kết về trang chủ
    const homeLink = screen.getByRole('link', { name: /về trang chủ/i });
    expect(homeLink.getAttribute('href')).toBe('/');
  });
});
