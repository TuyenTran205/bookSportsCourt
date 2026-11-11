import { Injectable, NotFoundException } from "@nestjs/common";
import type { NotificationType } from "../../../../../packages/shared/src/constants.js";
import type { Notification } from "../../../../../packages/shared/src/types.js";
import {
  NotificationsRepository,
  type ListNotificationsOptions,
} from "./notifications.repository.js";

/** Bản ghi thô trong bảng `notifications`. */
interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  data: unknown;
  readAt: Date | null;
  createdAt: Date;
}

/**
 * Ánh xạ bản ghi DB → `Notification` dùng chung.
 * DB đặt tên cột `data`, hợp đồng API dùng `payload`.
 */
function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    type: row.type as NotificationType,
    title: row.title,
    body: row.body,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    payload: (row.data as Record<string, unknown> | null) ?? null,
  };
}

@Injectable()
export class NotificationsService {
  constructor(private readonly repo: NotificationsRepository) {}

  async list(options: ListNotificationsOptions) {
    const result = await this.repo.list(options);
    return {
      data: (result.data as NotificationRow[]).map(toNotification),
      meta: result.meta,
    };
  }

  async unreadCount(userId: string) {
    return { count: await this.repo.countUnread(userId) };
  }

  async markRead(userId: string, id: string) {
    const row = await this.repo.markRead(userId, id);
    if (!row) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Không tìm thấy thông báo.",
      });
    }
    return toNotification(row as NotificationRow);
  }

  async markAllRead(userId: string) {
    return { updated: await this.repo.markAllRead(userId) };
  }
}