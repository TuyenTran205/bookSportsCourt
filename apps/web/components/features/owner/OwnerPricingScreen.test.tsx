// @vitest-environment jsdom
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OpeningHour, PricingRule, VenueDetail } from '@bsc/shared';

import { OwnerPricingScreen } from './OwnerPricingScreen';
import {
  createPricingRule,
  deletePricingRule,
  getOpeningHours,
  listOwnerVenues,
  listPricingRules,
  replaceOpeningHours,
} from '@/lib/api/endpoints/owner';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/api/endpoints/owner', () => ({
  listOwnerVenues: vi.fn(),
  getOpeningHours: vi.fn(),
  replaceOpeningHours: vi.fn(),
  listPricingRules: vi.fn(),
  createPricingRule: vi.fn(),
  deletePricingRule: vi.fn(),
}));

vi.mock('./PricingRuleDialog', () => ({
  PricingRuleDialog: ({
    open,
    onSubmit,
  }: {
    open: boolean;
    onSubmit: (input: Record<string, unknown>) => void;
  }) =>
    open ? (
      <div role="dialog" aria-label="pricing-rule-dialog">
        <button
          type="button"
          onClick={() =>
            onSubmit({
              courtId: null,
              label: 'Giờ vàng tối',
              weekdays: [1, 2, 3],
              startTime: '17:00',
              endTime: '21:00',
              pricePerSlot: 80000,
            })
          }
        >
          save-new-rule
        </button>
      </div>
    ) : null,
}));

const sampleVenue = {
  id: 'v-price-1',
  name: 'CLB Bắc Từ Liêm',
  address: '45 Cổ Nhuế',
  courts: [{ id: 'c-1', name: 'Sân 1', venueId: 'v-price-1', sportId: 's-1', isActive: true }],
} as unknown as VenueDetail;

const sampleHours: OpeningHour[] = [1, 2, 3, 4, 5, 6, 0].map((weekday) => ({
  id: `oh-${weekday}`,
  venueId: 'v-price-1',
  courtId: null,
  weekday,
  openTime: '06:00',
  closeTime: '22:00',
  isClosed: false,
}));

const sampleRules: PricingRule[] = [
  {
    id: 'pr-1',
    venueId: 'v-price-1',
    courtId: null,
    label: 'Giờ thường ngày',
    weekdays: [1, 2, 3, 4, 5],
    startTime: '06:00',
    endTime: '17:00',
    pricePerSlot: 50000,
  },
];

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('OwnerPricingScreen (OWN-04, OWN-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('hiển thị EmptyState khi chủ sân chưa có cơ sở nào', async () => {
    vi.mocked(listOwnerVenues).mockResolvedValueOnce([]);
    renderWithClient(<OwnerPricingScreen />);
    await waitFor(() => expect(screen.getByText('noVenuesForPricingTitle')).not.toBeNull());
  });

  it('lưu khung giờ mở cửa hợp lệ và quản lý bảng giá (tạo & xoá pricing rule)', async () => {
    vi.mocked(listOwnerVenues).mockResolvedValue([sampleVenue]);
    vi.mocked(getOpeningHours).mockResolvedValue(sampleHours);
    vi.mocked(replaceOpeningHours).mockResolvedValueOnce(sampleHours);
    vi.mocked(listPricingRules).mockResolvedValue(sampleRules);
    vi.mocked(createPricingRule).mockResolvedValueOnce(sampleRules[0]!);
    vi.mocked(deletePricingRule).mockResolvedValueOnce(undefined as never);

    renderWithClient(<OwnerPricingScreen />);

    await waitFor(() => {
      const saveBtn = screen.getByRole('button', { name: /saveHours/i }) as HTMLButtonElement;
      expect(saveBtn.disabled).toBe(false);
    });

    // Lưu giờ mở cửa mặc định 7 ngày
    fireEvent.click(screen.getByRole('button', { name: /saveHours/i }));
    await waitFor(() => expect(replaceOpeningHours).toHaveBeenCalledTimes(1));

    // Chuyển sang tab Bảng giá
    fireEvent.click(screen.getByRole('tab', { name: /pricingRulesTab/i }));
    await waitFor(() => expect(screen.getAllByText('Giờ thường ngày').length).toBeGreaterThan(0));

    // Thêm quy tắc giá mới
    fireEvent.click(screen.getByRole('button', { name: /addPricingRule/i }));
    fireEvent.click(screen.getByRole('button', { name: 'save-new-rule' }));
    await waitFor(() => expect(createPricingRule).toHaveBeenCalledTimes(1));

    // Xoá quy tắc giá: nhấn nút thùng rác -> xác nhận
    const deleteButtons = screen.getAllByRole('button', { name: 'deletePricingRuleNamed' });
    fireEvent.click(deleteButtons[0]!);
    const confirmDeleteBtns = screen.getAllByRole('button', { name: 'confirmDeleteRule' });
    fireEvent.click(confirmDeleteBtns[0]!);
    await waitFor(() => expect(deletePricingRule).toHaveBeenCalledWith('pr-1', null));
  });
});
