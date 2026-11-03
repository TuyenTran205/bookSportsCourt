// @vitest-environment jsdom
import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Button } from './button';

describe('Button Component (TC-DM-03: Dark Mode Semantic Tokens)', () => {
  it('render button variant outline dùng token ngữ nghĩa bg-bg và text-text-primary', () => {
    render(<Button variant="outline">Nút viền ngoài</Button>);
    const button = screen.getByRole('button', { name: 'Nút viền ngoài' });

    expect(button.className).toContain('border-border');
    expect(button.className).toContain('bg-bg');
    expect(button.className).toContain('text-text-primary');
    // Tuyệt đối không hardcode text-neutral-900 tránh lỗi chữ đen trên nền tối
    expect(button.className).not.toContain('text-neutral-900');
  });

  it('render button variant secondary dùng bg-bg-subtle và text-text-primary', () => {
    render(<Button variant="secondary">Nút phụ</Button>);
    const button = screen.getByRole('button', { name: 'Nút phụ' });

    expect(button.className).toContain('bg-bg-subtle');
    expect(button.className).toContain('text-text-primary');
    expect(button.className).not.toContain('text-neutral-900');
  });

  it('render button variant primary giữ nguyên text-white tương phản chuẩn', () => {
    render(<Button variant="primary">Nút chính</Button>);
    const button = screen.getByRole('button', { name: 'Nút chính' });

    expect(button.className).toContain('bg-primary-700');
    expect(button.className).toContain('text-white');
  });
});
