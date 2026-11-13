// @vitest-environment jsdom
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const useOwnerPaymentsMock = vi.fn();

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    if (values && 'count' in values) return `${key}:${values.count}`;
    return key;
  },
}));

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt ?? ''} />
  ),
}));

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({ role: 'owner' }),
}));

vi.mock('@/lib/hooks/useOwnerPayments', () => ({
  useOwnerPayments: (...args: unknown[]) => useOwnerPaymentsMock(...args),
}));

import { PaymentsManagement } from './PaymentsManagement';

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('PaymentsManagement', () => {
  afterEach(() => {
    cleanup();
    useOwnerPaymentsMock.mockReset();
  });

  it('gửi status="all" khi chọn bộ lọc Tất cả và hiển thị giao dịch đã duyệt', () => {
    useOwnerPaymentsMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        data: [
          {
            id: 'pay-1',
            bookingId: 'bk-1',
            amount: 140000,
            provider: 'bank_transfer',
            transferCode: 'BSC-001',
            proofUrl: null,
            proofUploadedAt: '2026-11-12T10:00:00Z',
            status: 'completed',
            rejectReason: null,
            booking: {
              id: 'bk-1',
              during: {
                start: '2026-11-12T11:00:00Z',
                end: '2026-11-12T12:00:00Z',
              },
              status: 'confirmed',
              totalPrice: 280000,
              courtName: 'Sân số 1',
              venueName: 'Sân Cầu Lông Cầu Giấy',
              customerName: 'Nguyễn Văn A',
              customerPhone: '0901234567',
            },
          },
        ],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
    });

    renderWithQuery(<PaymentsManagement />);

    expect(useOwnerPaymentsMock).toHaveBeenCalledWith('all', 1, 10, true);
    expect(screen.getByText('Nguyễn Văn A')).toBeTruthy();
    expect(screen.getByText('Sân Cầu Lông Cầu Giấy')).toBeTruthy();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'completed' } });
    expect(useOwnerPaymentsMock).toHaveBeenLastCalledWith('completed', 1, 10, true);
  });
});
