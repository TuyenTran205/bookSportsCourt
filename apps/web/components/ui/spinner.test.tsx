// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { Spinner } from '@/components/ui/spinner';

afterEach(cleanup);

describe('Spinner', () => {
  it('render vòng track + cung xoay với nét bo tròn', () => {
    const { container } = render(<Spinner />);
    const svg = container.querySelector('svg');

    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg?.classList.contains('bsc-spinner')).toBe(true);

    const circle = svg!.querySelector('circle');
    const arc = svg!.querySelector('path');

    expect(circle?.getAttribute('stroke')).toBe('currentColor');
    expect(arc?.getAttribute('stroke-linecap')).toBe('round');
    // Cung chỉ chiếm 1/4 đường tròn (90°) – đúng đặc tả mục 2.
    expect(arc?.getAttribute('d')).toBe('M12 2a10 10 0 0 1 10 10');
  });

  it('mặc định là size md, màu primary', () => {
    const { container } = render(<Spinner />);
    const svg = container.querySelector('svg')!;

    expect(svg.classList.contains('h-6')).toBe(true);
    expect(svg.classList.contains('w-6')).toBe(true);
    expect(svg.classList.contains('text-primary-600')).toBe(true);
  });

  it.each([
    ['xs', 'h-3.5', 'w-3.5'],
    ['sm', 'h-4', 'w-4'],
    ['md', 'h-6', 'w-6'],
    ['lg', 'h-8', 'w-8'],
    ['xl', 'h-11', 'w-11'],
  ] as const)('size %s dùng đúng lớp kích thước', (size, h, w) => {
    const { container } = render(<Spinner size={size} />);
    const svg = container.querySelector('svg')!;

    expect(svg.classList.contains(h)).toBe(true);
    expect(svg.classList.contains(w)).toBe(true);
  });

  it.each([
    ['primary', 'text-primary-600'],
    ['white', 'text-neutral-0'],
    ['neutral', 'text-neutral-400'],
    ['current', 'text-current'],
  ] as const)('variant %s dùng đúng lớp màu', (variant, cls) => {
    const { container } = render(<Spinner variant={variant} />);
    expect(container.querySelector('svg')?.classList.contains(cls)).toBe(true);
  });

  it('có role=status và nhãn mặc định cho screen-reader', () => {
    render(<Spinner />);

    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.getAttribute('aria-label')).toBe('Đang tải dữ liệu');
    expect(screen.getByText('Đang tải dữ liệu').classList.contains('sr-only')).toBe(true);
  });

  it('nhận nhãn tuỳ chỉnh', () => {
    render(<Spinner label="Đang gửi đơn đặt sân" />);
    expect(screen.getByRole('status').getAttribute('aria-label')).toBe('Đang gửi đơn đặt sân');
  });

  it('label rỗng thì trở thành trang trí, không tạo live region trùng lặp', () => {
    const { container } = render(<Spinner label="" />);

    expect(screen.queryByRole('status')).toBeNull();
    expect(container.querySelector('[aria-label]')).toBeNull();
    expect(container.querySelector('.sr-only')).toBeNull();
  });

  it('svg được ẩn khỏi cây trợ năng để không bị đọc hai lần', () => {
    const { container } = render(<Spinner />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('cho phép ghi đè className và truyền props xuống svg', () => {
    const { container } = render(<Spinner className="mr-2" data-testid="ring" />);
    const svg = container.querySelector('svg')!;

    expect(svg.classList.contains('mr-2')).toBe(true);
    expect(svg.getAttribute('data-testid')).toBe('ring');
  });
});
