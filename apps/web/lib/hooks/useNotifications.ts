'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/api/endpoints/notifications';
import { useAuth } from '@/lib/hooks/useAuth';

export const notificationKeys = {
  all: ['notifications'] as const,
  unreadCount: (userId: string | null) =>
    [...notificationKeys.all, userId, 'unread-count'] as const,
  list: (userId: string | null, limit: number) =>
    [...notificationKeys.all, userId, 'list', limit] as const,
};

/** Số thông báo chưa đọc cho badge ở topbar. */
export function useUnreadCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: notificationKeys.unreadCount(user?.id ?? null),
    queryFn: async () => (await getUnreadCount()).count,
    enabled: Boolean(user),
    staleTime: 30 * 1000,
  });
}

/** Danh sách thông báo mới nhất, chỉ tải khi mở dropdown. */
export function useNotificationList(limit = 8, enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: notificationKeys.list(user?.id ?? null, limit),
    queryFn: async () => (await listNotifications({ limit })).data,
    enabled: enabled && Boolean(user),
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
