// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { Pagination } from './pagination';

describe('Pagination Component (TC-PAGIN)', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('TC-PAGIN-01: không render gì khi totalPages <= 1', () => {
    const { container: c0 } = render(
      <Pagination currentPage={1} totalPages={0} onPageChange={vi.fn()} />,
    );
    expect(c0.firstChild).toBeNull();

    const { container: c1 } = render(
      <Pagination currentPage={1} totalPages={1} onPageChange={vi.fn()} />,
    );
    expect(c1.firstChild).toBeNull();
  });

  it('TC-PAGIN-02: render đầy đủ các nút trang khi totalPages = 5', () => {
    render(<Pagination currentPage={3} totalPages={5} onPageChange={vi.fn()} />);

    expect(screen.getByRole('navigation', { name: 'Phân trang' })).not.toBeNull();
    for (let page = 1; page <= 5; page++) {
      expect(screen.getByRole('button', { name: `Trang ${page}` })).not.toBeNull();
    }
  });

  it('TC-PAGIN-03: hiển thị dấu ba chấm khi totalPages = 10 và currentPage = 5', () => {
    const { container } = render(
      <Pagination currentPage={5} totalPages={10} onPageChange={vi.fn()} siblingCount={1} />,
    );

    // Dải trang kỳ vọng: 1, ..., 4, 5, 6, ..., 10
    expect(screen.getByRole('button', { name: 'Trang 1' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Trang 2' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Trang 4' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Trang 5' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Trang 6' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Trang 7' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Trang 10' })).not.toBeNull();

    // 2 vị trí ellipsis (dots-start, dots-end) có aria-hidden="true"
    const ellipsisElements = container.querySelectorAll('span[aria-hidden="true"]');
    expect(ellipsisElements.length).toBeGreaterThanOrEqual(2);
  });

  it('TC-PAGIN-04: nút "Trang trước" bị disabled khi ở trang đầu (currentPage = 1)', () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={1} totalPages={5} onPageChange={onPageChange} />);

    const prevButton = screen.getByRole('button', { name: 'Trang trước' }) as HTMLButtonElement;
    const nextButton = screen.getByRole('button', { name: 'Trang sau' }) as HTMLButtonElement;

    expect(prevButton.disabled).toBe(true);
    expect(nextButton.disabled).toBe(false);

    fireEvent.click(prevButton);
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('TC-PAGIN-05: nút "Trang sau" bị disabled khi ở trang cuối (currentPage = totalPages)', () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={5} totalPages={5} onPageChange={onPageChange} />);

    const prevButton = screen.getByRole('button', { name: 'Trang trước' }) as HTMLButtonElement;
    const nextButton = screen.getByRole('button', { name: 'Trang sau' }) as HTMLButtonElement;

    expect(prevButton.disabled).toBe(false);
    expect(nextButton.disabled).toBe(true);

    fireEvent.click(nextButton);
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('TC-PAGIN-06: bấm vào nút trang gọi callback onPageChange với số trang tương ứng', () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={2} totalPages={5} onPageChange={onPageChange} />);

    const page4Button = screen.getByRole('button', { name: 'Trang 4' });
    fireEvent.click(page4Button);
    expect(onPageChange).toHaveBeenCalledWith(4);

    const prevButton = screen.getByRole('button', { name: 'Trang trước' });
    fireEvent.click(prevButton);
    expect(onPageChange).toHaveBeenCalledWith(1);

    const nextButton = screen.getByRole('button', { name: 'Trang sau' });
    fireEvent.click(nextButton);
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('TC-PAGIN-07: tuân thủ touch-target >= 44px (min-h-11 min-w-11)', () => {
    render(<Pagination currentPage={2} totalPages={5} onPageChange={vi.fn()} />);

    const allButtons = screen.getAllByRole('button');
    expect(allButtons.length).toBeGreaterThan(0);
    allButtons.forEach((btn) => {
      expect(btn.className).toContain('min-h-11');
      expect(btn.className).toContain('min-w-11');
    });
  });

  it('đánh dấu aria-current="page" đúng cho trang hiện tại', () => {
    render(<Pagination currentPage={3} totalPages={5} onPageChange={vi.fn()} />);

    const currentButton = screen.getByRole('button', { name: 'Trang 3' });
    expect(currentButton.getAttribute('aria-current')).toBe('page');
    expect(currentButton.className).toContain('bg-primary-700');

    const otherButton = screen.getByRole('button', { name: 'Trang 2' });
    expect(otherButton.getAttribute('aria-current')).toBeNull();
  });

  it('vô hiệu hoá toàn bộ nút khi disabled = true', () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={3} totalPages={5} onPageChange={onPageChange} disabled={true} />);

    const allButtons = screen.getAllByRole('button') as HTMLButtonElement[];
    allButtons.forEach((btn) => {
      expect(btn.disabled).toBe(true);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Trang 4' }));
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('không kích hoạt callback khi bấm vào chính trang hiện tại', () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={3} totalPages={5} onPageChange={onPageChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Trang 3' }));
    expect(onPageChange).not.toHaveBeenCalled();
  });
});
