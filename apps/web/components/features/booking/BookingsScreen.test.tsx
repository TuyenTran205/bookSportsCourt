// @vitest-environment jsdom
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookingDetail } from '@bsc/shared';

import { BookingsScreen } from './BookingsScreen';
import { useMyBookings } from '@/lib/hooks/useBookings';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/hooks/useBookings', () => ({
  useMyBookings: vi.fn(),
}));

const sampleBooking: BookingDetail = {
  id: 'booking-1',
  courtId: 'court-1',
  customerId: 'user-1',
  source: 'online',
  during: {
    start: '2026-11-25T10:00:00+07:00',
    end: '2026-11-25T11:00:00+07:00',
  },
  status: 'confirmed',
  totalPrice: 200000,
  depositAmount: 100000,
  expiresAt: null,
  guestName: null,
  guestPhone: null,
  note: null,
  cancelledAt: null,
  cancelReason: null,
  createdAt: '2026-11-24T08:00:00+07:00',
  court: {
    id: 'court-1',
    name: 'Sân 1',
    venue: {
      id: 'venue-1',
      name: 'Sân Cầu Lông Thăng Long',
      slug: 'san-cau-long-thang-long',
      address: '123 Hoàng Quốc Việt',
    },
  },
  customer: { id: 'user-1', fullName: 'Nguyễn Văn A', phone: '090***789', email: 'khach@example.com' },
  payment: null,
  review: null,
};

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('BookingsScreen (CUS-10)', () => {
  const mockUseMyBookings = vi.mocked(useMyBookings);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('hiển thị skeleton khi đang tải và ErrorState kèm nút thử lại khi lỗi', () => {
    const refetch = vi.fn();
    mockUseMyBookings.mockReturnValueOnce({
      isLoading: true,
      isError: false,
      data: undefined,
    } as unknown as ReturnType<typeof useMyBookings>);

    const { container } = renderWithClient(<BookingsScreen />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);

    cleanup();
    mockUseMyBookings.mockReturnValue({
      isLoading: false,
      isError: true,
      error: new Error('Lỗi mạng'),
      refetch,
    } as unknown as ReturnType<typeof useMyBookings>);

    renderWithClient(<BookingsScreen />);
    expect(screen.getByRole('alert')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /retry|Thử lại/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('hiển thị EmptyState kèm link tìm sân khi không có đơn', () => {
    mockUseMyBookings.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } },
    } as unknown as ReturnType<typeof useMyBookings>);

    renderWithClient(<BookingsScreen />);
    expect(screen.getByText('noBookings')).not.toBeNull();
    const cta = screen.getByRole('link', { name: /findVenue/i });
    expect(cta.getAttribute('href')).toBe('/venues');
  });

  it('hiển thị danh sách đơn, đổi tab filter gọi lại hook đúng trạng thái và reset về page 1', () => {
    mockUseMyBookings.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        data: [sampleBooking],
        meta: { page: 1, limit: 10, total: 15, totalPages: 2 },
      },
    } as unknown as ReturnType<typeof useMyBookings>);

    renderWithClient(<BookingsScreen />);
    expect(screen.getByText('Sân Cầu Lông Thăng Long')).not.toBeNull();
    expect(screen.getByRole('link', { name: /Sân Cầu Lông Thăng Long/i }).getAttribute('href')).toBe('/bookings/booking-1');

    // Chuyển sang trang 2 rồi đổi filter phải reset về trang 1
    fireEvent.click(screen.getByRole('button', { name: /2/ }));
    expect(mockUseMyBookings).toHaveBeenLastCalledWith(undefined, 2);

    const confirmedTab = screen.getByRole('tab', { name: 'confirmed' });
    fireEvent.mouseDown(confirmedTab);
    fireEvent.click(confirmedTab);
    expect(mockUseMyBookings).toHaveBeenLastCalledWith('confirmed', 1);
  });
});
