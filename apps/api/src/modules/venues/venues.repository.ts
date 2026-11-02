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
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import {
  InjectDrizzle,
  type DrizzleDb,
} from "../../database/database.module.js";
import {
  amenities,
  areas,
  cancellationPolicies,
  courts,
  sports,
  venueAmenities,
  venueImages,
  venuePaymentAccounts,
  venues,
  venueSports,
} from "../../database/schema/index.js";
import type {
  BankAccountInput,
  CancellationPolicyInput,
  CreateVenueInput,
  UpdateVenueInput,
} from "../../../../../packages/shared/src/schemas.js";

@Injectable()
export class VenuesRepository {
  constructor(@InjectDrizzle() private readonly db: DrizzleDb) {}

  async createVenue(
    ownerId: string,
    slug: string,
    input: CreateVenueInput,
  ) {
    return this.db.transaction(async (tx) => {
      const [newVenue] = await tx
        .insert(venues)
        .values({
          ownerId,
          name: input.name,
          slug,
          description: input.description ?? null,
          address: input.address,
          provinceId: input.provinceId,
          districtId: input.districtId,
          lat: input.lat !== undefined ? String(input.lat) : null,
          lng: input.lng !== undefined ? String(input.lng) : null,
          status: "pending",
        })
        .returning();

      if (!newVenue) {
        throw new Error("Không thể tạo cơ sở thể thao.");
      }

      if (input.sportIds && input.sportIds.length > 0) {
        await tx.insert(venueSports).values(
          input.sportIds.map((sportId) => ({
            venueId: newVenue.id,
            sportId,
          })),
        );
      }

      if (input.amenityIds && input.amenityIds.length > 0) {
        await tx.insert(venueAmenities).values(
          input.amenityIds.map((amenityId) => ({
            venueId: newVenue.id,
            amenityId,
          })),
        );
      }

      // Default cancellation policy
      await tx.insert(cancellationPolicies).values({
        venueId: newVenue.id,
        cancelBeforeHours: 24,
        refundPercent: 100,
        depositPercent: 100,
      });

      return newVenue;
    });
  }

  async updateVenue(id: string, input: UpdateVenueInput) {
    return this.db.transaction(async (tx) => {
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined)
        updateData.description = input.description;
      if (input.address !== undefined) updateData.address = input.address;
      if (input.provinceId !== undefined)
        updateData.provinceId = input.provinceId;
      if (input.districtId !== undefined)
        updateData.districtId = input.districtId;
      if (input.lat !== undefined) updateData.lat = String(input.lat);
      if (input.lng !== undefined) updateData.lng = String(input.lng);

      const [updated] = await tx
        .update(venues)
        .set(updateData)
        .where(and(eq(venues.id, id), isNull(venues.deletedAt)))
        .returning();

      if (input.sportIds !== undefined) {
        await tx.delete(venueSports).where(eq(venueSports.venueId, id));
        if (input.sportIds.length > 0) {
          await tx.insert(venueSports).values(
            input.sportIds.map((sportId) => ({
              venueId: id,
              sportId,
            })),
          );
        }
      }

      if (input.amenityIds !== undefined) {
        await tx.delete(venueAmenities).where(eq(venueAmenities.venueId, id));
        if (input.amenityIds.length > 0) {
          await tx.insert(venueAmenities).values(
            input.amenityIds.map((amenityId) => ({
              venueId: id,
              amenityId,
            })),
          );
        }
      }

      return updated ?? null;
    });
  }

  async softDeleteVenue(id: string) {
    const [row] = await this.db
      .update(venues)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(venues.id, id), isNull(venues.deletedAt)))
      .returning();
    return row ?? null;
  }

  async updateStatus(id: string, status: string) {
    const [row] = await this.db
      .update(venues)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(and(eq(venues.id, id), isNull(venues.deletedAt)))
      .returning();
    return row ?? null;
  }

  async findBySlugOrId(identifier: string) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        identifier,
      );

    const condition = and(
      isUuid ? or(eq(venues.id, identifier), eq(venues.slug, identifier)) : eq(venues.slug, identifier),
      isNull(venues.deletedAt),
    );

    const [venue] = await this.db
      .select()
      .from(venues)
      .where(condition)
      .limit(1);

    if (!venue) return null;

    const [venueSportsList, venueAmenitiesList, imagesList, courtsList, policy] =
      await Promise.all([
        this.db
          .select({
            id: sports.id,
            name: sports.name,
            slug: sports.slug,
            icon: sports.icon,
          })
          .from(venueSports)
          .innerJoin(sports, eq(venueSports.sportId, sports.id))
          .where(eq(venueSports.venueId, venue.id)),
        this.db
          .select({
            id: amenities.id,
            name: amenities.name,
            slug: amenities.slug,
            icon: amenities.icon,
          })
          .from(venueAmenities)
          .innerJoin(amenities, eq(venueAmenities.amenityId, amenities.id))
          .where(eq(venueAmenities.venueId, venue.id)),
        this.db
          .select()
          .from(venueImages)
          .where(eq(venueImages.venueId, venue.id))
          .orderBy(asc(venueImages.sortOrder)),
        this.db
          .select()
          .from(courts)
          .where(and(eq(courts.venueId, venue.id), isNull(courts.deletedAt)))
          .orderBy(asc(courts.sortOrder)),
        this.db
          .select()
          .from(cancellationPolicies)
          .where(eq(cancellationPolicies.venueId, venue.id))
          .limit(1)
          .then((rows) => rows[0] ?? null),
      ]);

    return {
      ...venue,
      sports: venueSportsList,
      amenities: venueAmenitiesList,
      images: imagesList,
      courts: courtsList,
      cancellationPolicy: policy,
    };
  }

  async findBySlug(slug: string) {
    const [row] = await this.db
      .select()
      .from(venues)
      .where(and(eq(venues.slug, slug), isNull(venues.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async findById(id: string) {
    const [row] = await this.db
      .select()
      .from(venues)
      .where(and(eq(venues.id, id), isNull(venues.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async findOwnerVenues(ownerId: string) {
    const venueRows = await this.db
      .select()
      .from(venues)
      .where(and(eq(venues.ownerId, ownerId), isNull(venues.deletedAt)))
      .orderBy(desc(venues.createdAt));

    return venueRows;
  }

  async searchVenues(params: {
    q?: string;
    provinceId?: string;
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
      conditions.push(ilike(venues.name, `%${params.q}%`));
    }
    if (params.provinceId) {
      conditions.push(eq(venues.provinceId, params.provinceId));
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
        sql`EXISTS (
          SELECT 1 FROM ${venueSports}
          WHERE ${venueSports.venueId} = ${venues.id}
          AND ${venueSports.sportId} IN ${params.sportIds}
        )`,
      );
    }

    if (params.amenityIds && params.amenityIds.length > 0) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM ${venueAmenities}
          WHERE ${venueAmenities.venueId} = ${venues.id}
          AND ${venueAmenities.amenityId} IN ${params.amenityIds}
        )`,
      );
    }

    const whereClause = and(...conditions);

    const [totalRow] = await this.db
      .select({ count: count() })
      .from(venues)
      .where(whereClause);

    const total = Number(totalRow?.count ?? 0);
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
      .orderBy(orderBy)
      .limit(params.limit)
      .offset(offset);

    // Fetch sports & images for these venues
    const venueIds = rows.map((r) => r.id);
    const sportsMap = new Map<string, Array<{ id: string; name: string; slug: string; icon: string | null }>>();

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

    const enriched = rows.map((row) => ({
      ...row,
      sports: sportsMap.get(row.id) ?? [],
    }));

    return {
      data: enriched,
      meta: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit) || 1,
      },
    };
  }

  async getMapVenues(filters?: {
    provinceId?: string;
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
    ];

    if (filters?.provinceId) {
      conditions.push(eq(venues.provinceId, filters.provinceId));
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
        sql`EXISTS (
          SELECT 1 FROM ${venueSports}
          WHERE ${venueSports.venueId} = ${venues.id}
          AND ${venueSports.sportId} IN ${filters.sportIds}
        )`,
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
      .where(and(...conditions));
  }

  // Cancellation Policy
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
  ) {
    const [row] = await this.db
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

  // Payment Account
  async getPaymentAccount(venueId: string) {
    const [row] = await this.db
      .select()
      .from(venuePaymentAccounts)
      .where(eq(venuePaymentAccounts.venueId, venueId))
      .limit(1);
    return row ?? null;
  }

  async upsertPaymentAccount(venueId: string, input: BankAccountInput) {
    const [row] = await this.db
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

  // Images
  async addImage(venueId: string, url: string, sortOrder: number) {
    const [row] = await this.db
      .insert(venueImages)
      .values({
        venueId,
        url,
        sortOrder,
      })
      .returning();

    // If venue doesn't have a coverUrl, set this image as coverUrl
    const [venue] = await this.db
      .select({ coverUrl: venues.coverUrl })
      .from(venues)
      .where(eq(venues.id, venueId));

    if (!venue?.coverUrl) {
      await this.db
        .update(venues)
        .set({ coverUrl: url, updatedAt: new Date() })
        .where(eq(venues.id, venueId));
    }

    return row;
  }

  async reorderImages(venueId: string, imageIds: string[]) {
    return this.db.transaction(async (tx) => {
      for (let i = 0; i < imageIds.length; i++) {
        const imageId = imageIds[i];
        if (!imageId) continue;
        await tx
          .update(venueImages)
          .set({ sortOrder: i })
          .where(
            and(
              eq(venueImages.id, imageId),
              eq(venueImages.venueId, venueId),
            ),
          );
      }
      return tx
        .select()
        .from(venueImages)
        .where(eq(venueImages.venueId, venueId))
        .orderBy(asc(venueImages.sortOrder));
    });
  }

  async deleteImage(venueId: string, imageId: string) {
    const [row] = await this.db
      .delete(venueImages)
      .where(
        and(eq(venueImages.id, imageId), eq(venueImages.venueId, venueId)),
      )
      .returning();
    return row ?? null;
  }
}
