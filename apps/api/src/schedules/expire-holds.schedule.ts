import { Injectable, Logger, Optional } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import {
  InjectDrizzle,
  type DrizzleDb,
} from "../database/database.module.js";
import {
  bookings,
  courts,
  payments,
  venues,
} from "../database/schema/index.js";
import { BookingsService } from "../modules/bookings/bookings.service.js";
import { toVnDateParts } from "../modules/bookings/bookings.rules.js";
import { RealtimePublisher } from "../modules/realtime/realtime.publisher.js";

@Injectable()
export class ExpireHoldsSchedule {
  private readonly logger = new Logger(ExpireHoldsSchedule.name);

  constructor(
    @InjectDrizzle() private readonly db: DrizzleDb,
    @Optional() private readonly realtime?: RealtimePublisher,
    @Optional() private readonly bookings?: BookingsService,
  ) {}

  @Cron("* * * * *") // Mỗi phút
  async handleCron(): Promise<void> {
    try {
      const now = new Date();
      const expiredItems = await this.db.transaction(async (tx) => {
        const expired = await tx
          .update(bookings)
          .set({ status: "expired", expiresAt: null, updatedAt: now })
          .where(and(eq(bookings.status, "held"), lt(bookings.expiresAt, now)))
          .returning({
            id: bookings.id,
            courtId: bookings.courtId,
            customerId: bookings.customerId,
            start: sql`lower(${bookings.during})`.mapWith(
              (v) => new Date(String(v)),
            ),
          });

        if (expired.length === 0) return [];

        // BẮT BUỘC: Cập nhật payments cùng lúc để không lệch trạng thái
        const bookingIds = expired.map((b) => b.id);
        await tx
          .update(payments)
          .set({ status: "expired", updatedAt: now })
          .where(inArray(payments.bookingId, bookingIds));

        const courtIds = [...new Set(expired.map((b) => b.courtId))];
        const courtMeta = await tx
          .select({
            courtId: courts.id,
            venueId: venues.id,
            ownerId: venues.ownerId,
          })
          .from(courts)
          .innerJoin(venues, eq(venues.id, courts.venueId))
          .where(inArray(courts.id, courtIds));
        const metaByCourt = new Map(courtMeta.map((c) => [c.courtId, c]));

        this.logger.log(`Đã giải phóng ${expired.length} lượt hold hết hạn.`);
        return expired.map((b) => ({
          ...b,
          venueId: metaByCourt.get(b.courtId)?.venueId,
          ownerId: metaByCourt.get(b.courtId)?.ownerId,
        }));
      });

      if (expiredItems.length === 0) return;
      const refreshedSlots = new Set<string>();
      for (const item of expiredItems) {
        if (item.customerId) {
          this.realtime?.emitHoldExpired(
            item.customerId,
            { courtId: item.courtId, bookingId: item.id },
            item.ownerId,
          );
        }
        if (item.venueId && this.bookings) {
          const slotKey = `${item.venueId}:${item.courtId}:${toVnDateParts(item.start).dateStr}`;
          if (!refreshedSlots.has(slotKey)) {
            refreshedSlots.add(slotKey);
            await this.bookings.publishSlotUpdate(
              item.venueId,
              item.courtId,
              item.start,
            );
          }
        }
      }
    } catch (err: any) {
      this.logger.error("Lỗi khi chạy cron giải phóng hold:", err.stack);
    }
  }
}
