import { Injectable } from "@nestjs/common";
import { and, count, desc, eq, ilike, inArray, isNull } from "drizzle-orm";
import {
  InjectDrizzle,
  type DrizzleDb,
} from "../../database/database.module.js";
import {
  areas,
  sports,
  amenities,
  venues,
  venueSports,
  venueAmenities,
  venueImages,
  courts,
  cancellationPolicies,
  bookings,
  auditLogs,
} from "../../database/schema/index.js";
import type {
  AdminVenueQueryDto,
  OwnerVenueQueryDto,
} from "./dto/venue.dto.js";
import type { AuthTransaction } from "../auth/auth.repository.js";

@Injectable()
export class VenuesRepository {
  constructor(@InjectDrizzle() private readonly db: DrizzleDb) {}

  transaction<T>(work: (tx: AuthTransaction) => Promise<T>) {
    return this.db.transaction(work);
  }

  async auditModeration(
    tx: AuthTransaction,
    actorId: string,
    entityId: string,
    before: { status: string; rejectionReason: string | null },
    after: { status: string; rejectionReason: string | null },
  ) {
    await tx
      .insert(auditLogs)
      .values({
        actorId,
        entityId,
        entityType: "venue",
        action: "venue.status_changed",
        oldData: {
          status: before.status,
          hasRejectionReason: before.rejectionReason !== null,
        },
        newData: {
          status: after.status,
          hasRejectionReason: after.rejectionReason !== null,
        },
      });
  }

  async lockVenue(tx: AuthTransaction, id: string) {
    const [venue] = await tx
      .select()
      .from(venues)
      .where(and(eq(venues.id, id), isNull(venues.deletedAt)))
      .for("update");
    return venue;
  }

  async links(tx: AuthTransaction, id: string) {
    const sportRows = await tx
      .select()
      .from(venueSports)
      .where(eq(venueSports.venueId, id))
      .orderBy(venueSports.sportId);
    const amenityRows = await tx
      .select()
      .from(venueAmenities)
      .where(eq(venueAmenities.venueId, id))
      .orderBy(venueAmenities.amenityId);
    return {
      sportIds: sportRows.map((row) => row.sportId),
      amenityIds: amenityRows.map((row) => row.amenityId),
    };
  }

  async update(
    tx: AuthTransaction,
    id: string,
    values: Partial<typeof venues.$inferInsert>,
    sportIds?: string[],
    amenityIds?: string[],
  ) {
    const [venue] = await tx
      .update(venues)
      .set(values)
      .where(eq(venues.id, id))
      .returning();
    if (!venue) throw new Error("Venue update returned no row");
    if (sportIds !== undefined) {
      await tx.delete(venueSports).where(eq(venueSports.venueId, id));
      if (sportIds.length)
        await tx
          .insert(venueSports)
          .values(sportIds.map((sportId) => ({ venueId: id, sportId })));
    }
    if (amenityIds !== undefined) {
      await tx.delete(venueAmenities).where(eq(venueAmenities.venueId, id));
      if (amenityIds.length)
        await tx
          .insert(venueAmenities)
          .values(amenityIds.map((amenityId) => ({ venueId: id, amenityId })));
    }
    return venue;
  }

  async hasBlockingBookings(tx: AuthTransaction, id: string) {
    const rows = await tx
      .select({ id: bookings.id })
      .from(bookings)
      .innerJoin(courts, eq(courts.id, bookings.courtId))
      .where(
        and(
          eq(courts.venueId, id),
          inArray(bookings.status, ["held", "pending_payment", "confirmed"]),
        ),
      )
      .limit(1);
    // Deliberately include deleted courts, expired holds and past confirmed bookings.
    return rows.length > 0;
  }

  async list(query: OwnerVenueQueryDto | AdminVenueQueryDto, ownerId?: string) {
    const status = "status" in query ? query.status : undefined;
    const q = "q" in query ? query.q : undefined;
    // Escape LIKE metacharacters: q is a literal substring, not a wildcard pattern.
    const pattern = q ? `%${q.replace(/[\\%_]/g, "\\$&")}%` : undefined;
    const where = and(
      isNull(venues.deletedAt),
      ownerId ? eq(venues.ownerId, ownerId) : undefined,
      status ? eq(venues.status, status) : undefined,
      pattern ? ilike(venues.name, pattern) : undefined,
    );
    return this.db.transaction(
      async (tx) => {
        const [result] = await tx
          .select({ total: count() })
          .from(venues)
          .where(where);
        const total = result?.total ?? 0;
        // Avoid unsafe JS multiplication / huge OFFSET for valid but enormous page numbers.
        if (query.page > Math.ceil(total / query.limit))
          return { rows: [], total, sports: [], amenities: [] };
        const rows = await tx
          .select()
          .from(venues)
          .where(where)
          .orderBy(desc(venues.createdAt), desc(venues.id))
          .limit(query.limit)
          .offset((query.page - 1) * query.limit);
        const ids = rows.map((row) => row.id);
        const sportLinks = await tx
          .select()
          .from(venueSports)
          .where(inArray(venueSports.venueId, ids))
          .orderBy(venueSports.sportId);
        const amenityLinks = await tx
          .select()
          .from(venueAmenities)
          .where(inArray(venueAmenities.venueId, ids))
          .orderBy(venueAmenities.amenityId);
        return { rows, total, sports: sportLinks, amenities: amenityLinks };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  async publicDetail(identifier: string, byId: boolean) {
    return this.db.transaction(
      async (tx) => {
        const [venue] = await tx
          .select()
          .from(venues)
          .where(
            and(
              byId ? eq(venues.id, identifier) : eq(venues.slug, identifier),
              eq(venues.status, "approved"),
              isNull(venues.deletedAt),
            ),
          );
        if (!venue) return undefined;
        const areaRows = await tx
          .select()
          .from(areas)
          .where(inArray(areas.id, [venue.provinceId, venue.districtId]));
        const sportRows = await tx
          .select({
            id: sports.id,
            name: sports.name,
            slug: sports.slug,
            icon: sports.icon,
          })
          .from(venueSports)
          .innerJoin(sports, eq(sports.id, venueSports.sportId))
          .where(eq(venueSports.venueId, venue.id))
          .orderBy(sports.id);
        const amenityRows = await tx
          .select({
            id: amenities.id,
            name: amenities.name,
            slug: amenities.slug,
            icon: amenities.icon,
          })
          .from(venueAmenities)
          .innerJoin(amenities, eq(amenities.id, venueAmenities.amenityId))
          .where(eq(venueAmenities.venueId, venue.id))
          .orderBy(amenities.id);
        const images = await tx
          .select({
            id: venueImages.id,
            url: venueImages.url,
            sortOrder: venueImages.sortOrder,
          })
          .from(venueImages)
          .where(eq(venueImages.venueId, venue.id))
          .orderBy(venueImages.sortOrder, venueImages.id);
        const courtRows = await tx
          .select({
            id: courts.id,
            name: courts.name,
            description: courts.description,
            sportId: courts.sportId,
            status: courts.status,
          })
          .from(courts)
          .where(and(eq(courts.venueId, venue.id), isNull(courts.deletedAt)))
          .orderBy(courts.sortOrder, courts.id);
        const [policy] = await tx
          .select({
            cancelBeforeHours: cancellationPolicies.cancelBeforeHours,
            refundPercent: cancellationPolicies.refundPercent,
            depositPercent: cancellationPolicies.depositPercent,
          })
          .from(cancellationPolicies)
          .where(eq(cancellationPolicies.venueId, venue.id));
        return {
          venue,
          areaRows,
          sports: sportRows,
          amenities: amenityRows,
          images,
          courts: courtRows,
          policy,
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  areas(tx: AuthTransaction, ids: string[]) {
    return tx
      .select()
      .from(areas)
      .where(inArray(areas.id, ids))
      .orderBy(areas.id)
      .for("share");
  }

  async catalogIds(
    tx: AuthTransaction,
    kind: "sports" | "amenities",
    ids: string[],
  ) {
    if (!ids.length) return [];
    const table = kind === "sports" ? sports : amenities;
    return tx
      .select({ id: table.id })
      .from(table)
      .where(inArray(table.id, ids))
      .orderBy(table.id)
      .for("share");
  }

  async create(
    tx: AuthTransaction,
    values: typeof venues.$inferInsert,
    sportIds: string[],
    amenityIds: string[],
  ) {
    const [venue] = await tx.insert(venues).values(values).returning();
    if (!venue) throw new Error("Venue insert returned no row");
    if (sportIds.length)
      await tx
        .insert(venueSports)
        .values(sportIds.map((sportId) => ({ venueId: venue.id, sportId })));
    if (amenityIds.length)
      await tx
        .insert(venueAmenities)
        .values(
          amenityIds.map((amenityId) => ({ venueId: venue.id, amenityId })),
        );
    return venue;
  }
}
