import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { and, eq, sql } from "drizzle-orm";
import {
  InjectDrizzle,
  type DrizzleDb,
} from "../database/database.module.js";
import { bookings } from "../database/schema/index.js";

const DEFAULT_AUTOCOMPLETE_GRACE_MS = 30 * 60 * 1000; // 30 phút đệm sau trận đấu

@Injectable()
export class AutoCompleteBookingsSchedule {
  private readonly logger = new Logger(AutoCompleteBookingsSchedule.name);

  constructor(@InjectDrizzle() private readonly db: DrizzleDb) {}

  @Cron("*/5 * * * *") // Mỗi 5 phút
  async handleCron(): Promise<void> {
    try {
      const graceMs = parseInt(
        process.env.AUTOCOMPLETE_GRACE || String(DEFAULT_AUTOCOMPLETE_GRACE_MS),
        10,
      );
      const cutoff = new Date(Date.now() - graceMs);
      const now = new Date();

      const completed = await this.db
        .update(bookings)
        .set({ status: "completed", updatedAt: now })
        .where(
          and(
            eq(bookings.status, "confirmed"),
            sql`upper(${bookings.during}) < ${cutoff}`,
          ),
        )
        .returning({ id: bookings.id });

      if (completed.length > 0) {
        this.logger.log(
          `Đã tự động chuyển hoàn tất (completed) cho ${completed.length} booking.`,
        );
      }
    } catch (err: any) {
      this.logger.error("Lỗi khi chạy cron auto-complete bookings:", err.stack);
    }
  }
}
