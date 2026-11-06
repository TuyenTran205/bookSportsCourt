// @vitest-environment jsdom
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { BookingDetail } from '@bsc/shared';
import { CheckoutSummary } from './CheckoutSummary';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      orderSummary: 'Tóm tắt đơn giữ chỗ',
      court: 'Sân',
      matchDate: 'Ngày chơi',
      matchTime: 'Khung giờ',
      totalPrice: 'Tổng giá trị đơn',
      depositRequired: 'Số tiền cọc cần chuyển ngay',
      remainingAtVenue: 'Còn lại thanh toán tại sân',
      remainingAtVenueHint: 'Thanh toán cho chủ sân khi nhận sân',
      cancellationPolicyTitle: 'Chính sách huỷ & hoàn cọc',
      cancellationPolicyNote: 'Đơn giữ chỗ quá 10 phút sẽ tự động huỷ bỏ.',
    };
    return map[key] ?? key;
  },
}));

const mockBooking: BookingDetail = {
  id: 'b-sum-1',
  courtId: 'court-sum-1',
  customerId: 'cust-1',
  source: 'online',
  guestName: null,
  guestPhone: null,
  during: {
    start: '2026-10-15T08:00:00+07:00',
    end: '2026-10-15T09:30:00+07:00',
  },
  status: 'held',
  totalPrice: 300000,
  depositAmount: 150000,
  note: null,
  expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  cancelledAt: null,
  cancelReason: null,
  createdAt: '2026-10-14T10:00:00+07:00',
  court: {
    id: 'court-sum-1',
    name: 'Sân 1 (Sân 5 người)',
    venue: {
      id: 'venue-sum-1',
      name: 'Sân Bóng Thăng Long',
      slug: 'san-bong-thang-long',
      address: '123 Đường Láng, Hà Nội',
    },
  },
  customer: {
    id: 'cust-1',
    fullName: 'Trần Khách',
    phone: '0912345678',
    email: 'khach@example.com',
  },
  payment: null,
  review: null,
};

describe('CheckoutSummary Component', () => {
  it('render đầy đủ tóm tắt cơ sở, sân, tiền cọc và tiền còn lại', () => {
    render(<CheckoutSummary booking={mockBooking} />);

    expect(screen.getByText('Tóm tắt đơn giữ chỗ')).toBeDefined();
    expect(screen.getByText('Sân Bóng Thăng Long')).toBeDefined();
    expect(screen.getByText('123 Đường Láng, Hà Nội')).toBeDefined();
    expect(screen.getByText('Sân 1 (Sân 5 người)')).toBeDefined();
    expect(screen.getByText('Số tiền cọc cần chuyển ngay')).toBeDefined();
    expect(screen.getByText('Chính sách huỷ & hoàn cọc')).toBeDefined();
  });
});
