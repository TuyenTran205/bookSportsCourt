// @vitest-environment jsdom
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';

import { AdminReviewsScreen } from './AdminReviewsScreen';
import * as adminEndpoints from '@/lib/api/endpoints/admin';

const mockReviews: adminEndpoints.AdminReviewRow[] = [
  {
    id: 'rev-1',
    bookingId: 'b-1',
    venueId: 'v-1',
    customerId: 'u-1',
    customerName: 'Nguyễn Văn Khách',
    customerEmail: 'khach@example.com',
    venueName: 'Sân Cầu Lông Thăng Long',
    rating: 5,
    comment: 'Sân rất đẹp và sạch sẽ, nhân viên phục vụ tận tình.',
    ownerReply: 'Cảm ơn quý khách đã tin tưởng và ủng hộ!',
    ownerRepliedAt: '2026-10-10T10:00:00.000Z',
    createdAt: '2026-10-09T08:00:00.000Z',
    isVisible: true,
  },
  {
    id: 'rev-2',
    bookingId: 'b-2',
    venueId: 'v-2',
    customerId: 'u-2',
    customerName: 'Lê Thảo Vy',
    customerEmail: 'vy@example.com',
    venueName: 'Sân Bóng Đá Phú Thọ',
    rating: 1,
    comment: 'Chất lượng mặt cỏ kém, đèn sân bị nhấp nháy.',
    ownerReply: null,
    ownerRepliedAt: null,
    createdAt: '2026-10-08T09:00:00.000Z',
    isVisible: false,
    reportStatus: 'pending',
    reportReason: 'Khách hàng chưa đến sân nhưng đánh giá sai sự thật',
    reportImageUrl: 'https://example.com/proof.jpg',
  },
];

const mockVenues = [
  { id: 'v-1', name: 'Sân Cầu Lông Thăng Long' },
  { id: 'v-2', name: 'Sân Bóng Đá Phú Thọ' },
];

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    if (key === 'starCount' && values?.n) return `${values.n} sao`;
    return key;
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/api/endpoints/admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/endpoints/admin')>();
  return {
    ...actual,
    listAdminReviews: vi.fn().mockImplementation(() =>
      Promise.resolve({
        data: mockReviews,
        meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
      }),
    ),
    listAdminVenues: vi.fn().mockImplementation(() =>
      Promise.resolve({
        data: mockVenues,
        meta: { page: 1, limit: 100, total: 2, totalPages: 1 },
      }),
    ),
    setReviewVisibility: vi.fn().mockImplementation((id: string, isVisible: boolean) =>
      Promise.resolve({
        ...mockReviews.find((r) => r.id === id),
        isVisible,
      }),
    ),
    moderateReviewReport: vi.fn().mockImplementation((id: string, action: 'approve' | 'reject') =>
      Promise.resolve({
        ...mockReviews.find((r) => r.id === id),
        reportStatus: action === 'approve' ? 'resolved' : 'dismissed',
        isVisible: action === 'approve' ? false : mockReviews.find((r) => r.id === id)?.isVisible,
      }),
    ),
  };
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('AdminReviewsScreen Component (TC-REV)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC-REV-01: render bảng danh sách đánh giá từ API', async () => {
    render(<AdminReviewsScreen />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Nguyễn Văn Khách')).toBeDefined();
      expect(screen.getByText('Lê Thảo Vy')).toBeDefined();
      expect(screen.getAllByText('Sân Cầu Lông Thăng Long').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Sân Bóng Đá Phú Thọ').length).toBeGreaterThan(0);
      expect(screen.getByText(/Sân rất đẹp và sạch sẽ/)).toBeDefined();
      expect(screen.getByText('badgePublic')).toBeDefined();
      expect(screen.getByText('badgeHidden')).toBeDefined();
    });
  });

  it('TC-REV-02: lọc đánh giá theo số sao và tìm kiếm', async () => {
    render(<AdminReviewsScreen />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByLabelText('filterRating')).toBeDefined();
    });

    const ratingSelect = screen.getByLabelText('filterRating');
    fireEvent.change(ratingSelect, { target: { value: '5' } });

    await waitFor(() => {
      expect(adminEndpoints.listAdminReviews).toHaveBeenCalledWith(
        expect.objectContaining({ rating: 5 }),
      );
    });
  });

  it('TC-REV-03: bấm nút ẩn đánh giá mở Dialog xác nhận (không dùng window.confirm)', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    render(<AdminReviewsScreen />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Nguyễn Văn Khách')).toBeDefined();
    });

    const hideButtons = screen.getAllByRole('button', { name: /hideReview/i });
    fireEvent.click(hideButtons[0]!);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined();
      expect(screen.getByText('hideConfirmTitle')).toBeDefined();
      expect(screen.getByText('confirmHide')).toBeDefined();
    });

    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('TC-REV-04: xác nhận ẩn đánh giá gọi mutation thành công và hiển thị toast', async () => {
    render(<AdminReviewsScreen />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Nguyễn Văn Khách')).toBeDefined();
    });

    const hideButtons = screen.getAllByRole('button', { name: /hideReview/i });
    fireEvent.click(hideButtons[0]!);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined();
    });

    const confirmBtn = screen.getByRole('button', { name: /confirmHide/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(adminEndpoints.setReviewVisibility).toHaveBeenCalledWith('rev-1', false);
      expect(toast.success).toHaveBeenCalledWith('toggleSuccess');
    });
  });

  it('TC-REV-05: lọc theo "Bị chủ sân báo cáo" và duyệt báo cáo ẩn đánh giá', async () => {
    render(<AdminReviewsScreen />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/Khách hàng chưa đến sân/)).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /Bị chủ sân báo cáo/i }));
    await waitFor(() => {
      expect(adminEndpoints.listAdminReviews).toHaveBeenCalledWith(
        expect.objectContaining({ reportStatus: 'pending' }),
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /Duyệt & Ẩn/i }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /Xác nhận Duyệt & Ẩn/i }));
    await waitFor(() => {
      expect(adminEndpoints.moderateReviewReport).toHaveBeenCalledWith('rev-2', 'approve');
      expect(toast.success).toHaveBeenCalledWith('Đã duyệt báo cáo và ẩn đánh giá');
    });
  });
});
