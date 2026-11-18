import { Injectable } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import { v7 } from "uuid";

import {
  InjectDrizzle,
  type DrizzleDb,
} from "../../database/database.module.js";
import {
  notifications,
  outboxDeliveries,
} from "../../database/schema/index.js";

export type RealtimeOutboxJob = typeof outboxDeliveries.$inferSelect;

/**
 * Hàng đợi bền vững riêng cho kênh realtime (`outbox_deliveries.channel='realtime'`).
 * Producer (bookings/payments repository) ghi row trong cùng transaction nghiệp vụ;
 * consumer (RealtimeOutboxService) claim bằng SKIP LOCKED rồi phát qua Socket.IO.
 * Phát lại là an toàn (signal chỉ dùng để invalidate cache/refresh UI).
 */
@Injectable()
export class RealtimeOutboxRepository {
  constructor(@InjectDrizzle() private readonly db: DrizzleDb) {}

  /** Claim một job (pending hoặc lease đã hết hạn) bằng FOR UPDATE SKIP LOCKED. */
  async claim(): Promise<
    { parked: true } | { parked: false; job: RealtimeOutboxJob } | null
  > {
    return this.db.transaction(async (tx) => {
      const [job] = await tx
        .select()
        .from(outboxDeliveries)
        .where(
          sql`
            channel = 'realtime'
            AND (
              (status = 'pending' AND next_attempt_at <= now())
              OR (status = 'processing' AND lease_expires_at <= now())
            )
          `,
        )
        .orderBy(sql`next_attempt_at ASC NULLS FIRST, id ASC`)
        .limit(1)
        .for("update", { skipLocked: true });
      if (!job) return null;
      if (job.attempts >= 5) {
        // Quá 5 lần thử: sự kiện realtime là signal replay-an toàn nên bỏ qua,
        // trạng thái UI sẽ được đồng bộ lại bởi polling/refetch định kỳ.
        await tx
          .update(outboxDeliveries)
          .set({
            status: "failed",
            leaseToken: null,
            leaseExpiresAt: null,
            lastErrorCode: "REALTIME_MAX_ATTEMPTS",
            updatedAt: new Date(),
          })
          .where(eq(outboxDeliveries.id, job.id));
        return { parked: true };
      }
      const [claimed] = await tx
        .update(outboxDeliveries)
        .set({
          status: "processing",
          attempts: job.attempts + 1,
          leaseToken: v7(),
          leaseExpiresAt: new Date(Date.now() + 60_000),
          updatedAt: new Date(),
        })
        .where(eq(outboxDeliveries.id, job.id))
        .returning();
      return { parked: false, job: claimed! };
    });
  }

  /**
   * Xác thực recipient và lấy customerId cho event hướng owner
   * (booking_created cần gửi thêm cho khách qua room cá nhân).
   */
  async view(bookingId: string): Promise<{
    customerId: string | null;
    ownerId: string;
    venueId: string;
    customerDeleted: Date | null;
    ownerDeleted: Date | null;
  } | null> {
    const rows = await this.db.execute<{
      customer_id: string | null;
      owner_id: string;
      venue_id: string;
      customer_deleted: Date | null;
      owner_deleted: Date | null;
    }>(sql`
      SELECT b.customer_id, v.owner_id, v.id AS venue_id,
             cu.deleted_at AS customer_deleted, ou.deleted_at AS owner_deleted
      FROM bookings b
      JOIN courts c ON c.id = b.court_id
      JOIN venues v ON v.id = c.venue_id
      LEFT JOIN users cu ON cu.id = b.customer_id
      JOIN users ou ON ou.id = v.owner_id
      WHERE b.id = ${bookingId}
    `);
    const row = rows.rows[0];
    if (!row) return null;
    return {
      customerId: row.customer_id,
      ownerId: row.owner_id,
      venueId: row.venue_id,
      customerDeleted: row.customer_deleted,
      ownerDeleted: row.owner_deleted,
    };
  }

  /** Notification đồng bộ sự kiện (payment_submitted / booking_cancelled) để mirror room cá nhân. */
  async viewNotification(eventKey: string, userId: string): Promise<{
    id: string;
    type: string;
    title: string;
  } | null> {
    const [row] = await this.db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
      })
      .from(notifications)
      .where(
        and(
          eq(notifications.eventKey, eventKey),
          eq(notifications.userId, userId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /** Chốt kết quả; guard lease để crash/cron trùng không ghi đè lẫn nhau. */
  async finish(
    job: RealtimeOutboxJob,
    status: "delivered" | "pending" | "failed",
    code: string | null,
  ): Promise<boolean> {
    const backoffMinutes = [1, 5, 15, 60];
    return this.db.transaction(async (tx) => {
      const result = await tx
        .update(outboxDeliveries)
        .set({
          status,
          lastErrorCode: code,
          leaseToken: null,
          leaseExpiresAt: null,
          deliveredAt: status === "delivered" ? new Date() : null,
          nextAttemptAt: new Date(
            Date.now() +
              backoffMinutes[Math.min(job.attempts - 1, 3)]! * 60_000,
          ),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(outboxDeliveries.id, job.id),
            eq(outboxDeliveries.leaseToken, job.leaseToken ?? sql`NULL`),
            eq(outboxDeliveries.status, "processing"),
          ),
        )
        .returning({ id: outboxDeliveries.id });
      if (result.length === 0) throw new Error("LEASE_LOST");
      return true;
    });
  }
}
