'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/api/endpoints/notifications';

export const notificationKeys = {
  all: ['notifications'] as const,
  unreadCount: () => [...notificationKeys.all, 'unread-count'] as const,
  list: (limit: number) => [...notificationKeys.all, 'list', limit] as const,
};

/** Số thông báo chưa đọc cho badge ở topbar. */
export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: async () => (await getUnreadCount()).count,
    staleTime: 30 * 1000,
  });
}

/** Danh sách thông báo mới nhất, chỉ tải khi mở dropdown. */
export function useNotificationList(limit = 8, enabled = true) {
  return useQuery({
    queryKey: notificationKeys.list(limit),
    queryFn: async () => (await listNotifications({ limit })).data,
    enabled,
    staleTime: 15 * 1000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}
