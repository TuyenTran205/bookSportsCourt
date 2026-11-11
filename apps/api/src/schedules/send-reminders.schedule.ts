import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron } from "@nestjs/schedule";
import { BookingRemindersRepository } from "../modules/mail/booking-reminders.repository.js";

@Injectable()
export class SendRemindersSchedule {
  private running = false;
  private readonly logger = new Logger(SendRemindersSchedule.name);
  constructor(
    private readonly repo: BookingRemindersRepository,
    private readonly config: ConfigService,
  ) {}
  @Cron("*/15 * * * *")
  async run() {
    if (this.running || !this.config.get<boolean>("BUSINESS_MAIL_ENABLED"))
      return;
    this.running = true;
    try {
      await this.repo.enqueueBatch();
    } catch {
      this.logger.error("Reminder scan failed; next schedule will catch up.");
    } finally {
      this.running = false;
    }
  }
}
