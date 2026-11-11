import { Injectable } from "@nestjs/common";
import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import {
  InjectDrizzle,
  type DrizzleDb,
} from "../../database/database.module.js";
import {
  blackoutPeriods,
  bookings,
  courts,
  openingHours,
  pricingRules,
  users,
  venues,
} from "../../database/schema/index.js";
import { formatTsTzRange } from "../../common/utils/time-range.js";

const ACTIVE_BOOKING_STATUSES = ["pending_payment", "confirmed"] as const;
const COUNTED_BOOKING_STATUSES = ["confirmed", "completed"] as const;

export interface OwnerBookingRow {
  id: string;
  courtId: string;
  customerId: string | null;
  customerName: string | null;
  guestName: string | null;
  status: string;
  source: string;
  totalPrice: number;
  start: Date;
  end: Date;
}

@Injectable()
export class OwnerRepository {
  constructor(@InjectDrizzle() private readonly db: DrizzleDb) {}

  async findVenue(venueId: string) {
    const [row] = await this.db
      .select({
        id: venues.id,
        name: venues.name,
        ownerId: venues.ownerId,
        address: venues.address,
      })
      .from(venues)
      .where(and(eq(venues.id, venueId), isNull(venues.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async findCourtWithVenue(courtId: string) {
    const [row] = await this.db
      .select({
        courtId: courts.id,
        courtName: courts.name,
        venueId: venues.id,
        venueName: venues.name,
        ownerId: venues.ownerId,
      })
      .from(courts)
      .innerJoin(venues, eq(courts.venueId, venues.id))
      .where(and(eq(courts.id, courtId), isNull(courts.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async listCourts(venueId: string) {
    return this.db
      .select({
        id: courts.id,
        name: courts.name,
        description: courts.description,
        sportId: courts.sportId,
        status: courts.status,
        sortOrder: courts.sortOrder,
      })
      .from(courts)
      .where(and(eq(courts.venueId, venueId), isNull(courts.deletedAt)))
      .orderBy(asc(courts.sortOrder), asc(courts.createdAt));
  }

  async listOpeningHours(courtIds: string[]) {
    if (courtIds.length === 0) return [];
    return this.db
      .select()
      .from(openingHours)
      .where(inArray(openingHours.courtId, courtIds))
      .orderBy(asc(openingHours.courtId), asc(openingHours.dayOfWeek));
  }

  async listBlackouts(courtIds: string[], from: Date, to: Date) {
    if (courtIds.length === 0) return [];
    return this.db
      .select({
        id: blackoutPeriods.id,
        courtId: blackoutPeriods.courtId,
        reason: blackoutPeriods.reason,
        createdAt: blackoutPeriods.createdAt,
        start: sql<string>`lower(${blackoutPeriods.during})`,
        end: sql<string>`upper(${blackoutPeriods.during})`,
      })
      .from(blackoutPeriods)
      .where(
        and(
          inArray(blackoutPeriods.courtId, courtIds),
          sql`${blackoutPeriods.during} && tstzrange(${from.toISOString()}, ${to.toISOString()}, '[)')`,
        ),
      )
      .orderBy(asc(sql`lower(${blackoutPeriods.during})`));
  }

  async createBlackout(
    courtId: string,
    start: Date,
    end: Date,
    reason: string | null,
  ) {
    return this.db.transaction(async (tx) => {
      // Cùng khoá advisory với BookingsService.createHold để không race condition.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${courtId}, 0))`,
      );

      const [bookingConflict] = await tx
        .select({ id: bookings.id })
        .from(bookings)
        .where(
          and(
            eq(bookings.courtId, courtId),
            sql`${bookings.during} && tstzrange(${start.toISOString()}, ${end.toISOString()}, '[)')`,
            or(
              inArray(bookings.status, [...ACTIVE_BOOKING_STATUSES]),
              and(
                eq(bookings.status, "held"),
                sql`${bookings.expiresAt} > now()`,
              ),
            ),
          ),
        )
        .limit(1);

      if (bookingConflict) {
        return { kind: "booking_conflict" as const };
      }

      const [row] = await tx
        .insert(blackoutPeriods)
        .values({
          courtId,
          during: formatTsTzRange(start, end),
          reason,
        })
        .returning();

      return { kind: "created" as const, row };
    });
  }

  async deleteBlackout(courtId: string, blackoutId: string) {
    const [row] = await this.db
      .delete(blackoutPeriods)
      .where(
        and(
          eq(blackoutPeriods.id, blackoutId),
          eq(blackoutPeriods.courtId, courtId),
        ),
      )
      .returning();
    return row ?? null;
  }

  async findBlackoutById(courtId: string, blackoutId: string) {
    const [row] = await this.db
      .select()
      .from(blackoutPeriods)
      .where(
        and(
          eq(blackoutPeriods.id, blackoutId),
          eq(blackoutPeriods.courtId, courtId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async listBookings(
    courtIds: string[],
    from: Date,
    to: Date,
    statuses: readonly string[] = COUNTED_BOOKING_STATUSES,
  ): Promise<OwnerBookingRow[]> {
    if (courtIds.length === 0) return [];

    const rows = await this.db
      .select({
        id: bookings.id,
        courtId: bookings.courtId,
        customerId: bookings.customerId,
        customerName: users.fullName,
        guestName: bookings.guestName,
        status: bookings.status,
        source: bookings.source,
        totalPrice: bookings.totalPrice,
        start: sql<string>`lower(${bookings.during})`,
        end: sql<string>`upper(${bookings.during})`,
      })
      .from(bookings)
      .innerJoin(users, eq(bookings.customerId, users.id))
      .where(
        and(
          inArray(bookings.courtId, courtIds),
          inArray(bookings.status, statuses as [string, ...string[]]),
          sql`${bookings.during} && tstzrange(${from.toISOString()}, ${to.toISOString()}, '[)')`,
        ),
      );

    return rows.map((row) => ({
      ...row,
      status: String(row.status),
      totalPrice: Number(row.totalPrice),
      start: new Date(row.start),
      end: new Date(row.end),
    }));
  }

  async listPricingRules(courtIds: string[]) {
    if (courtIds.length === 0) return [];
    return this.db
      .select()
      .from(pricingRules)
      .where(inArray(pricingRules.courtId, courtIds))
      .orderBy(asc(pricingRules.priority));
  }

  async listVenuesByOwner(ownerId: string) {
    return this.db
      .select({ id: venues.id, name: venues.name })
      .from(venues)
      .where(and(eq(venues.ownerId, ownerId), isNull(venues.deletedAt)));
  }
}