import { http } from 'msw';
import type { Notification } from '@bsc/shared';

import { currentUser, db, persist, type MockNotification } from '../db';
import { err, ok, okList, paginate, readPaging, simulateLatency } from '../utils';

function toPublicNotification(notification: MockNotification): Notification {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
    payload: notification.payload,
  };
}

export function getUserNotifications(userId: string, unreadOnly = false): Notification[] {
  return db.notifications
    .filter(
      (notification) =>
        notification.userId === userId && (!unreadOnly || notification.readAt === null),
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map(toPublicNotification);
}

export function countUnreadNotifications(userId: string): number {
  return db.notifications.filter(
    (notification) => notification.userId === userId && notification.readAt === null,
  ).length;
}

export function markUserNotificationRead(
  userId: string,
  notificationId: string,
): Notification | undefined {
  const notification = db.notifications.find(
    (item) => item.id === notificationId && item.userId === userId,
  );
  if (!notification) return undefined;

  notification.readAt ??= new Date().toISOString();
  persist();
  return toPublicNotification(notification);
}

export function markAllUserNotificationsRead(userId: string): number {
  const now = new Date().toISOString();
  let updated = 0;
  for (const notification of db.notifications) {
    if (notification.userId === userId && notification.readAt === null) {
      notification.readAt = now;
      updated += 1;
    }
  }
  if (updated > 0) persist();
  return updated;
}

/**
 * Thông báo trong ứng dụng — docs/11-api-contract.md mục Notifications.
 */

export const notificationHandlers = [
  /** `GET /notifications?unreadOnly=&page=&limit=` */
  http.get('/api/v1/notifications', async ({ request }) => {
    await simulateLatency(200);
    const user = currentUser();
    if (!user) return err(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');
    const url = new URL(request.url);
    const { page, limit } = readPaging(url);
    const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
    const { data, meta } = paginate(getUserNotifications(user.id, unreadOnly), page, limit);
    return okList(data, meta);
  }),

  /** `GET /notifications/unread-count` — cho badge trên header. */
  http.get('/api/v1/notifications/unread-count', async () => {
    await simulateLatency(120);
    const user = currentUser();
    if (!user) return err(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');
    const count = countUnreadNotifications(user.id);
    return ok({ count });
  }),

  /** `PATCH /notifications/:id/read` */
  http.patch('/api/v1/notifications/:id/read', async ({ params }) => {
    await simulateLatency(150);
    const user = currentUser();
    if (!user) return err(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');
    const notificationId =
      typeof params.id === 'string' ? params.id : params.id?.[0];
    if (!notificationId) {
      return err(404, 'NOT_FOUND', 'Không tìm thấy thông báo');
    }
    const notification = markUserNotificationRead(user.id, notificationId);
    if (!notification) {
      return err(404, 'NOT_FOUND', 'Không tìm thấy thông báo');
    }
    return ok(notification);
  }),

  /** `POST /notifications/read-all` */
  http.post('/api/v1/notifications/read-all', async () => {
    await simulateLatency(250);
    const user = currentUser();
    if (!user) return err(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');
    const updated = markAllUserNotificationsRead(user.id);
    return ok({ updated });
  }),
];

export type { Notification };
