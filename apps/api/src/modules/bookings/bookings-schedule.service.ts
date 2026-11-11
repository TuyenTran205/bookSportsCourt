import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { BookingsRepository } from "./bookings.repository.js";

@Injectable()
export class BookingsScheduleService {
  private readonly logger = new Logger(BookingsScheduleService.name);
  private runningExpire = false;
  private runningAutoComplete = false;

  constructor(
    private readonly repo: BookingsRepository,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCronExpireHolds(): Promise<void> {
    if (this.config.get<string>("NODE_ENV") === "test") return;
    await this.expireHolds();
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCronAutoComplete(): Promise<void> {
    if (this.config.get<string>("NODE_ENV") === "test") return;
    await this.autoCompleteBookings();
  }

  /**
   * Dọn dẹp theo lô (batch 500) các lượt giữ chỗ (`held`) đã quá `expires_at`.
   * Chuyển đồng bộ cả `bookings.status = 'expired'` và `payments.status = 'expired'`.
   */
  async expireHolds(batchLimit = 500): Promise<number> {
    if (this.runningExpire) return 0;
    this.runningExpire = true;
    try {
      const count = await this.repo.batchExpireHoldsCron(batchLimit);
      if (count > 0) {
        this.logger.log(`Expired ${count} stale holds.`);
      }
      return count;
    } catch {
      this.logger.error("Failed to expire stale holds; will retry next tick.");
      return 0;
    } finally {
      this.runningExpire = false;
    }
  }

  /**
   * Tự động hoàn tất (`confirmed` -> `completed`) các đơn đã qua giờ kết thúc + khoảng đệm `AUTOCOMPLETE_GRACE_MINUTES` (mặc định 30 phút).
   */
  async autoCompleteBookings(): Promise<number> {
    if (this.runningAutoComplete) return 0;
    this.runningAutoComplete = true;
    try {
      const graceMinutes = Number(
        this.config.get("AUTOCOMPLETE_GRACE_MINUTES") ?? 30,
      );
      const count = await this.repo.batchAutoCompleteBookingsCron(
        Number.isFinite(graceMinutes) && graceMinutes >= 0 ? graceMinutes : 30,
      );
      if (count > 0) {
        this.logger.log(`Auto-completed ${count} finished bookings.`);
      }
      return count;
    } catch {
      this.logger.error(
        "Failed to auto-complete finished bookings; will retry next tick.",
      );
      return 0;
    } finally {
      this.runningAutoComplete = false;
    }
  }
}
