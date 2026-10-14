import { http } from 'msw';
import type { Notification } from '@bsc/shared';

import { db, persist } from '../db';
import { err, ok, okList, paginate, readPaging, simulateLatency } from '../utils';

/**
 * Thông báo trong ứng dụng — docs/11-api-contract.md mục Notifications.
 *
 * Mock dùng chung một "hộp thư" cho mọi vai trò; đủ để header, badge số chưa
 * đọc và trang thông báo chạy đúng luồng.
 */

export const notificationHandlers = [
  /** `GET /notifications?unreadOnly=&page=&limit=` */
  http.get('/api/v1/notifications', async ({ request }) => {
    await simulateLatency(200);
    const url = new URL(request.url);
    const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
    const { page, limit } = readPaging(url);

    const all = [...db.notifications].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const filtered = unreadOnly ? all.filter((n) => n.readAt === null) : all;

    const { data, meta } = paginate(filtered, page, limit);
    return okList(data, meta);
  }),

  /** `GET /notifications/unread-count` — cho badge trên header. */
  http.get('/api/v1/notifications/unread-count', async () => {
    await simulateLatency(120);
    const count = db.notifications.filter((n) => n.readAt === null).length;
    return ok({ count });
  }),

  /** `PATCH /notifications/:id/read` */
  http.patch('/api/v1/notifications/:id/read', async ({ params }) => {
    await simulateLatency(150);
    const notification = db.notifications.find((n) => n.id === params.id);
    if (!notification) {
      return err(404, 'NOT_FOUND', 'Không tìm thấy thông báo');
    }
    // Đã đọc rồi thì giữ nguyên mốc thời gian cũ, không ghi đè.
    notification.readAt ??= new Date().toISOString();
    persist();
    return ok(notification);
  }),

  /** `POST /notifications/read-all` */
  http.post('/api/v1/notifications/read-all', async () => {
    await simulateLatency(250);
    const now = new Date().toISOString();
    let updated = 0;
    for (const n of db.notifications) {
      if (n.readAt === null) {
        n.readAt = now;
        updated += 1;
      }
    }
    persist();
    return ok({ updated });
  }),
];

export type { Notification };
