import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PaymentReviewService } from "../modules/payments/payment-review.service.js";

@Injectable()
export class CancelStalePaymentsSchedule {
  private readonly logger = new Logger(CancelStalePaymentsSchedule.name);
  private running = false;
  constructor(private readonly service: PaymentReviewService) {}
  @Cron(CronExpression.EVERY_5_MINUTES)
  async run() {
    if (this.running) return;
    this.running = true;
    try {
      this.logger.log(await this.service.expireBatch());
    } catch {
      this.logger.error(
        "Payment expiry scan failed; next schedule will retry.",
      );
    } finally {
      this.running = false;
    }
  }
}
