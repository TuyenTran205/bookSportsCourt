import type { Notification } from '@bsc/shared';

import { apiFetch, apiFetchWithMeta } from '../client';

/**
 * Endpoint module – Thông báo.
 * Khớp `docs/11-api-contract.md` mục Notifications.
 */

export function listNotifications(params: { unreadOnly?: boolean; page?: number; limit?: number } = {}) {
  return apiFetchWithMeta<Notification[]>('/notifications', {
    query: {
      unreadOnly: params.unreadOnly ? 'true' : undefined,
      page: params.page,
      limit: params.limit,
    },
  });
}

/** Cho badge trên header — gọi lại theo sự kiện realtime. */
export function getUnreadCount() {
  return apiFetch<{ count: number }>('/notifications/unread-count');
}

export function markNotificationRead(id: string) {
  return apiFetch<Notification>(`/notifications/${encodeURIComponent(id)}/read`, {
    method: 'PATCH',
  });
}

export function markAllNotificationsRead() {
  return apiFetch<{ updated: number }>('/notifications/read-all', { method: 'POST' });
}
