import { Injectable } from "@nestjs/common";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
} from "drizzle-orm";
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
  venuePaymentAccounts,
  ownerApplications,
  users,
  openingHours,
} from "../../database/schema/index.js";
import type {
  AdminVenueQueryDto,
  OwnerVenueQueryDto,
} from "./dto/venue.dto.js";
import type { AuthTransaction } from "../auth/auth.repository.js";
import { writeAudit } from '../audit/audit-writer.js';
import type {
  BankAccountInput,
  CancellationPolicyInput,
} from "../../../../../packages/shared/src/schemas.js";

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
    await writeAudit(tx, {
      actorId,
      entityId,
      action: "venue.status_changed",
      before: {
        status: before.status,
        hasRejectionReason: before.rejectionReason !== null,
      },
      after: {
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
          .select({
            id: venues.id,
            ownerId: venues.ownerId,
            ownerName: users.fullName,
            slug: venues.slug,
            name: venues.name,
            description: venues.description,
            address: venues.address,
            provinceId: venues.provinceId,
            wardId: venues.wardId,
            districtId: venues.districtId,
            lat: venues.lat,
            lng: venues.lng,
            coverUrl: venues.coverUrl,
            status: venues.status,
            rejectionReason: venues.rejectionReason,
            createdAt: venues.createdAt,
            updatedAt: venues.updatedAt,
          })
          .from(venues)
          .leftJoin(users, eq(users.id, venues.ownerId))
          .where(where)
          .orderBy(desc(venues.createdAt), desc(venues.id))
          .limit(query.limit)
          .offset((query.page - 1) * query.limit);
        const ids = rows.map((row) => row.id);
        const sportLinks = ids.length === 0 ? [] : await tx
          .select({
            venueId: venueSports.venueId,
            sportId: venueSports.sportId,
            name: sports.name,
            slug: sports.slug,
            icon: sports.icon,
          })
          .from(venueSports)
          .innerJoin(sports, eq(sports.id, venueSports.sportId))
          .where(inArray(venueSports.venueId, ids))
          .orderBy(asc(sports.sortOrder), asc(sports.name));
        const amenityLinks = ids.length === 0 ? [] : await tx
          .select({
            venueId: venueAmenities.venueId,
            amenityId: venueAmenities.amenityId,
            name: amenities.name,
            slug: amenities.slug,
            icon: amenities.icon,
          })
          .from(venueAmenities)
          .innerJoin(amenities, eq(amenities.id, venueAmenities.amenityId))
          .where(inArray(venueAmenities.venueId, ids))
          .orderBy(asc(amenities.sortOrder), asc(amenities.name));
        const courtRows = ids.length === 0 ? [] : await tx
          .select({
            id: courts.id,
            venueId: courts.venueId,
            name: courts.name,
            sportId: courts.sportId,
            status: courts.status,
            description: courts.description,
          })
          .from(courts)
          .where(and(inArray(courts.venueId, ids), isNull(courts.deletedAt)))
          .orderBy(asc(courts.sortOrder), asc(courts.name));
        return { rows, total, sports: sportLinks, amenities: amenityLinks, courts: courtRows };
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
        const relevantAreaIds = [
          venue.provinceId,
          venue.wardId,
          venue.districtId,
        ].filter(
          (id): id is string => typeof id === "string" && id.length > 0,
        );
        const areaRows = relevantAreaIds.length
          ? await tx.select().from(areas).where(inArray(areas.id, relevantAreaIds))
          : [];
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
        const courtIds = courtRows.map((c) => c.id);
        const openingHourRows = courtIds.length
          ? await tx
              .select({
                id: openingHours.id,
                courtId: openingHours.courtId,
                dayOfWeek: openingHours.dayOfWeek,
                openTime: openingHours.openTime,
                closeTime: openingHours.closeTime,
              })
              .from(openingHours)
              .where(inArray(openingHours.courtId, courtIds))
              .orderBy(openingHours.dayOfWeek, openingHours.openTime)
          : [];
        return {
          venue,
          areaRows,
          sports: sportRows,
          amenities: amenityRows,
          images,
          courts: courtRows,
          policy,
          openingHours: openingHourRows,
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
  async findById(id: string) {
    const [row] = await this.db
      .select()
      .from(venues)
      .where(and(eq(venues.id, id), isNull(venues.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async findAreaByCode(code: string, type: "province" | "ward") {
    const [row] = await this.db
      .select({ id: areas.id })
      .from(areas)
      .where(and(eq(areas.code, code), eq(areas.type, type)))
      .limit(1);
    return row ?? null;
  }

  async searchVenues(params: {
    q?: string;
    provinceId?: string;
    wardId?: string;
    districtId?: string;
    sportIds?: string[];
    amenityIds?: string[];
    minPrice?: number;
    maxPrice?: number;
    minRating?: number;
    sort?: string;
    page: number;
    limit: number;
  }) {
    const conditions = [
      eq(venues.status, "approved"),
      isNull(venues.deletedAt),
    ];

    if (params.q) {
      // Escape ký tự đại diện của LIKE để từ khoá người dùng nhập được hiểu
      // theo nghĩa đen (`%`, `_`, `\`).
      const escaped = params.q.replace(/[\\%_]/g, (char) => `\\${char}`);
      conditions.push(ilike(venues.name, `%${escaped}%`));
    }
    if (params.provinceId) {
      conditions.push(eq(venues.provinceId, params.provinceId));
    }
    if (params.wardId) {
      conditions.push(eq(venues.wardId, params.wardId));
    }
    if (params.districtId) {
      conditions.push(eq(venues.districtId, params.districtId));
    }
    if (params.minPrice !== undefined) {
      conditions.push(gte(venues.fromPrice, params.minPrice));
    }
    if (params.maxPrice !== undefined) {
      conditions.push(lte(venues.fromPrice, params.maxPrice));
    }
    if (params.minRating !== undefined) {
      conditions.push(gte(venues.ratingAvg, String(params.minRating)));
    }

    if (params.sportIds && params.sportIds.length > 0) {
      conditions.push(
        inArray(
          venues.id,
          this.db
            .select({ venueId: venueSports.venueId })
            .from(venueSports)
            .where(inArray(venueSports.sportId, params.sportIds)),
        ),
      );
    }

    if (params.amenityIds && params.amenityIds.length > 0) {
      conditions.push(
        inArray(
          venues.id,
          this.db
            .select({ venueId: venueAmenities.venueId })
            .from(venueAmenities)
            .where(inArray(venueAmenities.amenityId, params.amenityIds)),
        ),
      );
    }

    const whereClause = and(...conditions);

    const [totalRow] = await this.db
      .select({ count: count() })
      .from(venues)
      .where(whereClause);

    const total = Number(totalRow?.count ?? 0);
    if (params.page > Math.ceil(total / params.limit))
      return {
        data: [],
        meta: {
          page: params.page,
          limit: params.limit,
          total,
          totalPages: Math.ceil(total / params.limit),
        },
      };
    const offset = (params.page - 1) * params.limit;

    let orderBy;
    switch (params.sort) {
      case "price_asc":
        orderBy = asc(venues.fromPrice);
        break;
      case "price_desc":
        orderBy = desc(venues.fromPrice);
        break;
      case "rating_desc":
        orderBy = desc(venues.ratingAvg);
        break;
      case "newest":
      default:
        orderBy = desc(venues.createdAt);
        break;
    }

    const rows = await this.db
      .select()
      .from(venues)
      .where(whereClause)
      .orderBy(orderBy, desc(venues.id))
      .limit(params.limit)
      .offset(offset);

    // Fetch sports & images for these venues
    const venueIds = rows.map((r) => r.id);
    const sportsMap = new Map<
      string,
      Array<{ id: string; name: string; slug: string; icon: string | null }>
    >();

    if (venueIds.length > 0) {
      const sportsList = await this.db
        .select({
          venueId: venueSports.venueId,
          sport: {
            id: sports.id,
            name: sports.name,
            slug: sports.slug,
            icon: sports.icon,
          },
        })
        .from(venueSports)
        .innerJoin(sports, eq(venueSports.sportId, sports.id))
        .where(inArray(venueSports.venueId, venueIds));

      for (const item of sportsList) {
        const arr = sportsMap.get(item.venueId) ?? [];
        arr.push(item.sport);
        sportsMap.set(item.venueId, arr);
      }
    }

    const areaIds = [
      ...new Set(
        rows
          .flatMap((row) => [row.provinceId, row.wardId, row.districtId])
          .filter(
            (id): id is string => typeof id === "string" && id.length > 0,
          ),
      ),
    ];
    const locations = areaIds.length
      ? await this.db.select().from(areas).where(inArray(areas.id, areaIds))
      : [];
    const enriched = rows.map((row) => {
      const province = locations.find((area) => area.id === row.provinceId);
      const ward = locations.find((area) => area.id === row.wardId);
      const district = locations.find((area) => area.id === row.districtId);
      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        address: row.address,
        province: province
          ? { id: province.id, name: province.name, slug: province.slug }
          : null,
        ward: ward
          ? {
              id: ward.id,
              code: ward.code ?? undefined,
              name: ward.name,
              slug: ward.slug,
              type: "ward" as const,
              parentId: ward.parentId,
            }
          : null,
        district: district
          ? {
              id: district.id,
              name: district.name,
              slug: district.slug,
              provinceId: district.parentId ?? "",
            }
          : null,
        lat: row.lat === null ? null : Number(row.lat),
        lng: row.lng === null ? null : Number(row.lng),
        status: row.status,
        coverUrl: row.coverUrl,
        ratingAvg: Number(row.ratingAvg),
        reviewCount: row.reviewCount,
        fromPrice: row.fromPrice,
        sports: sportsMap.get(row.id) ?? [],
      };
    });

    return {
      data: enriched,
      meta: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    };
  }

  async getMapVenues(filters?: {
    provinceId?: string;
    wardId?: string;
    districtId?: string;
    sportIds?: string[];
    minLat?: number;
    maxLat?: number;
    minLng?: number;
    maxLng?: number;
  }) {
    const conditions = [
      eq(venues.status, "approved"),
      isNull(venues.deletedAt),
      isNotNull(venues.lat),
      isNotNull(venues.lng),
    ];

    if (filters?.provinceId) {
      conditions.push(eq(venues.provinceId, filters.provinceId));
    }
    if (filters?.wardId) {
      conditions.push(eq(venues.wardId, filters.wardId));
    }
    if (filters?.districtId) {
      conditions.push(eq(venues.districtId, filters.districtId));
    }
    if (filters?.minLat !== undefined) {
      conditions.push(gte(venues.lat, String(filters.minLat)));
    }
    if (filters?.maxLat !== undefined) {
      conditions.push(lte(venues.lat, String(filters.maxLat)));
    }
    if (filters?.minLng !== undefined) {
      conditions.push(gte(venues.lng, String(filters.minLng)));
    }
    if (filters?.maxLng !== undefined) {
      conditions.push(lte(venues.lng, String(filters.maxLng)));
    }
    if (filters?.sportIds && filters.sportIds.length > 0) {
      conditions.push(
        inArray(
          venues.id,
          this.db
            .select({ venueId: venueSports.venueId })
            .from(venueSports)
            .where(inArray(venueSports.sportId, filters.sportIds)),
        ),
      );
    }

    return this.db
      .select({
        id: venues.id,
        slug: venues.slug,
        name: venues.name,
        lat: venues.lat,
        lng: venues.lng,
        fromPrice: venues.fromPrice,
        ratingAvg: venues.ratingAvg,
        coverUrl: venues.coverUrl,
      })
      .from(venues)
      .where(and(...conditions))
      .orderBy(venues.id);
  }

  async getCancellationPolicy(venueId: string) {
    const [row] = await this.db
      .select()
      .from(cancellationPolicies)
      .where(eq(cancellationPolicies.venueId, venueId))
      .limit(1);
    return row ?? null;
  }

  async upsertCancellationPolicy(
    venueId: string,
    input: CancellationPolicyInput,
    tx: AuthTransaction,
  ) {
    const [row] = await tx
      .insert(cancellationPolicies)
      .values({
        venueId,
        cancelBeforeHours: input.cancelBeforeHours,
        refundPercent: input.refundPercent,
        depositPercent: input.depositPercent,
      })
      .onConflictDoUpdate({
        target: cancellationPolicies.venueId,
        set: {
          cancelBeforeHours: input.cancelBeforeHours,
          refundPercent: input.refundPercent,
          depositPercent: input.depositPercent,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  }

  async getPaymentAccount(venueId: string) {
    const [row] = await this.db
      .select()
      .from(venuePaymentAccounts)
      .where(eq(venuePaymentAccounts.venueId, venueId))
      .limit(1);
    return row ?? null;
  }

  async findOwnerApplicationBank(venueId: string, tx: AuthTransaction | DrizzleDb = this.db) {
    const [venue] = await tx
      .select({ ownerId: venues.ownerId })
      .from(venues)
      .where(eq(venues.id, venueId))
      .limit(1);
    if (!venue) return null;

    const [app] = await tx
      .select({
        bankBin: ownerApplications.bankBin,
        bankName: ownerApplications.bankName,
        accountNo: ownerApplications.accountNo,
        accountName: ownerApplications.accountName,
      })
      .from(ownerApplications)
      .where(
        and(
          eq(ownerApplications.userId, venue.ownerId),
          eq(ownerApplications.status, "approved"),
          isNotNull(ownerApplications.bankBin),
          isNotNull(ownerApplications.accountNo),
        ),
      )
      .orderBy(desc(ownerApplications.createdAt), desc(ownerApplications.id))
      .limit(1);

    return app ?? null;
  }

  async upsertPaymentAccount(
    venueId: string,
    input: BankAccountInput,
    tx: AuthTransaction,
  ) {
    const [row] = await tx
      .insert(venuePaymentAccounts)
      .values({
        venueId,
        bankBin: input.bankBin,
        accountNo: input.accountNo,
        accountName: input.accountName,
      })
      .onConflictDoUpdate({
        target: venuePaymentAccounts.venueId,
        set: {
          bankBin: input.bankBin,
          accountNo: input.accountNo,
          accountName: input.accountName,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  }

  async addImage(
    venueId: string,
    url: string,
    sortOrder: number,
    tx: AuthTransaction,
  ) {
    const [row] = await tx
      .insert(venueImages)
      .values({
        venueId,
        url,
        sortOrder,
      })
      .returning();

    // If venue doesn't have a coverUrl, set this image as coverUrl
    const [venue] = await tx
      .select({ coverUrl: venues.coverUrl })
      .from(venues)
      .where(eq(venues.id, venueId));

    if (!venue?.coverUrl) {
      await tx
        .update(venues)
        .set({ coverUrl: url, updatedAt: new Date() })
        .where(eq(venues.id, venueId));
    }

    return row;
  }

  async reorderImages(
    venueId: string,
    imageIds: string[],
    tx: AuthTransaction,
  ) {
    for (const [sortOrder, imageId] of imageIds.entries()) {
      await tx
        .update(venueImages)
        .set({ sortOrder })
        .where(
          and(eq(venueImages.id, imageId), eq(venueImages.venueId, venueId)),
        );
    }
    return this.imageList(venueId, tx);
  }

  async deleteImage(venueId: string, imageId: string, tx: AuthTransaction) {
    const [row] = await tx
      .delete(venueImages)
      .where(and(eq(venueImages.id, imageId), eq(venueImages.venueId, venueId)))
      .returning();
    return row ?? null;
  }
  async imageList(venueId: string, tx: AuthTransaction) {
    return tx
      .select()
      .from(venueImages)
      .where(eq(venueImages.venueId, venueId))
      .orderBy(asc(venueImages.sortOrder), asc(venueImages.id));
  }
}
