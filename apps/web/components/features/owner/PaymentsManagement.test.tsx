// @vitest-environment jsdom
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const useOwnerPaymentsMock = vi.fn();
const approvePaymentMock = vi.fn();
const rejectPaymentMock = vi.fn();

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

vi.mock('@/lib/api/endpoints/owner', () => ({
  approvePayment: (...args: unknown[]) => approvePaymentMock(...args),
  rejectPayment: (...args: unknown[]) => rejectPaymentMock(...args),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
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
    expect(screen.getAllByText('Nguyễn Văn A').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sân Cầu Lông Cầu Giấy').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'completed' } });
    expect(useOwnerPaymentsMock).toHaveBeenLastCalledWith('completed', 1, 10, true);
  });

  it('mở modal minh chứng cho giao dịch submitted, cho phép duyệt và từ chối kèm lý do', async () => {
    approvePaymentMock.mockResolvedValueOnce({});
    rejectPaymentMock.mockResolvedValueOnce({});
    useOwnerPaymentsMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        data: [
          {
            id: 'pay-sub-1',
            bookingId: 'bk-sub-1',
            amount: 150000,
            provider: 'bank_transfer',
            transferCode: 'BSC-SUB-01',
            proofUrl: 'https://example.com/proof.png',
            proofUploadedAt: '2026-11-12T10:00:00Z',
            status: 'submitted',
            rejectReason: null,
            booking: {
              id: 'bk-sub-1',
              during: {
                start: '2026-11-12T11:00:00Z',
                end: '2026-11-12T12:00:00Z',
              },
              status: 'pending_payment',
              totalPrice: 300000,
              courtName: 'Sân 2',
              venueName: 'Sân Thăng Long',
              customerName: 'Lê Thị B',
              customerPhone: '0987654321',
            },
          },
        ],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
    });

    renderWithQuery(<PaymentsManagement />);

    // Mở dialog đối chiếu (có 2 nút viewProof ở mobile card + desktop table)
    fireEvent.click(screen.getAllByRole('button', { name: 'viewProof' })[0]!);
    expect(screen.getByText('BSC-SUB-01')).not.toBeNull();

    // Duyệt thanh toán (approve thành công sẽ đóng dialog)
    fireEvent.click(screen.getByRole('button', { name: 'approve' }));
    await waitFor(() => {
      expect(approvePaymentMock).toHaveBeenCalledWith('pay-sub-1', expect.anything());
    });

    // Mở lại dialog để kiểm tra luồng từ chối kèm lý do bắt buộc
    fireEvent.click(screen.getAllByRole('button', { name: 'viewProof' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'reject' }));
    const confirmRejectBtn = screen.getByRole('button', { name: 'rejectConfirm' }) as HTMLButtonElement;
    expect(confirmRejectBtn.disabled).toBe(true);

    fireEvent.change(document.getElementById('payment-reject-reason')!, {
      target: { value: 'Sai nội dung chuyển khoản' },
    });
    expect(confirmRejectBtn.disabled).toBe(false);
    fireEvent.click(confirmRejectBtn);

    await waitFor(() => {
      expect(rejectPaymentMock).toHaveBeenCalledWith('pay-sub-1', 'Sai nội dung chuyển khoản');
    });
  });
});
