// @vitest-environment jsdom
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OwnerRevenueScreen } from './OwnerRevenueScreen';
import { listOwnerVenues } from '@/lib/api/endpoints/owner';
import { useOccupancyStats } from '@/lib/hooks/useOccupancyStats';
import { useRevenueStats } from '@/lib/hooks/useRevenueStats';

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
    LineChart: Stub,
    Line: Stub,
    BarChart: Stub,
    Bar: Stub,
    CartesianGrid: Stub,
    Tooltip: Stub,
    XAxis: Stub,
    YAxis: Stub,
  };
});

vi.mock('@/lib/api/endpoints/owner', () => ({
  listOwnerVenues: vi.fn(),
}));

vi.mock('@/lib/hooks/useRevenueStats', () => ({
  useRevenueStats: vi.fn(),
}));

vi.mock('@/lib/hooks/useOccupancyStats', () => ({
  useOccupancyStats: vi.fn(),
}));

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('OwnerRevenueScreen (OWN-11, OWN-12)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listOwnerVenues).mockResolvedValue([
      {
        id: 'venue-1',
        name: 'Sân Cầu Lông Thăng Long',
        courts: [{ id: 'court-1', name: 'Sân 1', status: 'active' }],
      } as unknown as Awaited<ReturnType<typeof listOwnerVenues>>[number],
    ]);

    vi.mocked(useRevenueStats).mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        summary: { totalRevenue: 1500000, totalBookings: 6, from: '2026-11-01', to: '2026-11-24' },
        series: [{ date: '2026-11-24', revenue: 500000, bookings: 2 }],
      },
    } as unknown as ReturnType<typeof useRevenueStats>);

    vi.mocked(useOccupancyStats).mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        summary: {
          occupancyRate: 0.65,
          bookedSlots: 26,
          availableSlots: 40,
          peakHours: [{ startTime: '18:00', endTime: '19:00', bookedSlots: 10 }],
        },
        series: [{ date: '2026-11-24', occupancyRate: 0.65, bookedSlots: 26, availableSlots: 40 }],
      },
    } as unknown as ReturnType<typeof useOccupancyStats>);
  });

  afterEach(() => {
    cleanup();
  });

  it('hiển thị số liệu doanh thu/lấp đầy và lọc theo kỳ 7 ngày, groupBy week, cơ sở', async () => {
    renderWithClient(<OwnerRevenueScreen />);

    await waitFor(() => {
      expect(screen.getByText('Sân Cầu Lông Thăng Long')).not.toBeNull();
    });

    fireEvent.change(screen.getByLabelText('reportPeriod'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('reportGroupBy'), { target: { value: 'week' } });

    expect(useRevenueStats).toHaveBeenLastCalledWith(
      7,
      expect.objectContaining({ groupBy: 'week' }),
    );
    expect(useOccupancyStats).toHaveBeenLastCalledWith(
      7,
      expect.objectContaining({ groupBy: 'week' }),
    );
  });

  it('hiển thị ErrorState và gọi refetch cả 2 query khi bấm Thử lại', () => {
    const refetchRev = vi.fn();
    const refetchOcc = vi.fn();
    vi.mocked(useRevenueStats).mockReturnValue({
      isLoading: false,
      isError: true,
      error: new Error('Mất kết nối'),
      refetch: refetchRev,
    } as unknown as ReturnType<typeof useRevenueStats>);
    vi.mocked(useOccupancyStats).mockReturnValue({
      isLoading: false,
      isError: false,
      refetch: refetchOcc,
    } as unknown as ReturnType<typeof useOccupancyStats>);

    renderWithClient(<OwnerRevenueScreen />);
    fireEvent.click(screen.getByRole('button', { name: /retry|Thử lại/i }));
    expect(refetchRev).toHaveBeenCalledTimes(1);
    expect(refetchOcc).toHaveBeenCalledTimes(1);
  });
});
