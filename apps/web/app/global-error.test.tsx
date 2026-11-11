// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import GlobalError from './global-error';

describe('Root Global Error Boundary (SPEC-FE-BATCH3-01 / TODO-11)', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('TC-ERR-03: render cấu trúc HTML độc lập, nút Thử lại và Tải lại trang', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const resetMock = vi.fn();
    const reloadMock = vi.fn();

    // Mock window.location.reload
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { reload: reloadMock },
    });

    const fatalError = Object.assign(new Error('Fatal root layout crash'), {
      digest: 'ERR-FATAL-001',
    });

    render(<GlobalError error={fatalError} reset={resetMock} />);

    expect(consoleSpy).toHaveBeenCalledWith('[GlobalError]', fatalError);

    // Tiêu đề lỗi
    expect(screen.getByText('Đã xảy ra sự cố không mong muốn')).toBeDefined();
    expect(screen.getByText(/Mã lỗi: ERR-FATAL-001/i)).toBeDefined();

    // Nút Thử lại
    const retryButton = screen.getByRole('button', { name: 'Thử lại' });
    fireEvent.click(retryButton);
    expect(resetMock).toHaveBeenCalledTimes(1);

    // Nút Tải lại trang
    const reloadButton = screen.getByRole('button', { name: 'Tải lại trang' });
    fireEvent.click(reloadButton);
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });
});
