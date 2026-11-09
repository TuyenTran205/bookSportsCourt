import { Injectable } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import { v7 } from "uuid";
import {
  InjectDrizzle,
  type DrizzleDb,
} from "../../database/database.module.js";
import { bookings, outboxDeliveries } from "../../database/schema/index.js";
import type { MailRequest } from "./mail.transport.js";

export type EmailJob = typeof outboxDeliveries.$inferSelect;
@Injectable()
export class EmailOutboxRepository {
  constructor(@InjectDrizzle() private readonly db: DrizzleDb) {}

  /** Operator-only retry: preserve request/key/window; ambiguous deliveries require provider reconciliation. */
  async retryFailed(id: string) {
    const result = await this.db
      .update(outboxDeliveries)
      .set({
        status: "pending",
        attempts: 0,
        nextAttemptAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(outboxDeliveries.id, id),
          eq(outboxDeliveries.channel, "email"),
          eq(outboxDeliveries.status, "failed"),
          sql`(first_attempt_at IS NULL OR first_attempt_at > now() - interval '23 hours')`,
        ),
      )
      .returning({ id: outboxDeliveries.id });
    return result.length > 0;
  }

  async claim() {
    return this.db.transaction(async (tx) => {
      const [job] = await tx
        .select()
        .from(outboxDeliveries)
        .where(
          sql`
        channel = 'email' AND (
          (status = 'pending' AND next_attempt_at <= now()) OR
          (status = 'processing' AND lease_expires_at <= now())
        )`,
        )
        .orderBy(outboxDeliveries.nextAttemptAt, outboxDeliveries.id)
        .limit(1)
        .for("update", { skipLocked: true });
      if (!job) return null;
      // A crashed process may already have reached the provider. Never replay after its key window.
      if (
        job.attempts >= 5 ||
        (job.firstAttemptAt &&
          job.firstAttemptAt.getTime() < Date.now() - 23 * 3600000)
      ) {
        await tx
          .update(outboxDeliveries)
          .set({
            status: "delivery_unknown",
            leaseToken: null,
            leaseExpiresAt: null,
            lastErrorCode: "RECONCILIATION_REQUIRED",
            updatedAt: new Date(),
          })
          .where(eq(outboxDeliveries.id, job.id));
        return { parked: true as const };
      }
      const [claimed] = await tx
        .update(outboxDeliveries)
        .set({
          status: "processing",
          attempts: job.attempts + 1,
          leaseToken: v7(),
          leaseExpiresAt: new Date(Date.now() + 120000),
          updatedAt: new Date(),
        })
        .where(eq(outboxDeliveries.id, job.id))
        .returning();
      return { parked: false as const, job: claimed! };
    });
  }

  async view(bookingId: string, paymentId?: string) {
    const rows = await this.db.execute<{
      customer_id: string | null;
      owner_id: string;
      venue_id: string;
      payment_id: string | null;
      status: string;
      payment_status: string | null;
      email: string;
      owner_email: string;
      customer_deleted: Date | null;
      owner_deleted: Date | null;
      venue_name: string;
      court_name: string;
      start: string;
      end: string;
      total_price: number;
      deposit_amount: number;
    }>(sql`SELECT b.customer_id, v.owner_id, v.id AS venue_id, p.id AS payment_id,
      b.status, p.status AS payment_status, u.email, o.email AS owner_email,
      u.deleted_at AS customer_deleted, o.deleted_at AS owner_deleted,
      v.name AS venue_name, c.name AS court_name, lower(b.during) AS start, upper(b.during) AS end,
      b.total_price, b.deposit_amount FROM bookings b JOIN courts c ON c.id = b.court_id
      JOIN venues v ON v.id = c.venue_id JOIN users o ON o.id = v.owner_id
      LEFT JOIN users u ON u.id = b.customer_id LEFT JOIN payments p ON p.booking_id = b.id AND p.id = ${paymentId ?? null}::uuid
      WHERE b.id = ${bookingId}`);
    return rows.rows[0];
  }

  async freeze(job: EmailJob, request: MailRequest) {
    const [updated] = await this.db
      .update(outboxDeliveries)
      .set({
        emailRequest: request,
        firstAttemptAt: job.firstAttemptAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(outboxDeliveries.id, job.id),
          eq(outboxDeliveries.leaseToken, job.leaseToken!),
          eq(outboxDeliveries.status, "processing"),
        ),
      )
      .returning();
    return updated;
  }

  async finish(
    job: EmailJob,
    status: string,
    code: string | null,
    reminderId?: string,
  ) {
    return this.db.transaction(async (tx) => {
      // Booking before outbox, matching the producer; stale leases roll this marker back as well.
      if (reminderId && status === "delivered") {
        await tx
          .update(bookings)
          .set({ remindersSentAt: sql`coalesce(reminders_sent_at, now())` })
          .where(eq(bookings.id, reminderId));
      }
      const result = await tx
        .update(outboxDeliveries)
        .set({
          status,
          lastErrorCode: code,
          leaseToken: null,
          leaseExpiresAt: null,
          deliveredAt: status === "delivered" ? new Date() : null,
          nextAttemptAt: new Date(
            Date.now() + [1, 5, 15, 60][Math.min(job.attempts - 1, 3)]! * 60000,
          ),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(outboxDeliveries.id, job.id),
            eq(outboxDeliveries.leaseToken, job.leaseToken!),
            eq(outboxDeliveries.status, "processing"),
          ),
        )
        .returning();
      if (!result.length && reminderId && status === "delivered")
        throw new Error("LEASE_LOST");
      return result.length > 0;
    });
  }
}
