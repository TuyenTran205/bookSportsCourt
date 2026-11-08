import { Injectable } from "@nestjs/common";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import {
  InjectDrizzle,
  type DrizzleDb,
} from "../../database/database.module.js";
import {
  courts,
  openingHours,
  pricingRules,
  sports,
} from "../../database/schema/index.js";
import type {
  CreateCourtInput,
  PricingRuleInput,
  UpdateCourtInput,
  UpdateOpeningHoursInput,
} from "../../../../../packages/shared/src/schemas.js";

@Injectable()
export class CourtsRepository {
  constructor(@InjectDrizzle() private readonly db: DrizzleDb) {}

  async findCourtsByVenueId(venueId: string, onlyActive = false) {
    const conditions = [
      eq(courts.venueId, venueId),
      isNull(courts.deletedAt),
    ];
    if (onlyActive) {
      conditions.push(eq(courts.status, "active"));
    }

    return this.db
      .select({
        id: courts.id,
        venueId: courts.venueId,
        name: courts.name,
        description: courts.description,
        sportId: courts.sportId,
        status: courts.status,
        sortOrder: courts.sortOrder,
        createdAt: courts.createdAt,
        updatedAt: courts.updatedAt,
        sport: {
          id: sports.id,
          name: sports.name,
          slug: sports.slug,
          icon: sports.icon,
        },
      })
      .from(courts)
      .leftJoin(sports, eq(courts.sportId, sports.id))
      .where(and(...conditions))
      .orderBy(asc(courts.sortOrder), asc(courts.name));
  }

  async findCourtById(id: string) {
    const [row] = await this.db
      .select()
      .from(courts)
      .where(and(eq(courts.id, id), isNull(courts.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async createCourt(venueId: string, input: CreateCourtInput) {
    const [row] = await this.db
      .insert(courts)
      .values({
        venueId,
        name: input.name,
        description: input.description ?? null,
        sportId: input.sportId ?? null,
        status: "active",
      })
      .returning();
    if (!row) {
      throw new Error("Không thể tạo sân con.");
    }
    return row;
  }

  async updateCourt(id: string, input: UpdateCourtInput) {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.sportId !== undefined) updateData.sportId = input.sportId;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;

    const [row] = await this.db
      .update(courts)
      .set(updateData)
      .where(and(eq(courts.id, id), isNull(courts.deletedAt)))
      .returning();
    return row ?? null;
  }

  async softDeleteCourt(id: string) {
    const [row] = await this.db
      .update(courts)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(courts.id, id), isNull(courts.deletedAt)))
      .returning();
    return row ?? null;
  }

  // Opening Hours
  async getOpeningHours(courtId: string) {
    return this.db
      .select()
      .from(openingHours)
      .where(eq(openingHours.courtId, courtId))
      .orderBy(asc(openingHours.dayOfWeek));
  }

  async upsertOpeningHours(courtId: string, hours: UpdateOpeningHoursInput) {
    return this.db.transaction(async (tx) => {
      await tx
        .delete(openingHours)
        .where(eq(openingHours.courtId, courtId));

      const rowsToInsert = hours
        .filter((h) => !h.isClosed)
        .map((h) => ({
          courtId,
          dayOfWeek: h.weekday,
          openTime: h.openTime,
          closeTime: h.closeTime,
        }));

      if (rowsToInsert.length > 0) {
        await tx.insert(openingHours).values(rowsToInsert);
      }

      return tx
        .select()
        .from(openingHours)
        .where(eq(openingHours.courtId, courtId))
        .orderBy(asc(openingHours.dayOfWeek));
    });
  }

  // Pricing Rules
  async getPricingRules(courtId: string) {
    return this.db
      .select()
      .from(pricingRules)
      .where(eq(pricingRules.courtId, courtId))
      .orderBy(asc(pricingRules.startTime));
  }

  async findPricingRuleById(courtId: string, ruleId: string) {
    const [row] = await this.db
      .select()
      .from(pricingRules)
      .where(and(eq(pricingRules.id, ruleId), eq(pricingRules.courtId, courtId)))
      .limit(1);
    return row ?? null;
  }

  async createPricingRule(courtId: string, input: PricingRuleInput) {
    const [row] = await this.db
      .insert(pricingRules)
      .values({
        courtId,
        name: input.label,
        pricePerSlot: input.pricePerSlot,
        startTime: input.startTime,
        endTime: input.endTime,
        dayOfWeek: input.weekdays,
      })
      .returning();
    return row;
  }

  async updatePricingRule(
    courtId: string,
    ruleId: string,
    input: Partial<PricingRuleInput>,
  ) {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (input.label !== undefined) updateData.name = input.label;
    if (input.pricePerSlot !== undefined)
      updateData.pricePerSlot = input.pricePerSlot;
    if (input.startTime !== undefined) updateData.startTime = input.startTime;
    if (input.endTime !== undefined) updateData.endTime = input.endTime;
    if (input.weekdays !== undefined) updateData.dayOfWeek = input.weekdays;

    const [row] = await this.db
      .update(pricingRules)
      .set(updateData)
      .where(
        and(eq(pricingRules.id, ruleId), eq(pricingRules.courtId, courtId)),
      )
      .returning();
    return row ?? null;
  }

  async deletePricingRule(courtId: string, ruleId: string) {
    const [row] = await this.db
      .delete(pricingRules)
      .where(
        and(eq(pricingRules.id, ruleId), eq(pricingRules.courtId, courtId)),
      )
      .returning();
    return row ?? null;
  }

  // ===== Phạm vi cơ sở (dùng cho màn "Kênh chủ sân") =====

  /**
   * DB lưu giờ mở cửa / bảng giá theo từng sân con (docs/04), còn UI chủ sân
   * cấu hình một lần cho cả cơ sở. Vì vậy:
   * - Đọc: lấy cấu hình của sân "chính" (sortOrder nhỏ nhất).
   * - Ghi: áp dụng cho toàn bộ sân con còn hoạt động của cơ sở.
   */
  async findCourtIdsByVenueId(venueId: string) {
    const rows = await this.db
      .select({ id: courts.id })
      .from(courts)
      .where(and(eq(courts.venueId, venueId), isNull(courts.deletedAt)))
      .orderBy(asc(courts.sortOrder), asc(courts.createdAt));
    return rows.map((row) => row.id);
  }

  async findPrimaryCourtIdByVenueId(venueId: string) {
    const [row] = await this.db
      .select({ id: courts.id })
      .from(courts)
      .where(and(eq(courts.venueId, venueId), isNull(courts.deletedAt)))
      .orderBy(asc(courts.sortOrder), asc(courts.createdAt))
      .limit(1);
    return row?.id ?? null;
  }

  async upsertOpeningHoursForCourts(
    courtIds: string[],
    hours: UpdateOpeningHoursInput,
  ) {
    const primaryCourtId = courtIds[0];
    if (!primaryCourtId) return [];

    return this.db.transaction(async (tx) => {
      await tx
        .delete(openingHours)
        .where(inArray(openingHours.courtId, courtIds));

      const rowsToInsert = hours
        .filter((hour) => !hour.isClosed)
        .flatMap((hour) =>
          courtIds.map((courtId) => ({
            courtId,
            dayOfWeek: hour.weekday,
            openTime: hour.openTime,
            closeTime: hour.closeTime,
          })),
        );

      if (rowsToInsert.length > 0) {
        await tx.insert(openingHours).values(rowsToInsert);
      }

      return tx
        .select()
        .from(openingHours)
        .where(eq(openingHours.courtId, primaryCourtId))
        .orderBy(asc(openingHours.dayOfWeek));
    });
  }

  async createPricingRuleForCourts(
    courtIds: string[],
    input: PricingRuleInput,
  ) {
    if (courtIds.length === 0) return [];
    return this.db
      .insert(pricingRules)
      .values(
        courtIds.map((courtId) => ({
          courtId,
          name: input.label,
          pricePerSlot: input.pricePerSlot,
          startTime: input.startTime,
          endTime: input.endTime,
          dayOfWeek: input.weekdays,
        })),
      )
      .returning();
  }

  async findPricingRuleWithCourt(ruleId: string) {
    const [row] = await this.db
      .select({
        rule: pricingRules,
        venueId: courts.venueId,
      })
      .from(pricingRules)
      .innerJoin(courts, eq(pricingRules.courtId, courts.id))
      .where(eq(pricingRules.id, ruleId))
      .limit(1);
    return row ?? null;
  }

  /**
   * Xoá khung giá ở phạm vi cơ sở: xoá bản ghi được chọn và các bản sao cùng
   * tên/khung giờ ở những sân con khác (do thao tác tạo ở cấp cơ sở sinh ra).
   */
  async deletePricingRuleAcrossVenue(
    venueId: string,
    signature: { name: string; startTime: string; endTime: string },
  ) {
    const courtIds = await this.findCourtIdsByVenueId(venueId);
    if (courtIds.length === 0) return null;

    const [row] = await this.db
      .delete(pricingRules)
      .where(
        and(
          inArray(pricingRules.courtId, courtIds),
          eq(pricingRules.name, signature.name),
          eq(pricingRules.startTime, signature.startTime),
          eq(pricingRules.endTime, signature.endTime),
        ),
      )
      .returning();
    return row ?? null;
  }
}
