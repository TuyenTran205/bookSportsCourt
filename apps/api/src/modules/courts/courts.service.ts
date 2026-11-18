import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { VenuesRepository } from "../venues/venues.repository.js";
import { CourtsRepository } from "./courts.repository.js";
import type {
  BlackoutInput,
  CreateCourtInput,
  PricingRuleInput,
  UpdateCourtInput,
  UpdateOpeningHoursInput,
} from "../../../../../packages/shared/src/schemas.js";

@Injectable()
export class CourtsService {
  constructor(
    private readonly repo: CourtsRepository,
    private readonly venuesRepo: VenuesRepository,
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
      venueId,
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
    return this.repo.getOpeningHours(courtId, court.venueId);
  }

  async updateOpeningHours(courtId: string, input: UpdateOpeningHoursInput) {
    const court = await this.repo.findCourtById(courtId);
    if (!court) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Sân con không tồn tại.",
      });
    }
    return this.repo.upsertOpeningHours(courtId, input, court.venueId);
  }

  async getVenueOpeningHours(venueId: string) {
    const venue = await this.venuesRepo.findById(venueId);
    if (!venue) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Cơ sở thể thao không tồn tại.",
      });
    }
    return this.repo.getVenueOpeningHours(venueId);
  }

  async updateVenueOpeningHours(venueId: string, input: UpdateOpeningHoursInput) {
    const venue = await this.venuesRepo.findById(venueId);
    if (!venue) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Cơ sở thể thao không tồn tại.",
      });
    }
    return this.repo.upsertVenueOpeningHours(venueId, input);
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
    return this.repo.getPricingRules(courtId, court.venueId);
  }

  async getVenuePricingRules(venueId: string) {
    const venue = await this.venuesRepo.findById(venueId);
    if (!venue) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Cơ sở thể thao không tồn tại.",
      });
    }
    return this.repo.getVenuePricingRules(venueId);
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

    return this.repo.createPricingRule(courtId, input, court.venueId);
  }

  async createVenuePricingRule(
    venueId: string,
    input: PricingRuleInput & { courtId?: string | null },
  ) {
    const venue = await this.venuesRepo.findById(venueId);
    if (!venue) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Cơ sở thể thao không tồn tại.",
      });
    }
    if (input.startTime >= input.endTime) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Giờ kết thúc phải lớn hơn giờ bắt đầu.",
      });
    }
    if (input.courtId) {
      return this.createPricingRule(input.courtId, input);
    }
    const venueCourts = await this.repo.findCourtsByVenueId(venueId, false);
    if (venueCourts.length === 0) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Cơ sở chưa có sân con để áp dụng bảng giá.",
      });
    }
    let created = null;
    for (const court of venueCourts) {
      created = await this.repo.createPricingRule(court.id, input, venueId);
    }
    return created;
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

    const court = await this.repo.findCourtById(courtId);
    return this.repo.updatePricingRule(
      courtId,
      ruleId,
      input,
      court?.venueId ?? "",
    );
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

  async deletePricingRuleByOwner(userId: string, ruleId: string) {
    const found = await this.repo.findPricingRuleByRuleId(ruleId);
    if (!found) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Khung giá không tồn tại.",
      });
    }
    const venue = await this.venuesRepo.findById(found.venueId);
    if (!venue || venue.ownerId !== userId) {
      throw new ForbiddenException({
        code: "NOT_VENUE_OWNER",
        message: "Bạn không sở hữu cơ sở chứa khung giá này.",
      });
    }
    await this.repo.deleteVenuePricingRule(found.venueId, found.rule);
  }

  // ===== Blackouts =====

  async createBlackout(courtId: string, input: BlackoutInput) {
    const court = await this.repo.findCourtById(courtId);
    if (!court) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Sân con không tồn tại.",
      });
    }
    const start = new Date(input.start);
    const end = new Date(input.end);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      throw new BadRequestException({
        code: "INVALID_TIME_RANGE",
        message: "Thời gian bắt đầu phải trước thời gian kết thúc.",
      });
    }
    return this.repo.createBlackout(courtId, input);
  }

  async listBlackouts(courtId: string, from?: string, to?: string) {
    const court = await this.repo.findCourtById(courtId);
    if (!court) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Sân con không tồn tại.",
      });
    }
    return this.repo.listBlackouts(courtId, from, to);
  }

  async deleteBlackout(courtId: string, blackoutId: string) {
    const deleted = await this.repo.deleteBlackout(courtId, blackoutId);
    if (!deleted) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Khoảng khoá sân không tồn tại.",
      });
    }
    return deleted;
  }
}
