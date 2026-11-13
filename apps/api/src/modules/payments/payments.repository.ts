import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { and, asc, desc, eq, inArray, sql, gt } from "drizzle-orm";
import type { OwnerPaymentQueryInput } from "../../../../../packages/shared/src/phase4-schemas.js";
import { writeAudit } from "../audit/audit-writer.js";
import {
  InjectDrizzle,
  type DrizzleDb,
} from "../../database/database.module.js";
import {
  bookings,
  courts,
  payments,
  venues,
  storageCleanupJobs,
  outboxDeliveries,
  notifications,
  users,
} from "../../database/schema/index.js";
import type { AuthTransaction } from "../auth/auth.repository.js";

@Injectable()
export class PaymentsRepository {
  constructor(@InjectDrizzle() private readonly db: DrizzleDb) {}
  transaction<T>(work: (tx: AuthTransaction) => Promise<T>) {
    return this.db.transaction(work);
  }
  async byId(
    id: string,
    tx: AuthTransaction | DrizzleDb = this.db,
    lock = false,
  ) {
    const query = tx.select().from(payments).where(eq(payments.id, id));
    const [payment] = await (lock ? query.for("update") : query);
    return payment;
  }
  async ownerList(ownerId: string, query: OwnerPaymentQueryInput) {
    return this.db.transaction(
      async (tx) => {
        const scope = and(
          eq(venues.ownerId, ownerId),
          query.status && query.status !== "all"
            ? eq(payments.status, query.status)
            : undefined,
          query.venueId ? eq(venues.id, query.venueId) : undefined,
        );
        const counts = await tx
          .select({ total: sql<number>`count(*)::int` })
          .from(payments)
          .innerJoin(bookings, eq(bookings.id, payments.bookingId))
          .innerJoin(courts, eq(courts.id, bookings.courtId))
          .innerJoin(venues, eq(venues.id, courts.venueId))
          .where(scope);
        const total = counts[0]!.total;
        const offset = (query.page - 1) * query.limit;
        if (!Number.isSafeInteger(offset) || offset >= total!)
          return { total: total!, rows: [] };
        const rows = await tx
          .select({
            payment: payments,
            booking: bookings,
            court: courts,
            venue: venues,
            start: sql`lower(${bookings.during})`.mapWith(
              (value) => new Date(String(value)),
            ),
            end: sql`upper(${bookings.during})`.mapWith(
              (value) => new Date(String(value)),
            ),
          })
          .from(payments)
          .innerJoin(bookings, eq(bookings.id, payments.bookingId))
          .innerJoin(courts, eq(courts.id, bookings.courtId))
          .innerJoin(venues, eq(venues.id, courts.venueId))
          .where(scope)
          .orderBy(desc(payments.createdAt), desc(payments.id))
          .limit(query.limit)
          .offset(offset);
        return { total: total!, rows };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
  async reviewCandidates(after: string | undefined, limit: number) {
    // Scan submitted rows in bounded keyset pages, including malformed legacy rows.
    return this.db
      .select({ id: payments.id })
      .from(payments)
      .where(
        and(
          eq(payments.status, "submitted"),
          after ? gt(payments.id, after) : undefined,
        ),
      )
      .orderBy(asc(payments.id))
      .limit(limit);
  }
  async review(
    tx: AuthTransaction,
    row: NonNullable<Awaited<ReturnType<PaymentsRepository["lookup"]>>>,
    payment: typeof payments.$inferSelect,
    actorId: string | null,
    action: "approve" | "reject" | "expire",
    reason: string | undefined,
    now: Date,
  ) {
    const approved = action === "approve",
      rejected = action === "reject";
    const bookingStatus = approved ? "confirmed" : "cancelled";
    const paymentStatus = approved
      ? "completed"
      : rejected
        ? "rejected"
        : "cancelled";
    const cancelReason = rejected ? reason! : "OWNER_REVIEW_TIMEOUT";
    const [updatedBooking] = await tx
      .update(bookings)
      .set({
        status: bookingStatus,
        updatedAt: now,
        ...(!approved
          ? {
              cancelledBy: actorId,
              cancelledAt: now,
              cancelReason,
              expiresAt: null,
            }
          : {}),
      })
      .where(eq(bookings.id, row.booking.id))
      .returning();
    const [updatedPayment] = await tx
      .update(payments)
      .set({
        status: paymentStatus,
        updatedAt: now,
        ...(action !== "expire"
          ? { reviewedBy: actorId, reviewedAt: now }
          : {}),
        ...(approved
          ? { paidAt: now, rejectReason: null }
          : rejected
            ? { rejectReason: reason! }
            : {}),
      })
      .where(eq(payments.id, payment.id))
      .returning();
    await writeAudit(tx, {
      actorId,
      entityId: payment.id,
      action: approved
        ? "payment.approved"
        : rejected
          ? "payment.rejected"
          : "payment.review_expired",
      before: {
        bookingStatus: row.booking.status,
        paymentStatus: payment.status,
      },
      after: {
        bookingStatus,
        paymentStatus,
        ...(!approved ? { hasReason: true } : {}),
      },
    });
    const eventKey = `payment:${payment.id}:${action}`;
    const eventType = approved
      ? "booking_confirmed"
      : rejected
        ? "payment_rejected"
        : "booking_cancelled";
    const payload = {
      paymentId: payment.id,
      bookingId: row.booking.id,
      venueId: row.venue.id,
    };
    if (row.booking.customerId) {
      await tx
        .insert(notifications)
        .values({
          eventKey,
          userId: row.booking.customerId,
          type: eventType,
          title: approved ? "Đặt sân đã được xác nhận" : "Đặt sân đã bị huỷ",
          body: "Thanh toán đã được cập nhật. Xem chi tiết đặt sân để biết kết quả.",
          data: payload,
        });
      await tx.insert(outboxDeliveries).values(
        (["email", "realtime"] as const).map((channel) => ({
          eventKey,
          eventType,
          channel,
          recipientId: row.booking.customerId!,
          payload,
        })),
      );
    }
    await tx
      .insert(outboxDeliveries)
      .values({
        eventKey: eventKey + ":slots",
        eventType: "slot_refresh_requested",
        channel: "realtime",
        recipientId: row.venue.ownerId,
        payload: {
          venueId: row.venue.id,
          courtId: row.court.id,
          start: row.start.toISOString(),
          end: row.end.toISOString(),
        },
      });
    return {
      row: { ...row, booking: updatedBooking! },
      payment: updatedPayment!,
    };
  }
  async lockUsers(tx: AuthTransaction, ids: string[]) {
    await tx
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.id, [...new Set(ids)]))
      .orderBy(asc(users.id))
      .for("update");
  }
  async lookup(id: string, tx: AuthTransaction | DrizzleDb = this.db) {
    const [row] = await tx
      .select({
        booking: bookings,
        court: courts,
        venue: venues,
        start: sql`lower(${bookings.during})`.mapWith(
          (value) => new Date(String(value)),
        ),
        end: sql`upper(${bookings.during})`.mapWith(
          (value) => new Date(String(value)),
        ),
      })
      .from(bookings)
      .innerJoin(courts, eq(courts.id, bookings.courtId))
      .innerJoin(venues, eq(venues.id, courts.venueId))
      .where(eq(bookings.id, id));
    return row;
  }
  async payment(
    bookingId: string,
    tx: AuthTransaction | DrizzleDb = this.db,
    lock = false,
  ) {
    const query = tx
      .select()
      .from(payments)
      .where(eq(payments.bookingId, bookingId))
      .orderBy(
        sql`case when ${payments.status} in ('pending','submitted','completed') then 0 else 1 end`,
        desc(payments.createdAt),
        desc(payments.id),
      )
      .limit(1);
    const [row] = await (lock ? query.for("update") : query);
    return row;
  }
  async lockParents(
    tx: AuthTransaction,
    row: NonNullable<Awaited<ReturnType<PaymentsRepository["lookup"]>>>,
  ) {
    const [venue] = await tx
      .select()
      .from(venues)
      .where(eq(venues.id, row.venue.id))
      .for("share");
    const [court] = await tx
      .select()
      .from(courts)
      .where(eq(courts.id, row.court.id))
      .for("share");
    const [booking] = await tx
      .select()
      .from(bookings)
      .where(eq(bookings.id, row.booking.id))
      .for("update");
    if (
      !venue ||
      !court ||
      !booking ||
      court.venueId !== venue.id ||
      booking.courtId !== court.id
    )
      throw Object.assign(new Error("Payment parent changed"), {
        code: "40001",
      });
    return { ...row, venue, court, booking };
  }
  async now(tx: AuthTransaction) {
    const result = await tx.execute<{ now: Date }>(
      sql`select clock_timestamp() as now`,
    );
    const value = result.rows[0]!.now;
    return value instanceof Date ? value : new Date(String(value));
  }
  async attach(
    tx: AuthTransaction,
    row: NonNullable<Awaited<ReturnType<PaymentsRepository["lookup"]>>>,
    payment: typeof payments.$inferSelect,
    key: string,
    now: Date,
    first: boolean,
  ) {
    // Last lock in the mutation. Cleanup claiming this job prevents any later attachment.
    const [job] = await tx
      .select()
      .from(storageCleanupJobs)
      .where(eq(storageCleanupJobs.objectKey, key))
      .for("update");
    if (!job || job.status !== "pending")
      throw new ServiceUnavailableException({
        code: "SERVICE_UNAVAILABLE",
        message: "Chứng từ không còn khả dụng; vui lòng thử lại.",
      });
    const [updated] = await tx
      .update(payments)
      .set({
        status: "submitted",
        proofObjectKey: key,
        proofUrl: null,
        proofUploadedAt: first ? now : payment.proofUploadedAt,
        proofUpdatedAt: now,
        updatedAt: now,
      })
      .where(eq(payments.id, payment.id))
      .returning();
    await tx
      .update(bookings)
      .set({ status: "pending_payment", expiresAt: null, updatedAt: now })
      .where(eq(bookings.id, row.booking.id));
    await tx
      .update(storageCleanupJobs)
      .set({ notBefore: new Date(now.getTime() + 86400000), updatedAt: now })
      .where(eq(storageCleanupJobs.id, job.id));
    if (payment.proofObjectKey)
      await tx
        .insert(storageCleanupJobs)
        .values({
          objectKey: payment.proofObjectKey,
          notBefore: new Date(now.getTime() + 86400000),
        })
        .onConflictDoUpdate({
          target: storageCleanupJobs.objectKey,
          set: {
            notBefore: new Date(now.getTime() + 86400000),
            updatedAt: now,
          },
        });
    const eventKey = `payment:${payment.id}:proof:${key.split("/").at(-1)}`;
    const payload = {
      bookingId: row.booking.id,
      paymentId: payment.id,
      venueId: row.venue.id,
    };
    await tx.insert(outboxDeliveries).values({
      eventKey,
      eventType: "payment_submitted",
      channel: "realtime",
      recipientId: row.venue.ownerId,
      payload,
    });
    if (first) {
      await tx.insert(outboxDeliveries).values({
        eventKey,
        eventType: "payment_submitted",
        channel: "email",
        recipientId: row.venue.ownerId,
        payload,
      });
      await tx.insert(notifications).values({
        userId: row.venue.ownerId,
        eventKey,
        type: "payment_submitted",
        title: "Có chứng từ thanh toán mới",
        body: "Có thanh toán đang chờ duyệt.",
        data: payload,
      });
      // Invalidation intent: realtime consumer refetches authoritative slot state; no private proof/bank payload.
      await tx.insert(outboxDeliveries).values({
        eventKey: eventKey + ":slots",
        eventType: "slot_refresh_requested",
        channel: "realtime",
        recipientId: row.venue.ownerId,
        payload: {
          venueId: row.venue.id,
          courtId: row.court.id,
          start: row.start.toISOString(),
          end: row.end.toISOString(),
        },
      });
    }
    return updated!;
  }
}
