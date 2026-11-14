// @vitest-environment jsdom
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { CancellationPolicy, Slot } from '@bsc/shared';

import { BookingConfirmDialog } from './BookingConfirmDialog';

const SAMPLE_SLOTS: Slot[] = [
  {
    start: '2026-11-20T08:00:00+07:00',
    end: '2026-11-20T08:30:00+07:00',
    status: 'available',
    price: 100000,
  },
  {
    start: '2026-11-20T08:30:00+07:00',
    end: '2026-11-20T09:00:00+07:00',
    status: 'available',
    price: 100000,
  },
];

const SAMPLE_POLICY: CancellationPolicy = {
  cancelBeforeHours: 12,
  refundPercent: 80,
  depositPercent: 50,
};

describe('BookingConfirmDialog', () => {
  it('hiển thị đầy đủ cơ sở, sân, ngày giờ, tiền và chính sách huỷ rồi gọi onConfirm khi xác nhận', () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();

    render(
      <BookingConfirmDialog
        open
        onOpenChange={onOpenChange}
        venueName="Sân Cầu Lông Đại học Thủy Lợi"
        venueAddress="175 Tây Sơn, Đống Đa, Hà Nội"
        courtName="Sân số 1"
        sportName="Cầu lông"
        date="2026-11-20"
        timeRange="08:00 - 09:00"
        slots={SAMPLE_SLOTS}
        totalPrice={200000}
        cancellationPolicy={SAMPLE_POLICY}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText('Xác nhận đặt sân')).toBeDefined();
    expect(screen.getByText('Sân Cầu Lông Đại học Thủy Lợi')).toBeDefined();
    expect(screen.getByText(/Sân số 1 \(Cầu lông\)/)).toBeDefined();
    expect(screen.getByText('08:00 - 09:00')).toBeDefined();
    expect(screen.getByText(/1 giờ \(2 block 30 phút\)/)).toBeDefined();
    expect(screen.getByText(/200\.000/)).toBeDefined();
    expect(screen.getByText(/50%/)).toBeDefined();
    expect(screen.getAllByText(/100\.000/).length).toBe(3);
    expect(screen.getByText(/tối thiểu 12 giờ/)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /Xác nhận & Giữ chỗ/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Quay lại/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('vô hiệu hóa nút quay lại và nút xác nhận khi đang gửi yêu cầu', () => {
    render(
      <BookingConfirmDialog
        open
        onOpenChange={vi.fn()}
        venueName="Sân Bóng TLU"
        courtName="Sân A"
        date="2026-11-20"
        timeRange="18:00 - 18:30"
        slots={[SAMPLE_SLOTS[0]!]}
        totalPrice={100000}
        cancellationPolicy={null}
        pending
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Quay lại/i }).hasAttribute('disabled')).toBe(true);
    expect(
      screen.getByRole('button', { name: /Xác nhận & Giữ chỗ/i }).hasAttribute('disabled'),
    ).toBe(true);
  });
});
