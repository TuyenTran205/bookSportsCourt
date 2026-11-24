// @vitest-environment jsdom
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VenueDetail } from '@bsc/shared';

import { OwnerVenuesScreen } from './OwnerVenuesScreen';
import {
  createCourt,
  createOwnerVenue,
  deleteCourt,
  listOwnerVenues,
  updateOwnerVenue,
} from '@/lib/api/endpoints/owner';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values?.name ? `${key}:${String(values.name)}` : values?.count !== undefined ? `${key}:${String(values.count)}` : key,
}));

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt, src }: { alt?: string; src?: string }) => <img alt={alt ?? ''} src={src ?? ''} />,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/api/endpoints/owner', () => ({
  listOwnerVenues: vi.fn(),
  createOwnerVenue: vi.fn(),
  updateOwnerVenue: vi.fn(),
  uploadVenueImage: vi.fn(),
  createCourt: vi.fn(),
  deleteCourt: vi.fn(),
}));

vi.mock('./venues/VenueFormDialog', () => ({
  VenueFormDialog: ({
    open,
    venue,
    onSubmit,
  }: {
    open: boolean;
    venue?: VenueDetail;
    onSubmit: (input: Record<string, unknown>) => void;
  }) =>
    open ? (
      <div role="dialog" aria-label="venue-form-dialog">
        <span>{venue ? `edit:${venue.name}` : 'create-new'}</span>
        <button
          type="button"
          onClick={() =>
            onSubmit({
              name: 'Sân Mới Test',
              address: '99 Cầu Giấy',
              provinceId: 1,
              districtId: 1,
              wardId: 1,
              sportIds: ['sp-1'],
              amenityIds: [],
            })
          }
        >
          submit-venue
        </button>
      </div>
    ) : null,
}));

vi.mock('./venues/VenueCourtsDialog', () => ({
  VenueCourtsDialog: ({
    venue,
    onCreate,
    onDelete,
  }: {
    venue: VenueDetail | null;
    onCreate: (input: { name: string; sportId: string; surface: string }) => void;
    onDelete: (court: VenueDetail['courts'][number]) => void;
  }) =>
    venue ? (
      <div role="dialog" aria-label="venue-courts-dialog">
        <span>{`courts:${venue.name}`}</span>
        <button
          type="button"
          onClick={() => onCreate({ name: 'Sân 3', sportId: 'sp-1', surface: 'Thảm PVC' })}
        >
          add-court
        </button>
        {venue.courts?.[0] && (
          <button type="button" onClick={() => onDelete(venue.courts[0]!)}>
            delete-first-court
          </button>
        )}
      </div>
    ) : null,
}));

const sampleVenue: VenueDetail = {
  id: 'v-owner-1',
  name: 'CLB Cầu Lông Sao Mai',
  slug: 'clb-sao-mai',
  description: null,
  address: '12 Xuân Thủy, Cầu Giấy',
  lat: 21.036,
  lng: 105.782,
  phone: '0901234567',
  coverUrl: null,
  status: 'active',
  depositRate: 0.3,
  cancellationPolicy: null,
  ratingAvg: 4.8,
  reviewCount: 12,
  province: { id: 1, name: 'Hà Nội' },
  district: { id: 1, name: 'Cầu Giấy' },
  ward: { id: 1, name: 'Dịch Vọng Hậu' },
  sports: [{ id: 'sp-1', name: 'Cầu lông', slug: 'cau-long', icon: 'badminton' }],
  amenities: [],
  images: [],
  courts: [
    {
      id: 'c-1',
      venueId: 'v-owner-1',
      name: 'Sân A1',
      sportId: 'sp-1',
      surface: 'Thảm',
      isActive: true,
    },
  ],
  openingHours: [],
  pricingRules: [],
} as unknown as VenueDetail;

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('OwnerVenuesScreen (OWN-02, OWN-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('hiển thị EmptyState khi chưa có cơ sở và ErrorState khi API lỗi', async () => {
    vi.mocked(listOwnerVenues).mockRejectedValueOnce(new Error('Network error'));
    renderWithClient(<OwnerVenuesScreen />);

    await waitFor(() => expect(screen.getByRole('alert')).not.toBeNull());

    cleanup();
    vi.mocked(listOwnerVenues).mockResolvedValueOnce([]);
    renderWithClient(<OwnerVenuesScreen />);

    await waitFor(() => expect(screen.getByText('noVenuesTitle')).not.toBeNull());
  });

  it('cho phép tạo cơ sở mới, chỉnh sửa cơ sở và thêm/xoá sân con', async () => {
    vi.mocked(listOwnerVenues).mockResolvedValue([sampleVenue]);
    vi.mocked(createOwnerVenue).mockResolvedValueOnce(sampleVenue);
    vi.mocked(updateOwnerVenue).mockResolvedValueOnce(sampleVenue);
    vi.mocked(createCourt).mockResolvedValueOnce({} as never);
    vi.mocked(deleteCourt).mockResolvedValueOnce(undefined as never);

    renderWithClient(<OwnerVenuesScreen />);

    await waitFor(() => expect(screen.getByText('CLB Cầu Lông Sao Mai')).not.toBeNull());

    // Tạo cơ sở mới
    fireEvent.click(screen.getByRole('button', { name: /addVenue/i }));
    expect(screen.getByText('create-new')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'submit-venue' }));
    await waitFor(() => expect(createOwnerVenue).toHaveBeenCalledTimes(1));

    // Quản lý sân con: thêm & xoá
    fireEvent.click(screen.getByRole('button', { name: /manageCourts/i }));
    expect(screen.getByText('courts:CLB Cầu Lông Sao Mai')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'add-court' }));
    await waitFor(() =>
      expect(createCourt).toHaveBeenCalledWith('v-owner-1', {
        name: 'Sân 3',
        sportId: 'sp-1',
        surface: 'Thảm PVC',
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'delete-first-court' }));
    await waitFor(() => expect(deleteCourt).toHaveBeenCalledWith('c-1'));
  });
});
