// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  afterEach(() => {
    cleanup();
  });
  it('hiển thị tiêu đề, nội dung xác nhận và gọi onConfirm / onOpenChange đúng hành động', () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Duyệt cơ sở"
        subtitle="Kiểm tra kỹ thông tin trước khi duyệt"
        description={<>Bạn có chắc chắn muốn duyệt cơ sở &ldquo;Sân bóng rổ Đại học TLU&rdquo;?</>}
        confirmLabel="Xác nhận duyệt"
        cancelLabel="Hủy"
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText('Duyệt cơ sở')).toBeTruthy();
    expect(screen.getByText(/Sân bóng rổ Đại học TLU/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận duyệt' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('vô hiệu hoá các nút khi đang xử lý (isPending)', () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <ConfirmDialog
        open
        isPending
        variant="danger"
        onOpenChange={onOpenChange}
        title="Xoá môn thể thao"
        description="Bạn có chắc chắn muốn xoá?"
        confirmLabel="Xác nhận xoá"
        cancelLabel="Hủy"
        onConfirm={onConfirm}
      />,
    );

    expect((screen.getByRole('button', { name: 'Hủy' }) as HTMLButtonElement).disabled).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Xác nhận xoá' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
