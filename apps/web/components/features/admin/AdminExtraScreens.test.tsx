// @vitest-environment jsdom
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OwnerApplication } from '@bsc/shared';

import { AdminAnalyticsScreen } from './AdminAnalyticsScreen';
import { AdminBookingsScreen } from './AdminBookingsScreen';
import { AdminOwnerApplicationsScreen } from './AdminOwnerApplicationsScreen';
import { useAdminAnalytics } from '@/lib/hooks/useAdminDashboard';
import { useAdminBookings } from '@/lib/hooks/useAdminBookings';
import { useOwnerApplications, useReviewOwnerApplication } from '@/lib/hooks/useAdminOwnerApplications';
import type { AdminBookingRow } from '@/lib/api/endpoints/admin';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('recharts', () => {
  const Stub = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Stub,
    PieChart: Stub,
    Pie: Stub,
    BarChart: Stub,
    Bar: Stub,
    Cell: Stub,
    CartesianGrid: Stub,
    Tooltip: Stub,
    Legend: Stub,
    XAxis: Stub,
    YAxis: Stub,
  };
});

vi.mock('@/lib/hooks/useAdminDashboard', () => ({
  useAdminAnalytics: vi.fn(),
}));

vi.mock('@/lib/hooks/useAdminBookings', () => ({
  useAdminBookings: vi.fn(),
}));

vi.mock('@/lib/hooks/useAdminOwnerApplications', () => ({
  useOwnerApplications: vi.fn(),
  useReviewOwnerApplication: vi.fn(),
}));

vi.mock('@/components/features/admin/AdminBookingDetailDrawer', () => ({
  AdminBookingDetailDrawer: ({ booking }: { booking: AdminBookingRow | null }) =>
    booking ? <div data-testid="booking-drawer">{booking.id}</div> : null,
}));

vi.mock('@/components/features/admin/ForceCancelDialog', () => ({
  ForceCancelDialog: ({ booking }: { booking: AdminBookingRow | null }) =>
    booking ? <div data-testid="force-cancel-dialog">{booking.id}</div> : null,
}));

vi.mock('@/components/features/admin/RejectApplicationDialog', () => ({
  RejectApplicationDialog: () => null,
}));

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('Admin Analytics, Bookings & Owner Applications Screens (ADM-01, ADM-07, ADM-08)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('AdminAnalyticsScreen hiển thị dữ liệu theo môn, trạng thái, doanh thu cơ sở và ErrorState khi lỗi', () => {
    const refetch = vi.fn();
    vi.mocked(useAdminAnalytics).mockReturnValueOnce({
      isPending: false,
      isError: true,
      error: new Error('Lỗi analytics'),
      refetch,
    } as unknown as ReturnType<typeof useAdminAnalytics>);

    renderWithClient(<AdminAnalyticsScreen />);
    fireEvent.click(screen.getByRole('button', { name: /Thử lại|retry/i }));
    expect(refetch).toHaveBeenCalledTimes(1);

    cleanup();
    vi.mocked(useAdminAnalytics).mockReturnValue({
      isPending: false,
      isError: false,
      data: {
        byStatus: [{ status: 'completed', count: 5 }],
        bySport: [{ sport: 'Cầu lông', bookings: 5 }],
        byVenue: [{ venueId: 'v-1', name: 'CLB Thăng Long', bookings: 5, revenue: 500000 }],
      },
    } as unknown as ReturnType<typeof useAdminAnalytics>);

    renderWithClient(<AdminAnalyticsScreen />);
    expect(screen.getByText('CLB Thăng Long')).not.toBeNull();
  });

  it('AdminBookingsScreen lọc trạng thái, mở chi tiết đơn và hộp thoại cưỡng chế huỷ đơn', () => {
    const bookingRow: AdminBookingRow = {
      id: 'bk-adm-100',
      venueName: 'Sân Cầu Lông Thăng Long',
      courtId: 'c-1',
      courtName: 'Sân 1',
      customerId: 'u-1',
      customerName: 'Lê Văn C',
      guestName: null,
      guestPhone: null,
      source: 'online',
      status: 'confirmed',
      paymentStatus: 'completed',
      totalPrice: 200000,
      depositAmount: 100000,
      note: null,
      expiresAt: null,
      cancelledAt: null,
      cancelReason: null,
      during: { start: '2026-11-25T10:00:00+07:00', end: '2026-11-25T11:00:00+07:00' },
      createdAt: '2026-11-24T08:00:00+07:00',
    };

    vi.mocked(useAdminBookings).mockReturnValue({
      isPending: false,
      isError: false,
      data: {
        data: [bookingRow],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      },
    } as unknown as ReturnType<typeof useAdminBookings>);

    renderWithClient(<AdminBookingsScreen />);
    expect(screen.getAllByText('Lê Văn C').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Đang giữ chỗ' }));
    expect(useAdminBookings).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'held', page: 1 }),
    );

    fireEvent.click(screen.getByTitle('Xem chi tiết đơn'));
    expect(screen.getByTestId('booking-drawer').textContent).toBe('bk-adm-100');

    fireEvent.click(screen.getByTitle('Cưỡng chế huỷ đơn (Quản trị viên)'));
    expect(screen.getByTestId('force-cancel-dialog').textContent).toBe('bk-adm-100');
  });

  it('AdminOwnerApplicationsScreen duyệt hồ sơ đang chờ và lọc theo trạng thái', async () => {
    const reviewMutate = vi.fn().mockResolvedValueOnce({});
    vi.mocked(useReviewOwnerApplication).mockReturnValue({
      isPending: false,
      mutateAsync: reviewMutate,
    } as unknown as ReturnType<typeof useReviewOwnerApplication>);

    const pendingApp: OwnerApplication = {
      id: 'app-1',
      userId: 'u-1',
      applicantName: 'Nguyễn Văn Chủ',
      user: {
        id: 'u-1',
        fullName: 'Nguyễn Văn Chủ',
        email: 'chu@example.com',
        phone: '0901234567',
        avatarUrl: null,
        role: 'customer',
        status: 'active',
        createdAt: '2026-11-20T10:00:00Z',
      },
      businessName: 'Trung tâm Thể thao ABC',
      phone: '0901234567',
      address: '10 Cầu Giấy, Hà Nội',
      taxCode: '0123456789',
      idCardUrl: null,
      rejectReason: null,
      status: 'pending',
      reviewNote: null,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: '2026-11-20T10:00:00Z',
      updatedAt: '2026-11-20T10:00:00Z',
    };

    vi.mocked(useOwnerApplications).mockReturnValue({
      isPending: false,
      isError: false,
      data: {
        data: [pendingApp],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      },
    } as unknown as ReturnType<typeof useOwnerApplications>);

    renderWithClient(<AdminOwnerApplicationsScreen />);
    expect(screen.getAllByText('Trung tâm Thể thao ABC').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Chờ duyệt' }));
    expect(useOwnerApplications).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'pending', page: 1 }),
    );

    const approveBtns = screen.getAllByRole('button', { name: /^Duyệt$/i });
    fireEvent.click(approveBtns[0]!);
    await waitFor(() => expect(screen.getByRole('dialog')).not.toBeNull());
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Duyệt hồ sơ|Xác nhận|Duyệt/i }));

    await waitFor(() => {
      expect(reviewMutate).toHaveBeenCalledWith({ id: 'app-1', status: 'approved' });
    });
  });
});
