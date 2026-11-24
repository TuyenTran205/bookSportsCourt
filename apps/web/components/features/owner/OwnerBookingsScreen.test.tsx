// @vitest-environment jsdom
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OwnerBookingsScreen } from './OwnerBookingsScreen';
import { useOwnerBookings } from '@/lib/hooks/useOwnerBookings';
import * as ownerEndpoints from '@/lib/api/endpoints/owner';

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

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/hooks/useOwnerRealtime', () => ({
  useOwnerRealtime: vi.fn(),
}));

vi.mock('@/lib/hooks/useOwnerBookings', () => ({
  useOwnerBookings: vi.fn(),
}));

vi.mock('@/lib/api/endpoints/owner', async (importOriginal) => {
  const actual = await importOriginal<typeof ownerEndpoints>();
  return {
    ...actual,
    markBookingNoShow: vi.fn(),
  };
});

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const pastConfirmedBooking: ownerEndpoints.OwnerBookingItem = {
  id: 'bk-past-1',
  courtId: 'c-1',
  courtName: 'Sân 1',
  customerId: 'u-1',
  customerName: 'Nguyễn Văn Khách',
  customerPhone: '0901234567',
  guestName: null,
  guestPhone: null,
  during: { start: '2020-01-01T08:00:00+07:00', end: '2020-01-01T09:00:00+07:00' },
  status: 'confirmed',
  paymentStatus: 'completed',
  totalPrice: 200000,
  depositAmount: 100000,
  source: 'online',
  note: null,
  expiresAt: null,
  cancelledAt: null,
  cancelReason: null,
  createdAt: '2020-01-01T07:00:00+07:00',
};

const futureConfirmedBooking: ownerEndpoints.OwnerBookingItem = {
  ...pastConfirmedBooking,
  id: 'bk-future-2',
  customerName: 'Trần Tương Lai',
  during: { start: '2035-06-01T08:00:00+07:00', end: '2035-06-01T09:00:00+07:00' },
};

describe('OwnerBookingsScreen (OWN-06, OWN-09)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('hiển thị nút No-show chỉ cho đơn confirmed đã quá giờ bắt đầu và gọi markBookingNoShow khi xác nhận', async () => {
    vi.mocked(ownerEndpoints.markBookingNoShow).mockResolvedValueOnce({} as unknown as Awaited<ReturnType<typeof ownerEndpoints.markBookingNoShow>>);
    vi.mocked(useOwnerBookings).mockReturnValue({
      isLoading: false,
      isFetching: false,
      isError: false,
      data: {
        data: [pastConfirmedBooking, futureConfirmedBooking],
        meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
      },
    } as unknown as ReturnType<typeof useOwnerBookings>);

    renderWithClient(<OwnerBookingsScreen />);

    // Chỉ có 1 đơn quá khứ đủ điều kiện No-show (mobile card + desktop row => 2 nút cho bk-past-1, 0 cho bk-future-2)
    const noShowBtns = screen.getAllByRole('button', { name: /No-show/i });
    expect(noShowBtns.length).toBe(2);

    fireEvent.click(noShowBtns[0]!);
    expect(screen.getByText('Xác nhận khách vắng mặt (No-show)?')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận vắng mặt' }));
    await waitFor(() => {
      expect(ownerEndpoints.markBookingNoShow).toHaveBeenCalledWith('bk-past-1');
    });
  });

  it('hiển thị EmptyState kèm nút xoá bộ lọc khi tìm kiếm không có kết quả', () => {
    vi.mocked(useOwnerBookings).mockReturnValue({
      isLoading: false,
      isFetching: false,
      isError: false,
      data: { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } },
    } as unknown as ReturnType<typeof useOwnerBookings>);

    renderWithClient(<OwnerBookingsScreen />);
    expect(screen.getByText('noRecentBookings')).not.toBeNull();
  });
});
