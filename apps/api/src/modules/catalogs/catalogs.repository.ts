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
      .select()
      .from(sports)
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

  async createSport(input: Omit<SportInput, "slug"> & { slug: string }) {
    const [row] = await this.db
      .insert(sports)
      .values({
        name: input.name,
        slug: input.slug,
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
      .select()
      .from(amenities)
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

  async createAmenity(input: Omit<SportInput, "slug"> & { slug: string }) {
    const [row] = await this.db
      .insert(amenities)
      .values({
        name: input.name,
        slug: input.slug,
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

  async createArea(input: Omit<AreaInput, "slug"> & { slug: string }) {
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
}
