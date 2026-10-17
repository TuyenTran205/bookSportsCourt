// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { PageLoader } from '@/components/ui/page-loader';

afterEach(cleanup);

describe('PageLoader', () => {
  it('hiển thị nhãn mặc định', () => {
    render(<PageLoader />);

    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(screen.getByText('Đang tải trang…')).toBeTruthy();
  });

  it('render nhãn và mô tả tuỳ chỉnh', () => {
    render(<PageLoader label="Đang tải lịch đặt sân…" description="Vui lòng chờ trong giây lát." />);

    expect(screen.getByText('Đang tải lịch đặt sân…')).toBeTruthy();
    expect(screen.getByText('Vui lòng chờ trong giây lát.')).toBeTruthy();
  });

  it('không render mô tả khi không truyền', () => {
    const { container } = render(<PageLoader />);
    expect(container.querySelectorAll('p')).toHaveLength(1);
  });

  it('chỉ có một live region duy nhất (spinner bên trong là trang trí)', () => {
    render(<PageLoader />);

    // Nếu Spinner tự tạo role=status, screen-reader sẽ đọc hai lần.
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('chế độ fullscreen chiếm trọn vùng nội dung dưới header', () => {
    render(<PageLoader fullscreen />);
    expect(screen.getByRole('status').classList.contains('min-h-[calc(100vh-4rem)]')).toBe(true);
  });

  it('chế độ mặc định dùng khung gọn giữa trang', () => {
    render(<PageLoader />);
    expect(screen.getByRole('status').classList.contains('min-h-[50vh]')).toBe(true);
  });

  it.each(['md', 'lg', 'xl'] as const)('nhận spinnerSize %s', (size) => {
    const { container } = render(<PageLoader spinnerSize={size} />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('cho phép ghi đè className của khung ngoài', () => {
    render(<PageLoader className="py-0" />);
    expect(screen.getByRole('status').classList.contains('py-0')).toBe(true);
  });
});
