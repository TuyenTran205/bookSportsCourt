// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import OwnerError from './error';

describe('Owner Portal Error Boundary (SPEC-FE-BATCH3-01 / TODO-11)', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('TC-ERR-02: render thông báo lỗi kênh chủ sân, nút Thử lại và link về dashboard', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const resetMock = vi.fn();
    const testError = Object.assign(new Error('Lỗi tải danh sách sân chủ quản'), {
      digest: 'OWN-500',
    });

    render(<OwnerError error={testError} reset={resetMock} />);

    expect(consoleSpy).toHaveBeenCalledWith('[OwnerError]', testError);

    // Tiêu đề và nội dung lỗi
    expect(screen.getByText('Không thể tải dữ liệu kênh chủ sân')).toBeDefined();
    expect(screen.getByText('Lỗi tải danh sách sân chủ quản')).toBeDefined();
    expect(screen.getByText(/Mã lỗi: OWN-500/i)).toBeDefined();

    // Nút Thử lại
    const retryButton = screen.getByRole('button', { name: /thử lại/i });
    fireEvent.click(retryButton);
    expect(resetMock).toHaveBeenCalledTimes(1);

    // Link về tổng quan chủ sân
    const dashboardLink = screen.getByRole('link', { name: /về tổng quan chủ sân/i });
    expect(dashboardLink.getAttribute('href')).toBe('/owner/dashboard');
  });
});
