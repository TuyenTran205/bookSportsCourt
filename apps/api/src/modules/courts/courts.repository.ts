import { Injectable } from "@nestjs/common";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  InjectDrizzle,
  type DrizzleDb,
} from "../../database/database.module.js";
import {
  blackoutPeriods,
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

function mapOpeningHoursForCourt(
  courtId: string,
  venueId: string,
  rows: Array<typeof openingHours.$inferSelect>,
  asVenueDefault = false,
) {
  return [1, 2, 3, 4, 5, 6, 0].map((weekday) => {
    const found = rows.find((r) => r.dayOfWeek === weekday);
    return {
      id: found?.id ?? `${courtId}-oh-${weekday}`,
      venueId,
      courtId: asVenueDefault ? null : courtId,
      weekday,
      dayOfWeek: weekday,
      openTime: found ? found.openTime.slice(0, 5) : "06:00",
      closeTime: found ? found.closeTime.slice(0, 5) : "22:00",
      isClosed: !found,
    };
  });
}

function mapPricingRuleRow(
  row: typeof pricingRules.$inferSelect,
  venueId: string,
) {
  return {
    id: row.id,
    venueId,
    courtId: row.courtId,
    label: row.name,
    name: row.name,
    weekdays: row.dayOfWeek,
    dayOfWeek: row.dayOfWeek,
    startTime: row.startTime.slice(0, 5),
    endTime: row.endTime.slice(0, 5),
    pricePerSlot: row.pricePerSlot,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

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
  async getOpeningHours(courtId: string, venueId = "") {
    const rows = await this.db
      .select()
      .from(openingHours)
      .where(eq(openingHours.courtId, courtId))
      .orderBy(asc(openingHours.dayOfWeek));
    return mapOpeningHoursForCourt(courtId, venueId, rows, false);
  }

  async upsertOpeningHours(
    courtId: string,
    hours: UpdateOpeningHoursInput,
    venueId = "",
  ) {
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

      const rows = await tx
        .select()
        .from(openingHours)
        .where(eq(openingHours.courtId, courtId))
        .orderBy(asc(openingHours.dayOfWeek));
      return mapOpeningHoursForCourt(courtId, venueId, rows, false);
    });
  }

  async getVenueOpeningHours(venueId: string) {
    const venueCourts = await this.findCourtsByVenueId(venueId, false);
    const firstCourt = venueCourts[0];
    if (!firstCourt) {
      return mapOpeningHoursForCourt(venueId, venueId, [], true);
    }
    const rows = await this.db
      .select()
      .from(openingHours)
      .where(eq(openingHours.courtId, firstCourt.id))
      .orderBy(asc(openingHours.dayOfWeek));
    return mapOpeningHoursForCourt(firstCourt.id, venueId, rows, true);
  }

  async upsertVenueOpeningHours(venueId: string, hours: UpdateOpeningHoursInput) {
    const venueCourts = await this.findCourtsByVenueId(venueId, false);
    for (const court of venueCourts) {
      await this.upsertOpeningHours(court.id, hours, venueId);
    }
    return this.getVenueOpeningHours(venueId);
  }

  // Pricing Rules
  async getPricingRules(courtId: string, venueId = "") {
    const rows = await this.db
      .select()
      .from(pricingRules)
      .where(eq(pricingRules.courtId, courtId))
      .orderBy(asc(pricingRules.startTime));
    return rows.map((row) => mapPricingRuleRow(row, venueId));
  }

  async getVenuePricingRules(venueId: string) {
    const venueCourts = await this.findCourtsByVenueId(venueId, false);
    const courtIds = venueCourts.map((c) => c.id);
    if (courtIds.length === 0) return [];
    const rows = await this.db
      .select()
      .from(pricingRules)
      .where(inArray(pricingRules.courtId, courtIds))
      .orderBy(asc(pricingRules.startTime), asc(pricingRules.createdAt));

    // Deduplicate rules replicated across all courts of the venue
    const seen = new Map<string, typeof rows[0]>();
    for (const row of rows) {
      const weekdaysKey = (row.dayOfWeek ?? []).slice().sort().join(',');
      const key = `${row.name}|${row.startTime}|${row.endTime}|${weekdaysKey}|${row.pricePerSlot}`;
      if (!seen.has(key)) {
        seen.set(key, row);
      }
    }
    return Array.from(seen.values()).map((row) => mapPricingRuleRow(row, venueId));
  }

  async findPricingRuleById(courtId: string, ruleId: string) {
    const [row] = await this.db
      .select()
      .from(pricingRules)
      .where(and(eq(pricingRules.id, ruleId), eq(pricingRules.courtId, courtId)))
      .limit(1);
    return row ?? null;
  }

  async findPricingRuleByRuleId(ruleId: string) {
    const [row] = await this.db
      .select({
        rule: pricingRules,
        venueId: courts.venueId,
      })
      .from(pricingRules)
      .innerJoin(courts, eq(courts.id, pricingRules.courtId))
      .where(eq(pricingRules.id, ruleId))
      .limit(1);
    return row ?? null;
  }

  async createPricingRule(
    courtId: string,
    input: PricingRuleInput,
    venueId = "",
  ) {
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
    return row ? mapPricingRuleRow(row, venueId) : null;
  }

  async updatePricingRule(
    courtId: string,
    ruleId: string,
    input: Partial<PricingRuleInput>,
    venueId = "",
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
    return row ? mapPricingRuleRow(row, venueId) : null;
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

  async deleteVenuePricingRule(
    venueId: string,
    rule: typeof pricingRules.$inferSelect,
  ) {
    const venueCourts = await this.findCourtsByVenueId(venueId, false);
    const courtIds = venueCourts.map((c) => c.id);
    if (courtIds.length === 0) {
      await this.deletePricingRule(rule.courtId, rule.id);
      return;
    }

    await this.db
      .delete(pricingRules)
      .where(
        and(
          inArray(pricingRules.courtId, courtIds),
          eq(pricingRules.name, rule.name),
          eq(pricingRules.startTime, rule.startTime),
          eq(pricingRules.endTime, rule.endTime),
          eq(pricingRules.pricePerSlot, rule.pricePerSlot),
        ),
      );
  }

  // ===== Blackouts =====

  async createBlackout(
    courtId: string,
    input: { start: string; end: string; reason?: string },
  ) {
    const [row] = await this.db
      .insert(blackoutPeriods)
      .values({
        courtId,
        during: sql`tstzrange(${input.start}::timestamptz, ${input.end}::timestamptz)`,
        reason: input.reason ?? null,
      })
      .returning();
    return row
      ? {
          id: row.id,
          courtId: row.courtId,
          start: input.start,
          end: input.end,
          reason: row.reason ?? undefined,
          createdAt: row.createdAt
            ? new Date(row.createdAt).toISOString()
            : new Date().toISOString(),
        }
      : null;
  }

  async listBlackouts(courtId: string, from?: string, to?: string) {
    const conditions = [eq(blackoutPeriods.courtId, courtId)];
    if (from && to) {
      conditions.push(
        sql`${blackoutPeriods.during} && tstzrange(${from}::timestamptz, ${to}::timestamptz)`,
      );
    } else if (from) {
      conditions.push(
        sql`upper(${blackoutPeriods.during}) >= ${from}::timestamptz`,
      );
    } else if (to) {
      conditions.push(
        sql`lower(${blackoutPeriods.during}) <= ${to}::timestamptz`,
      );
    }
    const rows = await this.db
      .select({
        id: blackoutPeriods.id,
        courtId: blackoutPeriods.courtId,
        reason: blackoutPeriods.reason,
        start: sql<Date>`lower(${blackoutPeriods.during})`,
        end: sql<Date>`upper(${blackoutPeriods.during})`,
        createdAt: blackoutPeriods.createdAt,
      })
      .from(blackoutPeriods)
      .where(and(...conditions))
      .orderBy(asc(sql`lower(${blackoutPeriods.during})`));

    return rows.map((r) => ({
      id: r.id,
      courtId: r.courtId,
      start: r.start ? new Date(r.start).toISOString() : "",
      end: r.end ? new Date(r.end).toISOString() : "",
      reason: r.reason ?? undefined,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : undefined,
    }));
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
}
