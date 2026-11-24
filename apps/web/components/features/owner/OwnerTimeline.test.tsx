// @vitest-environment jsdom
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OwnerTimeline } from './OwnerTimeline';
import * as ownerEndpoints from '@/lib/api/endpoints/owner';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({ role: 'owner' }),
}));

vi.mock('@/lib/hooks/useOwnerRealtime', () => ({
  useOwnerRealtime: vi.fn(),
}));

vi.mock('@/components/common/SocketProvider', () => ({
  useOptionalSocket: () => null,
}));

vi.mock('@/lib/api/endpoints/owner', async (importOriginal) => {
  const actual = await importOriginal<typeof ownerEndpoints>();
  return {
    ...actual,
    listOwnerVenues: vi.fn(),
    getOwnerTimeline: vi.fn(),
    createBlackout: vi.fn(),
    deleteBlackout: vi.fn(),
    createManualBooking: vi.fn(),
  };
});

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

describe('OwnerTimeline (OWN-06, OWN-07, OWN-08 & P2 Mobile Zoom)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'innerWidth', { value: 360, writable: true });
    vi.mocked(ownerEndpoints.listOwnerVenues).mockResolvedValue([
      {
        id: 'venue-1',
        ownerId: 'owner-1',
        name: 'Sân Cầu Lông Thăng Long',
        slug: 'thang-long',
        address: 'Hà Nội',
        provinceId: 'p-1',
        districtId: 'd-1',
        province: null,
        district: null,
        lat: 21.03,
        lng: 105.78,
        description: null,
        status: 'approved',
        ratingAvg: 5,
        reviewCount: 1,
        coverUrl: null,
        fromPrice: 100000,
        sports: [],
        amenities: [],
        images: [],
        courts: [],
        openingHours: [],
        cancellationPolicy: null,
      },
    ]);

    vi.mocked(ownerEndpoints.getOwnerTimeline).mockResolvedValue({
      date: todayStr,
      venueId: 'venue-1',
      courts: [{ id: 'court-1', name: 'Sân 1', sportId: null, description: null, status: 'active' }],
      bookings: [
        {
          id: 'bk-1',
          courtId: 'court-1',
          during: { start: `${todayStr}T08:00:00+07:00`, end: `${todayStr}T09:00:00+07:00` },
          status: 'confirmed',
          source: 'manual',
          guestName: 'Anh Hải',
          customerName: 'Anh Hải',
          totalPrice: 200000,
        },
      ],
      blackouts: [
        {
          id: 'bo-1',
          courtId: 'court-1',
          start: `${todayStr}T10:00:00+07:00`,
          end: `${todayStr}T11:00:00+07:00`,
          reason: 'Thay đèn LED',
          createdAt: '2026-11-24T00:00:00Z',
        },
      ],
      openingHours: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
        id: `oh-${weekday}`,
        venueId: 'venue-1',
        courtId: null,
        weekday,
        openTime: '06:00',
        closeTime: '22:00',
        isClosed: false,
      })),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('hiển thị booking & blackout trên timeline, xem chi tiết, mở khoá blackout và tạo blackout mới', async () => {
    vi.mocked(ownerEndpoints.deleteBlackout).mockResolvedValueOnce({ success: true });
    vi.mocked(ownerEndpoints.createBlackout).mockResolvedValueOnce({
      id: 'bo-2',
      courtId: 'court-1',
      start: `${todayStr}T12:00:00+07:00`,
      end: `${todayStr}T13:00:00+07:00`,
      reason: 'Bảo trì thảm',
      createdAt: '2026-11-24T00:00:00Z',
    });

    renderWithClient(<OwnerTimeline />);

    await waitFor(() => {
      expect(screen.getByText('Sân 1')).not.toBeNull();
    });

    // Mobile zoom controls (P2 responsive) hoạt động
    fireEvent.click(screen.getByRole('button', { name: 'Phóng to block' }));
    fireEvent.click(screen.getByRole('button', { name: 'Thu nhỏ block' }));
    fireEvent.click(screen.getByRole('button', { name: 'Vừa màn' }));

    // Click vào ô bị khoá (blackout) -> hiện panel chi tiết & mở khoá
    const blackoutCell = document.querySelector('[title="Thay đèn LED"]') as HTMLElement;
    expect(blackoutCell).not.toBeNull();
    fireEvent.click(blackoutCell);
    expect(screen.getByText('blackoutDetail')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /unlockCourt/i }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).not.toBeNull();
    });
    // Confirm unlock inside Dialog
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /unlockCourt/i }));

    await waitFor(() => {
      expect(ownerEndpoints.deleteBlackout).toHaveBeenCalledWith('court-1', 'bo-1');
    });

    // Mở modal tạo blackout mới
    fireEvent.click(screen.getByRole('button', { name: 'blackout' }));
    expect(screen.getByText('blackoutDialogTitle')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'blackoutSubmit' }));

    await waitFor(() => {
      expect(ownerEndpoints.createBlackout).toHaveBeenCalledWith(
        'court-1',
        expect.objectContaining({
          start: expect.stringContaining('+07:00'),
          end: expect.stringContaining('+07:00'),
        }),
      );
    });
  });
});
