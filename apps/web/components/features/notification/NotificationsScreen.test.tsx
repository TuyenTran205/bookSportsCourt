// @vitest-environment jsdom
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import type { Notification } from '@bsc/shared';

import { NotificationsScreen } from './NotificationsScreen';
import * as notificationEndpoints from '@/lib/api/endpoints/notifications';

const mockNotifications: Notification[] = [
  {
    id: 'notif-1',
    type: 'booking_confirmed',
    title: 'Đơn đặt sân đã được xác nhận',
    body: 'Sân Cầu Lông Thăng Long vào lúc 08:00 sáng mai.',
    readAt: null,
    createdAt: '2026-10-12T10:00:00.000Z',
    payload: { bookingId: 'b-1' },
  },
  {
    id: 'notif-2',
    type: 'payment_submitted',
    title: 'Biên lai thanh toán đã được tiếp nhận',
    body: 'Chủ sân đang đối soát biên lai 450.000đ của bạn.',
    readAt: '2026-10-11T12:00:00.000Z',
    createdAt: '2026-10-11T11:00:00.000Z',
    payload: { bookingId: 'b-1' },
  },
];

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'cust-1', fullName: 'Trần Văn Khách', role: 'customer' },
    isAuthenticated: true,
  }),
}));

vi.mock('@/lib/api/endpoints/notifications', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/endpoints/notifications')>();
  return {
    ...actual,
    getUnreadCount: vi.fn().mockImplementation(() => Promise.resolve({ count: 1 })),
    listNotifications: vi.fn().mockImplementation((params) => {
      let list = [...mockNotifications];
      if (params?.unreadOnly) {
        list = list.filter((n) => n.readAt === null);
      }
      return Promise.resolve({
        data: list,
        meta: { page: 1, limit: 10, total: list.length, totalPages: 1 },
      });
    }),
    markNotificationRead: vi.fn().mockImplementation((id: string) =>
      Promise.resolve({
        ...mockNotifications.find((n) => n.id === id),
        readAt: new Date().toISOString(),
      }),
    ),
    markAllNotificationsRead: vi.fn().mockImplementation(() =>
      Promise.resolve({ updated: 1 }),
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

describe('NotificationsScreen Component (TC-NOTIF)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC-NOTIF-01: render danh sách thông báo và số lượng chưa đọc', async () => {
    render(<NotificationsScreen />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Đơn đặt sân đã được xác nhận')).toBeDefined();
      expect(screen.getByText('Biên lai thanh toán đã được tiếp nhận')).toBeDefined();
      expect(screen.getByText(/unread \(1\)/)).toBeDefined();
    });
  });

  it('TC-NOTIF-02: chuyển đổi tab bộ lọc gọi API tương ứng', async () => {
    render(<NotificationsScreen />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/unread \(1\)/)).toBeDefined();
    });

    const unreadTab = screen.getByText(/unread \(1\)/);
    fireEvent.click(unreadTab);

    await waitFor(() => {
      expect(notificationEndpoints.listNotifications).toHaveBeenCalledWith(
        expect.objectContaining({ unreadOnly: true }),
      );
    });
  });

  it('TC-NOTIF-03: bấm nút "Đánh dấu tất cả đã đọc" gọi mutation thành công', async () => {
    render(<NotificationsScreen />, { wrapper: createWrapper() });

    await waitFor(() => {
      const markAllBtn = screen.getByRole('button', { name: /markAllRead/i });
      expect(markAllBtn.hasAttribute('disabled')).toBe(false);
    });

    const markAllBtn = screen.getByRole('button', { name: /markAllRead/i });
    fireEvent.click(markAllBtn);

    await waitFor(() => {
      expect(notificationEndpoints.markAllNotificationsRead).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('markAllSuccess');
    });
  });

  it('TC-NOTIF-04: trạng thái không có thông báo render EmptyState', async () => {
    vi.mocked(notificationEndpoints.listNotifications).mockImplementationOnce(() =>
      Promise.resolve({
        data: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
      }),
    );

    render(<NotificationsScreen />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('emptyTitle')).toBeDefined();
      expect(screen.getByText('emptyDesc')).toBeDefined();
    });
  });
});
