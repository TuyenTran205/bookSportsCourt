import { Injectable } from "@nestjs/common";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import {
  InjectDrizzle,
  type DrizzleDb,
} from "../../database/database.module.js";
import {
  amenities,
  areas,
  courts,
  sports,
  venueAmenities,
  venues,
  venueSports,
} from "../../database/schema/index.js";
import { slugify } from "../../../../../packages/shared/src/utils/unaccent.js";
import type {
  AreaInput,
  SportInput,
} from "../../../../../packages/shared/src/schemas.js";

@Injectable()
export class CatalogsRepository {
  constructor(@InjectDrizzle() private readonly db: DrizzleDb) {}

  // Sports
  async findAllSports() {
    return this.db
      .select({
        id: sports.id,
        name: sports.name,
        slug: sports.slug,
        icon: sports.icon,
        sortOrder: sports.sortOrder,
        venueCount: sql<number>`cast(count(distinct ${venueSports.venueId}) as int)`,
      })
      .from(sports)
      .leftJoin(venueSports, eq(venueSports.sportId, sports.id))
      .groupBy(sports.id)
      .orderBy(asc(sports.sortOrder), asc(sports.name));
  }

  async findSportById(id: string) {
    const [row] = await this.db
      .select()
      .from(sports)
      .where(eq(sports.id, id))
      .limit(1);
    return row ?? null;
  }

  async findSportBySlug(slug: string) {
    const [row] = await this.db
      .select()
      .from(sports)
      .where(eq(sports.slug, slug))
      .limit(1);
    return row ?? null;
  }

  async createSport(input: SportInput) {
    const [row] = await this.db
      .insert(sports)
      .values({
        name: input.name,
        slug: input.slug ?? slugify(input.name),
        icon: input.icon ?? null,
      })
      .returning();
    return row;
  }

  async updateSport(id: string, input: Partial<SportInput>) {
    const [row] = await this.db
      .update(sports)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(sports.id, id))
      .returning();
    return row ?? null;
  }

  async deleteSport(id: string) {
    const [row] = await this.db
      .delete(sports)
      .where(eq(sports.id, id))
      .returning();
    return row ?? null;
  }

  async isSportInUse(id: string): Promise<boolean> {
    const [venueUsage] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(venueSports)
      .where(eq(venueSports.sportId, id));

    const [courtUsage] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(courts)
      .where(and(eq(courts.sportId, id), isNull(courts.deletedAt)));

    return Number(venueUsage?.count ?? 0) > 0 || Number(courtUsage?.count ?? 0) > 0;
  }

  // Amenities
  async findAllAmenities() {
    return this.db
      .select({
        id: amenities.id,
        name: amenities.name,
        slug: amenities.slug,
        icon: amenities.icon,
        sortOrder: amenities.sortOrder,
        venueCount: sql<number>`cast(count(distinct ${venueAmenities.venueId}) as int)`,
      })
      .from(amenities)
      .leftJoin(venueAmenities, eq(venueAmenities.amenityId, amenities.id))
      .groupBy(amenities.id)
      .orderBy(asc(amenities.sortOrder), asc(amenities.name));
  }

  async findAmenityById(id: string) {
    const [row] = await this.db
      .select()
      .from(amenities)
      .where(eq(amenities.id, id))
      .limit(1);
    return row ?? null;
  }

  async findAmenityBySlug(slug: string) {
    const [row] = await this.db
      .select()
      .from(amenities)
      .where(eq(amenities.slug, slug))
      .limit(1);
    return row ?? null;
  }

  async createAmenity(input: SportInput) {
    const [row] = await this.db
      .insert(amenities)
      .values({
        name: input.name,
        slug: input.slug ?? slugify(input.name),
        icon: input.icon ?? null,
      })
      .returning();
    return row;
  }

  async updateAmenity(id: string, input: Partial<SportInput>) {
    const [row] = await this.db
      .update(amenities)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(amenities.id, id))
      .returning();
    return row ?? null;
  }

  async deleteAmenity(id: string) {
    const [row] = await this.db
      .delete(amenities)
      .where(eq(amenities.id, id))
      .returning();
    return row ?? null;
  }

  async isAmenityInUse(id: string): Promise<boolean> {
    const [usage] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(venueAmenities)
      .where(eq(venueAmenities.amenityId, id));
    return Number(usage?.count ?? 0) > 0;
  }

  // Areas
  async findAllAreas(filters?: { type?: string; parentId?: string | null }) {
    let query = this.db.select().from(areas).$dynamic();
    const conditions = [];

    if (filters?.type) {
      conditions.push(eq(areas.type, filters.type));
    }
    if (filters?.parentId !== undefined) {
      conditions.push(
        filters.parentId === null
          ? isNull(areas.parentId)
          : eq(areas.parentId, filters.parentId),
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return query.orderBy(asc(areas.name));
  }

  async findAreaById(id: string) {
    const [row] = await this.db
      .select()
      .from(areas)
      .where(eq(areas.id, id))
      .limit(1);
    return row ?? null;
  }

  async findAreaBySlug(slug: string, parentId: string | null) {
    const condition = parentId
      ? and(eq(areas.slug, slug), eq(areas.parentId, parentId))
      : and(eq(areas.slug, slug), isNull(areas.parentId));

    const [row] = await this.db
      .select()
      .from(areas)
      .where(condition)
      .limit(1);
    return row ?? null;
  }

  async createArea(input: AreaInput) {
    const [row] = await this.db
      .insert(areas)
      .values({
        name: input.name,
        slug: input.slug,
        type: input.type,
        parentId: input.parentId ?? null,
      })
      .returning();
    return row;
  }

  async updateArea(id: string, input: Partial<AreaInput>) {
    const [row] = await this.db
      .update(areas)
      .set({
        ...input,
        parentId: input.parentId ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(areas.id, id))
      .returning();
    return row ?? null;
  }

  async deleteArea(id: string) {
    const [row] = await this.db
      .delete(areas)
      .where(eq(areas.id, id))
      .returning();
    return row ?? null;
  }

  async isAreaInUse(id: string): Promise<boolean> {
    const [childUsage] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(areas)
      .where(eq(areas.parentId, id));

    const [venueUsage] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(venues)
      .where(
        and(
          sql`(${venues.provinceId} = ${id} OR ${venues.districtId} = ${id})`,
          isNull(venues.deletedAt),
        ),
      );

    return (
      Number(childUsage?.count ?? 0) > 0 || Number(venueUsage?.count ?? 0) > 0
    );
  }

  // ===== Đơn vị Hành chính 2 cấp (Provinces & Wards) =====

  async findAllProvinces() {
    return this.db
      .select({
        id: areas.id,
        code: areas.code,
        name: areas.name,
        slug: areas.slug,
        unaccentName: areas.unaccentName,
      })
      .from(areas)
      .where(eq(areas.type, "province"))
      .orderBy(asc(areas.code), asc(areas.name));
  }

  async findProvinceByCodeOrId(codeOrId: string) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        codeOrId,
      );
    const condition = isUuid
      ? and(eq(areas.id, codeOrId), eq(areas.type, "province"))
      : and(eq(areas.code, codeOrId), eq(areas.type, "province"));

    const [row] = await this.db.select().from(areas).where(condition).limit(1);
    return row ?? null;
  }

  async findWardsByProvince(
    provinceId: string,
    provinceCode: string,
    options?: { q?: string; limit?: number },
  ) {
    let query = this.db
      .select({
        id: areas.id,
        code: areas.code,
        name: areas.name,
        slug: areas.slug,
        type: areas.type,
        parentId: areas.parentId,
        unaccentName: areas.unaccentName,
      })
      .from(areas)
      .$dynamic();

    const conditions = [
      eq(areas.parentId, provinceId),
      eq(areas.type, "ward"),
    ];

    if (options?.q && options.q.trim()) {
      const qClean = options.q.trim().toLowerCase();
      conditions.push(
        sql`(${areas.unaccentName} ILIKE ${"%" + qClean + "%"} OR ${areas.name} ILIKE ${"%" + qClean + "%"} OR ${areas.code} ILIKE ${"%" + qClean + "%"})`,
      );
    }

    query = query
      .where(and(...conditions))
      .orderBy(asc(areas.code), asc(areas.name));

    if (options?.limit && options.limit > 0) {
      query = query.limit(options.limit);
    }

    const rows = await query;
    return rows.map((r) => ({
      ...r,
      code: r.code ?? "",
      type: "ward" as const,
      provinceCode,
      provinceId,
    }));
  }

  async searchWards(options: {
    q: string;
    provinceCode?: string;
    provinceId?: string;
    limit?: number;
  }) {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
    const qClean = options.q.trim().toLowerCase();

    let query = this.db
      .select({
        id: areas.id,
        code: areas.code,
        name: areas.name,
        slug: areas.slug,
        type: areas.type,
        parentId: areas.parentId,
        unaccentName: areas.unaccentName,
      })
      .from(areas)
      .$dynamic();

    const conditions = [eq(areas.type, "ward")];

    if (options.provinceId) {
      conditions.push(eq(areas.parentId, options.provinceId));
    }

    conditions.push(
      sql`(${areas.unaccentName} ILIKE ${"%" + qClean + "%"} OR ${areas.name} ILIKE ${"%" + qClean + "%"} OR ${areas.code} ILIKE ${"%" + qClean + "%"})`,
    );

    const rows = await query
      .where(and(...conditions))
      .orderBy(asc(areas.name))
      .limit(limit);

    return rows.map((r) => ({
      ...r,
      code: r.code ?? "",
      type: "ward" as const,
      provinceId: r.parentId ?? undefined,
    }));
  }

  async findDistrictsByProvince(provinceId: string) {
    return this.db
      .select({
        id: areas.id,
        code: areas.code,
        name: areas.name,
        slug: areas.slug,
        parentId: areas.parentId,
      })
      .from(areas)
      .where(and(eq(areas.parentId, provinceId), eq(areas.type, "district")))
      .orderBy(asc(areas.name));
  }
}
