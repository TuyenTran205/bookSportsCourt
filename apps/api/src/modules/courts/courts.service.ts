import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { VenuesRepository } from "../venues/venues.repository.js";
import { OwnershipService } from "../auth/ownership.service.js";
import { CourtsRepository } from "./courts.repository.js";
import type {
  CreateCourtInput,
  PricingRuleInput,
  UpdateCourtInput,
  UpdateOpeningHoursInput,
} from "../../../../../packages/shared/src/schemas.js";
import type {
  OpeningHour,
  PricingRule,
} from "../../../../../packages/shared/src/types.js";

/** Postgres trả `time` dạng `HH:mm:ss`; hợp đồng API dùng `HH:mm`. */
function toHhMm(value: string): string {
  return value.slice(0, 5);
}

/** Giờ mặc định khi một thứ chưa được cấu hình (đánh dấu là ngày nghỉ). */
const DEFAULT_OPEN_TIME = "06:00";
const DEFAULT_CLOSE_TIME = "22:00";
const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

interface OpeningHourRow {
  id: string;
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
}

@Injectable()
export class CourtsService {
  constructor(
    private readonly repo: CourtsRepository,
    private readonly venuesRepo: VenuesRepository,
    private readonly ownership: OwnershipService,
  ) {}

  async getCourts(venueId: string, isOwnerOrAdmin = false) {
    const venue = await this.venuesRepo.findById(venueId);
    if (!venue) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Cơ sở thể thao không tồn tại.",
      });
    }
    return this.repo.findCourtsByVenueId(venueId, !isOwnerOrAdmin);
  }

  async createCourt(venueId: string, input: CreateCourtInput) {
    const venue = await this.venuesRepo.findById(venueId);
    if (!venue) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Cơ sở thể thao không tồn tại.",
      });
    }

    const court = await this.repo.createCourt(venueId, input);

    // Seed default opening hours 06:00 - 22:00 for all 7 days
    await this.repo.upsertOpeningHours(
      court.id,
      Array.from({ length: 7 }, (_, i) => ({
        weekday: i,
        openTime: "06:00",
        closeTime: "22:00",
        isClosed: false,
      })),
    );

    return court;
  }

  async updateCourt(id: string, input: UpdateCourtInput) {
    const existing = await this.repo.findCourtById(id);
    if (!existing) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Sân con không tồn tại.",
      });
    }
    return this.repo.updateCourt(id, input);
  }

  async deleteCourt(id: string) {
    const existing = await this.repo.findCourtById(id);
    if (!existing) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Sân con không tồn tại.",
      });
    }
    await this.repo.softDeleteCourt(id);
  }

  // Opening Hours
  async getOpeningHours(courtId: string) {
    const court = await this.repo.findCourtById(courtId);
    if (!court) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Sân con không tồn tại.",
      });
    }
    return this.repo.getOpeningHours(courtId);
  }

  async updateOpeningHours(courtId: string, input: UpdateOpeningHoursInput) {
    const court = await this.repo.findCourtById(courtId);
    if (!court) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Sân con không tồn tại.",
      });
    }
    return this.repo.upsertOpeningHours(courtId, input);
  }

  // Pricing Rules
  async getPricingRules(courtId: string) {
    const court = await this.repo.findCourtById(courtId);
    if (!court) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Sân con không tồn tại.",
      });
    }
    return this.repo.getPricingRules(courtId);
  }

  async createPricingRule(courtId: string, input: PricingRuleInput) {
    const court = await this.repo.findCourtById(courtId);
    if (!court) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Sân con không tồn tại.",
      });
    }

    if (input.startTime >= input.endTime) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Giờ kết thúc phải lớn hơn giờ bắt đầu.",
      });
    }

    return this.repo.createPricingRule(courtId, input);
  }

  async updatePricingRule(
    courtId: string,
    ruleId: string,
    input: Partial<PricingRuleInput>,
  ) {
    const existing = await this.repo.findPricingRuleById(courtId, ruleId);
    if (!existing) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Khung giá không tồn tại.",
      });
    }

    const start = input.startTime ?? existing.startTime;
    const end = input.endTime ?? existing.endTime;
    if (start >= end) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Giờ kết thúc phải lớn hơn giờ bắt đầu.",
      });
    }

    return this.repo.updatePricingRule(courtId, ruleId, input);
  }

  async deletePricingRule(courtId: string, ruleId: string) {
    const existing = await this.repo.findPricingRuleById(courtId, ruleId);
    if (!existing) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Khung giá không tồn tại.",
      });
    }
    await this.repo.deletePricingRule(courtId, ruleId);
  }

  // ===== Phạm vi cơ sở (màn "Kênh chủ sân" cấu hình 1 lần cho cả cơ sở) =====

  /**
   * Đọc giờ mở cửa ở phạm vi cơ sở và trả về đúng `OpeningHour` dùng chung
   * (`courtId = null` nghĩa là áp cho cả cơ sở).
   */
  async getVenueOpeningHours(venueId: string): Promise<OpeningHour[]> {
    const primaryCourtId = await this.repo.findPrimaryCourtIdByVenueId(venueId);
    if (!primaryCourtId) return [];

    const rows = await this.repo.getOpeningHours(primaryCourtId);
    return this.toVenueOpeningHours(venueId, rows);
  }

  /** Ghi giờ mở cửa cho toàn bộ sân con của cơ sở. */
  async updateVenueOpeningHours(
    venueId: string,
    hours: UpdateOpeningHoursInput,
  ): Promise<OpeningHour[]> {
    const courtIds = await this.repo.findCourtIdsByVenueId(venueId);
    if (courtIds.length === 0) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Cơ sở chưa có sân con nào để cấu hình giờ mở cửa.",
      });
    }

    const rows = await this.repo.upsertOpeningHoursForCourts(courtIds, hours);
    return this.toVenueOpeningHours(venueId, rows);
  }

  /**
   * Luôn trả đủ 7 thứ để UI hiển thị đúng bảng tuần: thứ chưa cấu hình được
   * coi là ngày nghỉ (`isClosed: true`) thay vì để FE tự mặc định thành mở cửa.
   */
  private toVenueOpeningHours(
    venueId: string,
    rows: OpeningHourRow[],
  ): OpeningHour[] {
    const byWeekday = new Map(rows.map((row) => [row.dayOfWeek, row]));
    return ALL_WEEKDAYS.map((weekday) => {
      const row = byWeekday.get(weekday);
      if (row) {
        return {
          id: row.id,
          venueId,
          courtId: null,
          weekday,
          openTime: toHhMm(row.openTime),
          closeTime: toHhMm(row.closeTime),
          isClosed: false,
        };
      }
      return {
        id: `venue-${venueId}-${weekday}`,
        venueId,
        courtId: null,
        weekday,
        openTime: DEFAULT_OPEN_TIME,
        closeTime: DEFAULT_CLOSE_TIME,
        isClosed: true,
      };
    });
  }

  async getVenuePricingRules(venueId: string): Promise<PricingRule[]> {
    const primaryCourtId = await this.repo.findPrimaryCourtIdByVenueId(venueId);
    if (!primaryCourtId) return [];

    const rows = await this.repo.getPricingRules(primaryCourtId);
    return rows.map((row) => ({
      id: row.id,
      venueId,
      courtId: null,
      label: row.name,
      weekdays: row.dayOfWeek ?? [],
      startTime: toHhMm(row.startTime),
      endTime: toHhMm(row.endTime),
      pricePerSlot: row.pricePerSlot,
    }));
  }

  async createVenuePricingRule(
    venueId: string,
    input: PricingRuleInput,
  ): Promise<PricingRule> {
    if (input.startTime >= input.endTime) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Giờ kết thúc phải lớn hơn giờ bắt đầu.",
      });
    }

    const courtIds = await this.repo.findCourtIdsByVenueId(venueId);
    const [row] = await this.repo.createPricingRuleForCourts(courtIds, input);
    if (!row) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Cơ sở chưa có sân con nào để cấu hình giá.",
      });
    }

    return {
      id: row.id,
      venueId,
      courtId: null,
      label: row.name,
      weekdays: row.dayOfWeek ?? [],
      startTime: toHhMm(row.startTime),
      endTime: toHhMm(row.endTime),
      pricePerSlot: row.pricePerSlot,
    };
  }

  async deleteOwnerPricingRule(userId: string, ruleId: string) {
    const found = await this.repo.findPricingRuleWithCourt(ruleId);
    if (!found) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Khung giá không tồn tại.",
      });
    }

    // Chủ sân chỉ được xoá khung giá thuộc cơ sở của mình; admin được phép.
    await this.ownership.assertOwnership(
      userId,
      found.venueId,
      { resource: "venue", param: "id", allowAdmin: true },
      ["owner", "admin"],
    );

    await this.repo.deletePricingRuleAcrossVenue(found.venueId, {
      name: found.rule.name,
      startTime: found.rule.startTime,
      endTime: found.rule.endTime,
    });
  }
}
