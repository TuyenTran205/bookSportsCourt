// @vitest-environment jsdom
import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { StatusBadge } from './status-badge';

describe('StatusBadge Component (TC-DM-06: Dark Mode Tone Variants)', () => {
  it('render badge booking confirmed chứa biến thể dark mode chuẩn tương phản', () => {
    render(<StatusBadge kind="booking" status="confirmed" />);
    const badge = screen.getByText('Đã xác nhận');

    expect(badge.className).toContain('border-blue-200');
    expect(badge.className).toContain('dark:bg-blue-950/40');
    expect(badge.className).toContain('dark:text-blue-300');
  });

  it('render badge booking completed (green) chứa biến thể dark mode chuẩn', () => {
    render(<StatusBadge kind="booking" status="completed" />);
    const badge = screen.getByText('Hoàn tất');

    expect(badge.className).toContain('border-primary-200');
    expect(badge.className).toContain('dark:bg-primary-950/40');
    expect(badge.className).toContain('dark:text-primary-300');
  });

  it('render badge booking cancelled (red) chứa biến thể dark mode chuẩn', () => {
    render(<StatusBadge kind="booking" status="cancelled" />);
    const badge = screen.getByText('Đã huỷ');

    expect(badge.className).toContain('border-red-200');
    expect(badge.className).toContain('dark:bg-red-950/40');
    expect(badge.className).toContain('dark:text-red-300');
  });

  it('render badge booking held (yellow) chứa biến thể dark mode chuẩn', () => {
    render(<StatusBadge kind="booking" status="held" />);
    const badge = screen.getByText('Đang giữ chỗ');

    expect(badge.className).toContain('border-amber-200');
    expect(badge.className).toContain('dark:bg-amber-950/40');
    expect(badge.className).toContain('dark:text-amber-300');
  });
});
