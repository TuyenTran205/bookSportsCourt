// @vitest-environment jsdom
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Slot, VenueDetail } from '@bsc/shared';

import { VenueDetailScreen } from './VenueDetailScreen';
import { useAuth } from '@/lib/hooks/useAuth';
import { useCreateHold } from '@/lib/hooks/useBookings';
import { useReviewSummary, useVenueDetail, useVenueReviews, useVenueSlots } from '@/lib/hooks/useVenue';

const mockPush = vi.fn();

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt ?? ''} />
  ),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ slug: 'san-thang-long' }),
  usePathname: () => '/venues/san-thang-long',
}));

vi.mock('@/lib/navigation/navigate', () => ({
  useAppRouter: () => ({ push: mockPush }),
}));

vi.mock('@/lib/hooks/useVenueRoom', () => ({
  useVenueRoom: vi.fn(),
}));

vi.mock('@/components/features/venue/VenueLocationMapWrapper', () => ({
  VenueLocationMapWrapper: () => <div data-testid="venue-location-map" />,
}));

vi.mock('@/components/features/venue/VenueCompareButton', () => ({
  VenueCompareButton: () => <button type="button">Compare</button>,
}));

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/lib/hooks/useBookings', () => ({
  useCreateHold: vi.fn(),
}));

vi.mock('@/lib/hooks/useVenue', () => ({
  useVenueDetail: vi.fn(),
  useVenueSlots: vi.fn(),
  useReviewSummary: vi.fn(),
  useVenueReviews: vi.fn(),
}));

const sampleVenue: VenueDetail = {
  id: 'venue-1',
  ownerId: 'owner-1',
  name: 'Sân Cầu Lông Thăng Long',
  slug: 'san-thang-long',
  address: '35 Dịch Vọng Hậu',
  provinceId: 'p-1',
  districtId: 'd-1',
  province: null,
  district: null,
  lat: 21.03,
  lng: 105.78,
  description: 'Cụm sân thảm chuẩn thi đấu',
  status: 'approved',
  ratingAvg: 4.8,
  reviewCount: 5,
  coverUrl: null,
  fromPrice: 100000,
  sports: [{ id: 's-1', name: 'Cầu lông', slug: 'cau-long', icon: null }],
  amenities: [],
  images: [],
  courts: [
    { id: 'c-1', name: 'Sân A', sportId: 's-1', description: null, status: 'active' },
    { id: 'c-2', name: 'Sân B', sportId: 's-1', description: null, status: 'active' },
  ],
  openingHours: [],
  cancellationPolicy: { cancelBeforeHours: 24, refundPercent: 100, depositPercent: 50 },
};

const makeSlots = (prefix: string): Slot[] => [
  { start: `${prefix}T08:00:00+07:00`, end: `${prefix}T08:30:00+07:00`, price: 100000, status: 'available' },
  { start: `${prefix}T08:30:00+07:00`, end: `${prefix}T09:00:00+07:00`, price: 100000, status: 'available' },
  { start: `${prefix}T09:00:00+07:00`, end: `${prefix}T09:30:00+07:00`, price: 100000, status: 'booked' },
];

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('VenueDetailScreen (GST-03, GST-04, CUS-06, CUS-07)', () => {
  const mutateHold = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useVenueDetail).mockReturnValue({
      isLoading: false,
      isError: false,
      data: sampleVenue,
    } as unknown as ReturnType<typeof useVenueDetail>);
    vi.mocked(useVenueSlots).mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        date: '2035-06-01',
        courts: [
          { courtId: 'c-1', slots: makeSlots('2035-06-01') },
          { courtId: 'c-2', slots: makeSlots('2035-06-01') },
        ],
      },
    } as unknown as ReturnType<typeof useVenueSlots>);
    vi.mocked(useReviewSummary).mockReturnValue({ data: undefined } as unknown as ReturnType<typeof useReviewSummary>);
    vi.mocked(useVenueReviews).mockReturnValue({
      isLoading: false,
      data: { data: [], meta: { total: 0, page: 1, limit: 5, totalPages: 0 } },
    } as unknown as ReturnType<typeof useVenueReviews>);
    vi.mocked(useCreateHold).mockReturnValue({
      isPending: false,
      mutateAsync: mutateHold,
    } as unknown as ReturnType<typeof useCreateHold>);
  });

  afterEach(() => {
    cleanup();
  });

  it('khách vãng lai chọn slot thấy CTA đăng nhập giữ ?next=, đổi sân con sẽ reset lựa chọn', () => {
    vi.mocked(useAuth).mockReturnValue({ isAuthenticated: false } as unknown as ReturnType<typeof useAuth>);
    renderWithClient(<VenueDetailScreen />);

    const cells = document.querySelectorAll('button[data-slot-cell]:not([disabled])');
    expect(cells.length).toBe(2);
    fireEvent.keyDown(cells[0]!, { key: 'Enter' });

    const loginLink = screen.getByRole('link', { name: 'loginToContinue' });
    expect(loginLink.getAttribute('href')).toBe('/login?next=%2Fvenues%2Fsan-thang-long');

    // Đổi sang Sân B -> reset lựa chọn
    fireEvent.click(screen.getByRole('radio', { name: 'Sân B' }));
    expect(screen.getByText('noSlotPicked')).not.toBeNull();
  });

  it('khách đã đăng nhập chọn slot, mở xác nhận và gọi createHold rồi chuyển sang /checkout/:id', async () => {
    vi.mocked(useAuth).mockReturnValue({ isAuthenticated: true } as unknown as ReturnType<typeof useAuth>);
    mutateHold.mockResolvedValueOnce({ booking: { id: 'hold-99' } });

    renderWithClient(<VenueDetailScreen />);
    const cells = document.querySelectorAll('button[data-slot-cell]:not([disabled])');
    fireEvent.keyDown(cells[0]!, { key: 'Enter' });

    fireEvent.click(screen.getByRole('button', { name: 'continue' }));
    expect(screen.getByRole('dialog')).not.toBeNull();

    // Bấm nút xác nhận trong BookingConfirmDialog
    const confirmBtn = screen.getByRole('button', { name: /Xác nhận|confirm/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mutateHold).toHaveBeenCalledWith(
        expect.objectContaining({
          courtId: 'c-1',
          idempotencyKey: expect.any(String),
        }),
      );
      expect(mockPush).toHaveBeenCalledWith('/checkout/hold-99');
    });
  });
});
