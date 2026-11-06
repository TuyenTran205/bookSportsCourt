// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import AdminError from './error';

describe('Admin Portal Error Boundary (SPEC-FE-BATCH3-01 / TODO-11)', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('render thông báo sự cố phân hệ quản trị, nút Thử lại và link về admin dashboard', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const resetMock = vi.fn();
    const testError = Object.assign(new Error('Lỗi truy vấn cơ sở dữ liệu quản trị'), {
      digest: 'ADM-503',
    });

    render(<AdminError error={testError} reset={resetMock} />);

    expect(consoleSpy).toHaveBeenCalledWith('[AdminError]', testError);

    expect(screen.getByText('Sự cố phân hệ quản trị')).toBeDefined();
    expect(screen.getByText('Lỗi truy vấn cơ sở dữ liệu quản trị')).toBeDefined();
    expect(screen.getByText(/Mã lỗi: ADM-503/i)).toBeDefined();

    const retryButton = screen.getByRole('button', { name: /thử lại/i });
    fireEvent.click(retryButton);
    expect(resetMock).toHaveBeenCalledTimes(1);

    const dashboardLink = screen.getByRole('link', { name: /về tổng quan quản trị/i });
    expect(dashboardLink.getAttribute('href')).toBe('/admin/dashboard');
  });
});
