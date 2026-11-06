import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { VenuesRepository } from "../venues/venues.repository.js";
import { CourtsRepository } from "./courts.repository.js";
import type {
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
}

