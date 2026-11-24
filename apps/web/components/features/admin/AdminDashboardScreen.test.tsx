// @vitest-environment jsdom
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminDashboardScreen } from './AdminDashboardScreen';
import { useAdminAnalytics, useAdminStats } from '@/lib/hooks/useAdminDashboard';
import * as adminEndpoints from '@/lib/api/endpoints/admin';

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

vi.mock('recharts', () => {
  const Stub = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Stub,
    AreaChart: Stub,
    Area: Stub,
    LineChart: Stub,
    Line: Stub,
    BarChart: Stub,
    Bar: Stub,
    CartesianGrid: Stub,
    Tooltip: Stub,
    Legend: Stub,
    XAxis: Stub,
    YAxis: Stub,
  };
});

vi.mock('@/lib/hooks/useAdminDashboard', () => ({
  useAdminStats: vi.fn(),
  useAdminAnalytics: vi.fn(),
}));

vi.mock('@/lib/api/endpoints/admin', async (importOriginal) => {
  const actual = await importOriginal<typeof adminEndpoints>();
  return {
    ...actual,
    listAdminUsers: vi.fn(),
    listAdminVenues: vi.fn(),
    listAdminBookings: vi.fn(),
  };
});

const sampleStats: adminEndpoints.AdminStats = {
  totalUsers: 10,
  totalVenues: 9,
  totalBookings: 19,
  totalRevenue: 510000,
  pendingOwnerApplications: 1,
  pendingVenues: 4,
  summary: {
    grossRevenue: 735000,
    refundedAmount: 225000,
    netRevenue: 510000,
    userCountsByRole: { customer: 6, owner: 3, admin: 1 },
    venueCountsByStatus: { draft: 4, approved: 5, rejected: 0, suspended: 0 },
    bookingCountsByStatus: {
      held: 1,
      pending_payment: 2,
      confirmed: 5,
      completed: 9,
      cancelled: 2,
      expired: 0,
      no_show: 0,
    },
  },
  series: [
    {
      date: '2026-11-24',
      grossRevenue: 510000,
      refundedAmount: 0,
      netRevenue: 510000,
      bookingCountsByStatus: {
        held: 0,
        pending_payment: 0,
        confirmed: 1,
        completed: 2,
        cancelled: 0,
        expired: 0,
        no_show: 0,
      },
    },
  ],
  userGrowthSeries: [{ date: '2026-11-24', owners: 3, customers: 6 }],
  venueGrowthSeries: [{ date: '2026-11-24', venues: 9 }],
};

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('AdminDashboardScreen & KPI Detail Popups (ADM-08)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAdminStats).mockReturnValue({
      isPending: false,
      isError: false,
      data: sampleStats,
    } as unknown as ReturnType<typeof useAdminStats>);

    vi.mocked(useAdminAnalytics).mockReturnValue({
      isPending: false,
      data: {
        byStatus: [{ status: 'completed', count: 9 }],
        bySport: [{ sport: 'Cầu lông', bookings: 12 }],
        byVenue: [
          { venueId: 'v-1', name: 'Sân Cầu Lông Thăng Long', bookings: 5, revenue: 350000 },
          { venueId: 'v-2', name: 'Sân Pickleball Tây Hồ', bookings: 2, revenue: 160000 },
        ],
      },
    } as unknown as ReturnType<typeof useAdminAnalytics>);

    vi.mocked(adminEndpoints.listAdminUsers).mockResolvedValue({
      data: [
        {
          id: 'u-1',
          fullName: 'Nguyễn Văn A',
          email: 'a@example.com',
          role: 'customer',
          status: 'active',
        },
      ],
      meta: { total: 1, page: 1, limit: 5, totalPages: 1 },
    } as unknown as Awaited<ReturnType<typeof adminEndpoints.listAdminUsers>>);

    vi.mocked(adminEndpoints.listAdminVenues).mockResolvedValue({
      data: [
        {
          id: 'v-1',
          name: 'Sân Cầu Lông Thăng Long',
          address: 'Hà Nội',
          status: 'approved',
        },
      ],
      meta: { total: 1, page: 1, limit: 5, totalPages: 1 },
    } as unknown as Awaited<ReturnType<typeof adminEndpoints.listAdminVenues>>);

    vi.mocked(adminEndpoints.listAdminBookings).mockResolvedValue({
      data: [
        {
          id: 'b-1',
          venueName: 'Sân Cầu Lông Thăng Long',
          courtName: 'Sân 1',
          totalPrice: 200000,
          status: 'confirmed',
          start: '2026-11-24T10:00:00+07:00',
          end: '2026-11-24T11:00:00+07:00',
        },
      ],
      meta: { total: 1, page: 1, limit: 5, totalPages: 1 },
    } as unknown as Awaited<ReturnType<typeof adminEndpoints.listAdminBookings>>);
  });

  afterEach(() => {
    cleanup();
  });

  it('hiển thị skeleton khi đang tải và ErrorState khi lỗi', () => {
    const refetch = vi.fn();
    vi.mocked(useAdminStats).mockReturnValueOnce({
      isPending: true,
      isError: false,
    } as unknown as ReturnType<typeof useAdminStats>);

    const { container } = renderWithClient(<AdminDashboardScreen />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);

    cleanup();
    vi.mocked(useAdminStats).mockReturnValueOnce({
      isPending: false,
      isError: true,
      error: new Error('Lỗi tải thống kê'),
      refetch,
    } as unknown as ReturnType<typeof useAdminStats>);

    renderWithClient(<AdminDashboardScreen />);
    fireEvent.click(screen.getByRole('button', { name: /retry|Thử lại/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('chuyển đổi khoảng thời gian 7 ngày / 90 ngày gọi useAdminStats với groupBy tương ứng', () => {
    renderWithClient(<AdminDashboardScreen />);
    expect(useAdminStats).toHaveBeenLastCalledWith(expect.objectContaining({ groupBy: 'day' }));

    fireEvent.click(screen.getByRole('button', { name: '90 ngày' }));
    expect(useAdminStats).toHaveBeenLastCalledWith(expect.objectContaining({ groupBy: 'week' }));
  });

  it('mở đủ 4 pop-up chi tiết KPI (Doanh thu theo cơ sở, Người dùng, Cơ sở, Lượt đặt)', async () => {
    renderWithClient(<AdminDashboardScreen />);

    // 1. Pop-up Doanh thu
    fireEvent.click(screen.getByRole('button', { name: 'Xem chi tiết doanh thu theo cơ sở' }));
    expect(screen.getByText('Chi tiết Doanh thu toàn sàn')).not.toBeNull();
    expect(screen.getByText('Sân Cầu Lông Thăng Long')).not.toBeNull();
    expect(screen.getByText('Sân Pickleball Tây Hồ')).not.toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Đóng' })[0]!);

    // 2. Pop-up Người dùng
    fireEvent.click(screen.getByRole('button', { name: 'Xem cơ cấu người dùng' }));
    expect(screen.getByText('Cơ cấu Người dùng nền tảng')).not.toBeNull();
    await waitFor(() => expect(screen.getByText('Nguyễn Văn A')).not.toBeNull());
    fireEvent.click(screen.getAllByRole('button', { name: 'Đóng' })[0]!);

    // 3. Pop-up Cơ sở
    fireEvent.click(screen.getByRole('button', { name: 'Xem danh sách cơ sở thể thao' }));
    expect(screen.getByText('Thống kê Cơ sở thể thao')).not.toBeNull();
    await waitFor(() => expect(adminEndpoints.listAdminVenues).toHaveBeenCalled());
    fireEvent.click(screen.getAllByRole('button', { name: 'Đóng' })[0]!);

    // 4. Pop-up Lượt đặt
    fireEvent.click(screen.getByRole('button', { name: 'Xem thống kê lượt đặt sân' }));
    await waitFor(() => expect(adminEndpoints.listAdminBookings).toHaveBeenCalled());
  });
});
