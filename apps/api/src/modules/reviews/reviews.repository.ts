import { Injectable } from "@nestjs/common";
import { and, count, desc, eq, ilike, isNotNull, isNull, or } from "drizzle-orm";
import {
  InjectDrizzle,
  type DrizzleDb,
} from "../../database/database.module.js";
import {
  bookings,
  courts,
  reviews,
  users,
  venues,
} from "../../database/schema/index.js";
import type { AuthTransaction } from "../auth/auth.repository.js";
import type { CreateReviewInput } from "../../../../../packages/shared/src/schemas.js";
import type { AdminReviewQueryInput } from "../../../../../packages/shared/src/phase4-schemas.js";
import { writeAudit } from "../audit/audit-writer.js";

@Injectable()
export class ReviewsRepository {
  constructor(@InjectDrizzle() private readonly db: DrizzleDb) {}
  transaction<T>(work: (tx: AuthTransaction) => Promise<T>) {
    return this.db.transaction(work);
  }
  snapshot<T>(work: (tx: AuthTransaction) => Promise<T>) {
    return this.db.transaction(work, {
      isolationLevel: "repeatable read",
      accessMode: "read only",
    });
  }
  async lookupBooking(tx: AuthTransaction, id: string) {
    const [row] = await tx
      .select({ booking: bookings, court: courts })
      .from(bookings)
      .innerJoin(courts, eq(courts.id, bookings.courtId))
      .where(eq(bookings.id, id));
    return row ?? null;
  }
  async lockVenue(tx: AuthTransaction, id: string) {
    const [row] = await tx
      .select()
      .from(venues)
      .where(eq(venues.id, id))
      .for("update");
    return row ?? null;
  }
  async lockBooking(tx: AuthTransaction, courtId: string, bookingId: string) {
    const [court] = await tx
      .select()
      .from(courts)
      .where(eq(courts.id, courtId))
      .for("share");
    const [booking] = await tx
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .for("update");
    return { court, booking };
  }
  async findReview(tx: AuthTransaction, id: string, lock = false) {
    const query = tx.select().from(reviews).where(eq(reviews.id, id));
    const [row] = await (lock ? query.for("update") : query);
    return row ?? null;
  }
  async create(
    tx: AuthTransaction,
    input: CreateReviewInput,
    venueId: string,
    customerId: string,
  ) {
    const [row] = await tx
      .insert(reviews)
      .values({
        bookingId: input.bookingId,
        venueId,
        customerId,
        rating: input.rating,
        content: input.comment || null,
        isVisible: true,
      })
      .returning();
    return row!;
  }
  async visibility(
    tx: AuthTransaction,
    row: typeof reviews.$inferSelect,
    isVisible: boolean,
    actorId: string,
  ) {
    if (row.isVisible === isVisible) return row;
    const [updated] = await tx
      .update(reviews)
      .set({ isVisible, updatedAt: new Date() })
      .where(eq(reviews.id, row.id))
      .returning();
    await writeAudit(tx, {
      actorId,
      action: "review.visibility_changed",
      entityId: row.id,
      before: { isVisible: row.isVisible },
      after: { isVisible },
    });
    return updated!;
  }
  async publicVenue(tx: AuthTransaction, id: string) {
    const [row] = await tx
      .select({ id: venues.id })
      .from(venues)
      .where(
        and(
          eq(venues.id, id),
          eq(venues.status, "approved"),
          isNull(venues.deletedAt),
        ),
      );
    return row ?? null;
  }
  async list(tx: AuthTransaction, query: AdminReviewQueryInput) {
    const qPattern = query.q
      ? `%${query.q.replace(/[\\%_]/g, "\\$&")}%`
      : undefined;
    const where = and(
      query.venueId ? eq(reviews.venueId, query.venueId) : undefined,
      query.isVisible === undefined
        ? undefined
        : eq(reviews.isVisible, query.isVisible),
      query.rating !== undefined ? eq(reviews.rating, query.rating) : undefined,
      qPattern
        ? or(ilike(reviews.content, qPattern), ilike(reviews.ownerReply, qPattern))
        : undefined,
    );
    const [total] = await tx.select({ n: count() }).from(reviews).where(where);
    const offset = (query.page - 1) * query.limit;
    const rows =
      !Number.isSafeInteger(offset) || offset >= total!.n
        ? []
        : await tx
            .select()
            .from(reviews)
            .where(where)
            .orderBy(desc(reviews.createdAt), desc(reviews.id))
            .limit(query.limit)
            .offset(offset);
    return { rows, total: total!.n };
  }

  async ownerList(
    ownerId: string,
    query: { venueId?: string; replied?: boolean; page: number; limit: number },
  ) {
    const conditions = [eq(venues.ownerId, ownerId)];
    if (query.venueId) {
      conditions.push(eq(reviews.venueId, query.venueId));
    }
    if (query.replied === true) {
      conditions.push(isNotNull(reviews.ownerReply));
    } else if (query.replied === false) {
      conditions.push(isNull(reviews.ownerReply));
    }

    const where = and(...conditions);

    const [totalRow] = await this.db
      .select({ count: count() })
      .from(reviews)
      .innerJoin(venues, eq(reviews.venueId, venues.id))
      .where(where);

    const total = totalRow?.count ?? 0;
    const offset = (query.page - 1) * query.limit;

    const rows =
      !Number.isSafeInteger(offset) || offset >= total
        ? []
        : await this.db
            .select({
              id: reviews.id,
              venueId: reviews.venueId,
              venueName: venues.name,
              courtId: bookings.courtId,
              courtName: courts.name,
              customerId: reviews.customerId,
              customerName: users.fullName,
              rating: reviews.rating,
              comment: reviews.content,
              ownerReply: reviews.ownerReply,
              ownerRepliedAt: reviews.ownerRepliedAt,
              createdAt: reviews.createdAt,
            })
            .from(reviews)
            .innerJoin(venues, eq(reviews.venueId, venues.id))
            .innerJoin(bookings, eq(reviews.bookingId, bookings.id))
            .leftJoin(courts, eq(bookings.courtId, courts.id))
            .leftJoin(users, eq(reviews.customerId, users.id))
            .where(where)
            .orderBy(desc(reviews.createdAt), desc(reviews.id))
            .limit(query.limit)
            .offset(offset);

    return { rows, total };
  }

  async ownerReply(ownerId: string, reviewId: string, reply: string) {
    const [row] = await this.db
      .select({
        id: reviews.id,
        ownerId: venues.ownerId,
      })
      .from(reviews)
      .innerJoin(venues, eq(reviews.venueId, venues.id))
      .where(eq(reviews.id, reviewId));

    if (!row) return null;
    if (row.ownerId !== ownerId) return "FORBIDDEN";

    const [updated] = await this.db
      .update(reviews)
      .set({
        ownerReply: reply,
        ownerRepliedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, reviewId))
      .returning();

    return updated;
  }
}
