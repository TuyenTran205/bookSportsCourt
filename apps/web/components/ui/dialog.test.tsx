// @vitest-environment jsdom
import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from './dialog';

describe('Dialog Component (TC-DM-05: Dark Mode Overlay & Surface)', () => {
  it('render DialogOverlay dùng lớp phủ nền tối tuyệt đối bg-black/60 dark:bg-black/75', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Tiêu đề Modal</DialogTitle>
          <DialogDescription>Mô tả nội dung hộp thoại</DialogDescription>
        </DialogContent>
      </Dialog>,
    );

    // Tìm DialogOverlay qua class bg-black/60
    const overlay = document.querySelector('.bg-black\\/60');
    expect(overlay).not.toBeNull();
    expect(overlay?.className).toContain('dark:bg-black/75');
    // Tuyệt đối CẤM dùng bg-neutral-900/50 vì sẽ bị biến thành sương mù trắng khi đảo chiều neutral
    expect(overlay?.className).not.toContain('bg-neutral-900/50');

    const content = screen.getByRole('dialog');
    expect(content.className).toContain('border-border');
    expect(content.className).toContain('bg-bg-card');
    expect(content.className).toContain('text-text-primary');
    expect(content.className).not.toContain('bg-white');
  });
});
