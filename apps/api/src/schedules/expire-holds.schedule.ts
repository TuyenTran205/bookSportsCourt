import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { and, eq, inArray, lt } from "drizzle-orm";
import {
  InjectDrizzle,
  type DrizzleDb,
} from "../database/database.module.js";
import { bookings, payments } from "../database/schema/index.js";

@Injectable()
export class ExpireHoldsSchedule {
  private readonly logger = new Logger(ExpireHoldsSchedule.name);

  constructor(@InjectDrizzle() private readonly db: DrizzleDb) {}

  @Cron("* * * * *") // Mỗi phút
  async handleCron(): Promise<void> {
    try {
      const now = new Date();
      await this.db.transaction(async (tx) => {
        const expired = await tx
          .update(bookings)
          .set({ status: "expired", expiresAt: null, updatedAt: now })
          .where(and(eq(bookings.status, "held"), lt(bookings.expiresAt, now)))
          .returning({ id: bookings.id, courtId: bookings.courtId });

        if (expired.length === 0) return;

        // BẮT BUỘC: Cập nhật payments cùng lúc để không lệch trạng thái
        const bookingIds = expired.map((b) => b.id);
        await tx
          .update(payments)
          .set({ status: "expired", updatedAt: now })
          .where(inArray(payments.bookingId, bookingIds));

        this.logger.log(`Đã giải phóng ${expired.length} lượt hold hết hạn.`);
      });
    } catch (err: any) {
      this.logger.error("Lỗi khi chạy cron giải phóng hold:", err.stack);
    }
  }
}
