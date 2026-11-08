import { Injectable } from "@nestjs/common";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import {
  InjectDrizzle,
  type DrizzleDb,
} from "../../database/database.module.js";
import {
  bookings,
  courts,
  reviews,
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
    const where = and(
      query.venueId ? eq(reviews.venueId, query.venueId) : undefined,
      query.isVisible === undefined
        ? undefined
        : eq(reviews.isVisible, query.isVisible),
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
}
