import { Injectable } from "@nestjs/common";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  InjectDrizzle,
  type DrizzleDb,
} from "../../database/database.module.js";
import {
  areas,
  favorites,
  sports,
  venueSports,
  venues,
} from "../../database/schema/schema.js";

@Injectable()
export class FavoritesRepository {
  constructor(@InjectDrizzle() private readonly db: DrizzleDb) {}

  async listUserFavorites(userId: string) {
    const rows = await this.db
      .select({
        id: venues.id,
        name: venues.name,
        slug: venues.slug,
        address: venues.address,
        provinceId: venues.provinceId,
        wardId: venues.wardId,
        districtId: venues.districtId,
        lat: venues.lat,
        lng: venues.lng,
        status: venues.status,
        coverUrl: venues.coverUrl,
        ratingAvg: venues.ratingAvg,
        reviewCount: venues.reviewCount,
        fromPrice: venues.fromPrice,
        createdAt: favorites.createdAt,
      })
      .from(favorites)
      .innerJoin(venues, eq(favorites.venueId, venues.id))
      .where(
        and(
          eq(favorites.userId, userId),
          eq(venues.status, "approved"),
          isNull(venues.deletedAt),
        ),
      )
      .orderBy(desc(favorites.createdAt));

    if (rows.length === 0) return [];

    const venueIds = rows.map((r) => r.id);
    const sportsMap = new Map<
      string,
      Array<{ id: string; name: string; slug: string; icon: string | null }>
    >();

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

    const areaIds = [
      ...new Set(
        rows
          .flatMap((r) => [r.provinceId, r.wardId, r.districtId])
          .filter(
            (id): id is string => typeof id === "string" && id.length > 0,
          ),
      ),
    ];

    const locations = areaIds.length
      ? await this.db.select().from(areas).where(inArray(areas.id, areaIds))
      : [];

    return rows.map((row) => {
      const province = locations.find((a) => a.id === row.provinceId);
      const ward = locations.find((a) => a.id === row.wardId);
      const district = locations.find((a) => a.id === row.districtId);
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
  }

  async addFavorite(userId: string, venueId: string) {
    const [venue] = await this.db
      .select({ id: venues.id })
      .from(venues)
      .where(and(eq(venues.id, venueId), isNull(venues.deletedAt)))
      .limit(1);

    if (!venue) return false;

    await this.db
      .insert(favorites)
      .values({ userId, venueId })
      .onConflictDoNothing();

    return true;
  }

  async removeFavorite(userId: string, venueId: string) {
    await this.db
      .delete(favorites)
      .where(
        and(eq(favorites.userId, userId), eq(favorites.venueId, venueId)),
      );
    return true;
  }
}
