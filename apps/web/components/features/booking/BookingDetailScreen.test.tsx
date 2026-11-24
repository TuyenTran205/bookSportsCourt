// @vitest-environment jsdom
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookingDetail } from '@bsc/shared';

import { BookingDetailScreen } from './BookingDetailScreen';
import {
  useBookingDetail,
  useCancelBooking,
  useCancellationPreview,
  useCreateReview,
  useHoldInfo,
} from '@/lib/hooks/useBookings';

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

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'booking-1' }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/components/features/booking/PaymentPanel', () => ({
  PaymentPanel: ({ bookingId, onExpired }: { bookingId: string; onExpired?: () => void }) => (
    <div data-testid="payment-panel">
      <span>PaymentPanel:{bookingId}</span>
      <button type="button" onClick={onExpired}>
        trigger-expire
      </button>
    </div>
  ),
}));

vi.mock('@/lib/hooks/useBookings', () => ({
  bookingKeys: { all: ['bookings'] },
  useBookingDetail: vi.fn(),
  useHoldInfo: vi.fn(),
  useCancellationPreview: vi.fn(),
  useCancelBooking: vi.fn(),
  useCreateReview: vi.fn(),
}));

const baseBooking: BookingDetail = {
  id: 'booking-1',
  courtId: 'court-1',
  customerId: 'user-1',
  source: 'online',
  during: {
    start: '2026-11-30T10:00:00+07:00',
    end: '2026-11-30T11:00:00+07:00',
  },
  status: 'confirmed',
  totalPrice: 200000,
  depositAmount: 100000,
  expiresAt: null,
  guestName: null,
  guestPhone: null,
  note: null,
  cancelledAt: null,
  cancelReason: null,
  createdAt: '2026-11-24T08:00:00+07:00',
  court: {
    id: 'court-1',
    name: 'Sân 1',
    venue: {
      id: 'venue-1',
      name: 'Sân Cầu Lông Thăng Long',
      slug: 'thang-long',
      address: 'Hà Nội',
    },
  },
  customer: { id: 'user-1', fullName: 'Khách A', phone: '090***123', email: 'khach@example.com' },
  payment: {
    id: 'pay-1',
    amount: 100000,
    provider: 'bank_transfer',
    transferCode: 'BSC123',
    status: 'completed',
    proofUrl: null,
    proofUploadedAt: null,
    paidAt: '2026-11-24T08:05:00+07:00',
    rejectReason: null,
    reviewedBy: null,
    refundAmount: null,
  },
  review: null,
};

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('BookingDetailScreen (CUS-08..CUS-13)', () => {
  const mockCancelMutate = vi.fn();
  const mockReviewMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useHoldInfo).mockReturnValue({ data: undefined } as unknown as ReturnType<typeof useHoldInfo>);
    vi.mocked(useCancelBooking).mockReturnValue({
      mutateAsync: mockCancelMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useCancelBooking>);
    vi.mocked(useCreateReview).mockReturnValue({
      mutateAsync: mockReviewMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useCreateReview>);
  });

  afterEach(() => {
    cleanup();
  });

  it('khoá nút huỷ sân khi quá hạn cancellation-preview (canCancel=false)', () => {
    vi.mocked(useBookingDetail).mockReturnValue({
      isLoading: false,
      isError: false,
      data: baseBooking,
    } as unknown as ReturnType<typeof useBookingDetail>);
    vi.mocked(useCancellationPreview).mockReturnValue({
      data: {
        canCancel: false,
        cancelBeforeHours: 24,
        deadline: '2026-11-29T10:00:00+07:00',
        refundPercent: 100,
        refundAmount: 0,
      },
    } as unknown as ReturnType<typeof useCancellationPreview>);

    renderWithClient(<BookingDetailScreen />);
    const cancelBtn = screen.getByRole('button', { name: 'cancel' }) as HTMLButtonElement;
    expect(cancelBtn.disabled).toBe(true);
    expect(screen.getByText(/Đã quá hạn huỷ trước 24 giờ/i)).not.toBeNull();
  });

  it('cho phép mở dialog và xác nhận huỷ đơn kèm lý do khi còn trong hạn', async () => {
    mockCancelMutate.mockResolvedValueOnce({});
    vi.mocked(useBookingDetail).mockReturnValue({
      isLoading: false,
      isError: false,
      data: baseBooking,
    } as unknown as ReturnType<typeof useBookingDetail>);
    vi.mocked(useCancellationPreview).mockReturnValue({
      data: {
        canCancel: true,
        cancelBeforeHours: 24,
        deadline: '2026-11-29T10:00:00+07:00',
        refundPercent: 100,
        refundAmount: 100000,
      },
    } as unknown as ReturnType<typeof useCancellationPreview>);

    renderWithClient(<BookingDetailScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }));

    const reasonInput = screen.getByRole('textbox');
    fireEvent.change(reasonInput, { target: { value: 'Bận đột xuất' } });
    fireEvent.click(screen.getByRole('button', { name: 'confirmCancel' }));

    await waitFor(() => {
      expect(mockCancelMutate).toHaveBeenCalledWith({ id: 'booking-1', reason: 'Bận đột xuất' });
    });
  });

  it('hiển thị PaymentPanel + link checkout khi trạng thái là held', () => {
    vi.mocked(useBookingDetail).mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        ...baseBooking,
        status: 'held',
        expiresAt: '2026-11-24T08:10:00+07:00',
      },
    } as unknown as ReturnType<typeof useBookingDetail>);
    vi.mocked(useHoldInfo).mockReturnValue({
      data: {
        payment: { id: 'pay-1', amount: 100000, transferCode: 'BSC123', bankAccount: null },
      },
    } as unknown as ReturnType<typeof useHoldInfo>);
    vi.mocked(useCancellationPreview).mockReturnValue({ data: undefined } as unknown as ReturnType<
      typeof useCancellationPreview
    >);

    renderWithClient(<BookingDetailScreen />);
    expect(screen.getByTestId('payment-panel')).not.toBeNull();
    expect(screen.getByRole('link', { name: /Mở trang thanh toán riêng/i }).getAttribute('href')).toBe(
      '/checkout/booking-1',
    );
  });

  it('hiển thị form đánh giá khi completed chưa review, kiểm tra chọn sao và gửi đánh giá', async () => {
    mockReviewMutate.mockResolvedValueOnce({});
    vi.mocked(useBookingDetail).mockReturnValue({
      isLoading: false,
      isError: false,
      data: { ...baseBooking, status: 'completed', review: null },
    } as unknown as ReturnType<typeof useBookingDetail>);
    vi.mocked(useCancellationPreview).mockReturnValue({ data: undefined } as unknown as ReturnType<
      typeof useCancellationPreview
    >);

    renderWithClient(<BookingDetailScreen />);
    // Bấm gửi khi chưa chọn sao -> báo lỗi pickRating
    fireEvent.click(screen.getByRole('button', { name: 'sendReview' }));
    expect(screen.getByRole('alert').textContent).toContain('pickRating');
    expect(mockReviewMutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('radio', { name: '5/5' }));
    fireEvent.change(screen.getByLabelText('comment'), { target: { value: 'Sân rất sạch đẹp' } });
    fireEvent.click(screen.getByRole('button', { name: 'sendReview' }));

    await waitFor(() => {
      expect(mockReviewMutate).toHaveBeenCalledWith({
        bookingId: 'booking-1',
        rating: 5,
        comment: 'Sân rất sạch đẹp',
      });
    });
  });
});
