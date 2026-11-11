import { Injectable } from "@nestjs/common";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import {
  InjectDrizzle,
  type DrizzleDb,
} from "../../database/database.module.js";
import { notifications } from "../../database/schema/index.js";

export interface ListNotificationsOptions {
  userId: string;
  unreadOnly: boolean;
  type?: string;
  page: number;
  limit: number;
}

@Injectable()
export class NotificationsRepository {
  constructor(@InjectDrizzle() private readonly db: DrizzleDb) {}

  async list(options: ListNotificationsOptions) {
    const conditions = [eq(notifications.userId, options.userId)];
    if (options.unreadOnly) conditions.push(isNull(notifications.readAt));
    if (options.type) conditions.push(eq(notifications.type, options.type));
    const where = and(...conditions);

    const [totalResult] = await this.db
      .select({ count: count() })
      .from(notifications)
      .where(where);
    const total = Number(totalResult?.count ?? 0);

    const rows = await this.db
      .select()
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(options.limit)
      .offset((options.page - 1) * options.limit);

    return {
      data: rows,
      meta: {
        page: options.page,
        limit: options.limit,
        total,
        totalPages: Math.ceil(total / options.limit) || 1,
      },
    };
  }

  async countUnread(userId: string) {
    const [row] = await this.db
      .select({ count: count() })
      .from(notifications)
      .where(
        and(eq(notifications.userId, userId), isNull(notifications.readAt)),
      );
    return Number(row?.count ?? 0);
  }

  /** Chỉ đánh dấu được thông báo của chính mình — điều kiện `userId` nằm trong WHERE. */
  async markRead(userId: string, id: string) {
    const [row] = await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();
    return row ?? null;
  }

  async markAllRead(userId: string) {
    const rows = await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(eq(notifications.userId, userId), isNull(notifications.readAt)),
      )
      .returning({ id: notifications.id });
    return rows.length;
  }
}