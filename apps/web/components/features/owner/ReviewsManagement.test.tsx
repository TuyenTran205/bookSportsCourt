// @vitest-environment jsdom
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ReviewsManagement } from './ReviewsManagement';
import { useOwnerReviews } from '@/lib/hooks/useOwnerReviews';
import * as ownerEndpoints from '@/lib/api/endpoints/owner';

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

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/hooks/useOwnerReviews', () => ({
  useOwnerReviews: vi.fn(),
}));

vi.mock('@/lib/api/endpoints/owner', async (importOriginal) => {
  const actual = await importOriginal<typeof ownerEndpoints>();
  return {
    ...actual,
    replyToReview: vi.fn(),
    reportReview: vi.fn(),
  };
});

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const sampleReviews: ownerEndpoints.OwnerReview[] = [
  {
    id: 'rev-1',
    bookingId: 'bk-1',
    venueId: 'v-1',
    venueName: 'Sân Cầu Lông A',
    courtName: 'Sân 1',
    customerId: 'u-1',
    customerName: 'Nguyễn Minh',
    rating: 2,
    comment: 'Sân trơn',
    ownerReply: null,
    ownerRepliedAt: null,
    reportStatus: 'none',
    reportReason: null,
    reportImageUrl: null,
    reportedAt: null,
    createdAt: '2026-11-20T10:00:00Z',
  },
  {
    id: 'rev-2',
    bookingId: 'bk-2',
    venueId: 'v-1',
    venueName: 'Sân Cầu Lông A',
    courtName: 'Sân 1',
    customerId: 'u-2',
    customerName: 'Trần Lan',
    rating: 5,
    comment: 'Tuyệt vời',
    ownerReply: 'Cảm ơn bạn',
    ownerRepliedAt: '2026-11-21T10:00:00Z',
    reportStatus: 'pending',
    reportReason: 'Spam',
    reportImageUrl: null,
    reportedAt: '2026-11-21T11:00:00Z',
    createdAt: '2026-11-20T10:00:00Z',
  },
];

describe('ReviewsManagement (OWN-13)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useOwnerReviews).mockReturnValue({
      isLoading: false,
      isFetching: false,
      isError: false,
      data: {
        data: sampleReviews,
        meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
      },
    } as unknown as ReturnType<typeof useOwnerReviews>);
  });

  afterEach(() => {
    cleanup();
  });

  it('lọc tab Chưa phản hồi / Đã phản hồi, hiện badge báo cáo pending và gửi reply/report', async () => {
    vi.mocked(ownerEndpoints.replyToReview).mockResolvedValueOnce({} as unknown as ownerEndpoints.OwnerReview);
    vi.mocked(ownerEndpoints.reportReview).mockResolvedValueOnce({} as unknown as ownerEndpoints.OwnerReview);

    renderWithClient(<ReviewsManagement />);

    expect(screen.getByText('Nguyễn Minh')).not.toBeNull();
    expect(screen.getByText('Đang chờ Admin duyệt báo cáo')).not.toBeNull();

    // Đổi tab filter
    const unrepliedTab = screen.getByRole('tab', { name: 'reviewsUnreplied' });
    fireEvent.click(unrepliedTab);
    expect(useOwnerReviews).toHaveBeenLastCalledWith({ page: 1, limit: 10, replied: false });

    // Bấm nút Báo cáo cho review rev-1 (rev-2 đang pending nên không còn nút Báo cáo)
    const reportBtns = screen.getAllByRole('button', { name: /Báo cáo/i });
    expect(reportBtns.length).toBe(1);
    fireEvent.click(reportBtns[0]!);

    // Nhập lý do quá ngắn (< 5 ký tự) -> báo lỗi validate, chưa gọi API
    const reportTextbox = screen.getByRole('textbox');
    fireEvent.change(reportTextbox, { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: /Gửi báo cáo/i }));
    await waitFor(() => {
      expect(ownerEndpoints.reportReview).not.toHaveBeenCalled();
    });

    // Nhập lý do hợp lệ (>= 5 ký tự) -> gọi reportReview
    fireEvent.change(reportTextbox, { target: { value: 'Bình luận xúc phạm không đúng sự thật' } });
    fireEvent.click(screen.getByRole('button', { name: /Gửi báo cáo/i }));
    await waitFor(() => {
      expect(ownerEndpoints.reportReview).toHaveBeenCalledWith('rev-1', {
        reason: 'Bình luận xúc phạm không đúng sự thật',
        file: null,
      });
    });
  });
});
