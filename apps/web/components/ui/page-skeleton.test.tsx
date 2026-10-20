// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { PageSkeleton, type PageSkeletonVariant } from './page-skeleton';

afterEach(cleanup);

describe('WT-NAV-12: PageSkeleton', () => {
  const VARIANTS: PageSkeletonVariant[] = ['dashboard', 'list', 'detail', 'form'];

  it.each(VARIANTS)('variant "%s" có đầy đủ thuộc tính trợ năng và live region', (variant) => {
    const { container } = render(<PageSkeleton variant={variant} />);

    const status = container.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status?.getAttribute('aria-live')).toBe('polite');
    expect(status?.getAttribute('aria-busy')).toBe('true');
    expect(status?.getAttribute('aria-label')).toBe('Đang tải dữ liệu');
    expect(screen.getByText('Đang tải dữ liệu…')).toBeDefined();
  });

  it.each(VARIANTS)('variant "%s" tuân thủ Anti-AI: không chứa gradient tím/hồng, không shimmer màu', (variant) => {
    const { container } = render(<PageSkeleton variant={variant} />);
    const html = container.innerHTML;

    // Không dùng gradient neon hoặc màu AI lòe loẹt
    expect(html).not.toMatch(/from-purple|to-pink|from-indigo|bg-gradient/);
    expect(html).not.toMatch(/drop-shadow-\[|shadow-\[0_0/);
  });

  it.each(VARIANTS)('variant "%s" không chứa nội dung text giả hay emoji rác', (variant) => {
    const { container } = render(<PageSkeleton variant={variant} />);
    // Loại trừ dòng sr-only
    const srOnly = container.querySelector('.sr-only');
    const textContent = (container.textContent ?? '').replace(srOnly?.textContent ?? '', '').trim();

    expect(textContent).toBe('');
    expect(container.innerHTML).not.toMatch(/[\u{1F300}-\u{1F9FF}]/u);
  });

  it('variant "dashboard" render đủ 4 thẻ KPI và 2 khối lớn', () => {
    const { container } = render(<PageSkeleton variant="dashboard" />);
    const cards = container.querySelectorAll('.rounded-card');
    // 4 KPI cards + 2 main blocks = 6 cards
    expect(cards.length).toBe(6);
  });

  it('variant "list" render thanh tìm kiếm, filter chips và lưới 6 cards', () => {
    const { container } = render(<PageSkeleton variant="list" />);
    const cards = container.querySelectorAll('.rounded-card');
    expect(cards.length).toBe(6);
  });

  it('variant "detail" render breadcrumb, hero banner và layout 2 cột', () => {
    const { container } = render(<PageSkeleton variant="detail" />);
    const cards = container.querySelectorAll('.rounded-card');
    // Hero banner + 2 cards cột trái + 1 card cột phải = 4 cards
    expect(cards.length).toBe(4);
  });

  it('variant "form" render card form căn giữa với các trường input', () => {
    const { container } = render(<PageSkeleton variant="form" />);
    const cards = container.querySelectorAll('.rounded-card');
    expect(cards.length).toBe(1);
  });

  it('nhận className tuỳ biến từ bên ngoài', () => {
    const { container } = render(<PageSkeleton variant="dashboard" className="custom-wrapper" />);
    expect(container.firstElementChild?.classList.contains('custom-wrapper')).toBe(true);
  });
});
