import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import {
  InjectDrizzle,
  type DrizzleDb,
} from "../../database/database.module.js";
import {
  notifications,
  outboxDeliveries,
} from "../../database/schema/index.js";

@Injectable()
export class BookingRemindersRepository {
  constructor(@InjectDrizzle() private readonly db: DrizzleDb) {}
  async enqueueBatch() {
    const due = await this.db.execute<{
      id: string;
      customer_id: string;
      court_id: string;
      venue_id: string;
    }>(sql`
      SELECT b.id, b.customer_id, b.court_id, c.venue_id FROM bookings b
      JOIN courts c ON c.id = b.court_id WHERE b.status = 'confirmed' AND b.customer_id IS NOT NULL
      AND b.reminders_sent_at IS NULL AND lower(b.during) > now()
      AND lower(b.during) <= now() + interval '24 hours'
      AND NOT EXISTS (SELECT 1 FROM outbox_deliveries d WHERE d.channel = 'email'
        AND d.event_key = 'booking:' || b.id || ':reminder' AND d.recipient_id = b.customer_id)
      ORDER BY lower(b.during), b.id LIMIT 100`);
    let enqueued = 0;
    for (const row of due.rows) {
      const inserted = await this.db.transaction(async (tx) => {
        const user =
          await tx.execute(sql`SELECT id FROM users WHERE id = ${row.customer_id}
          AND deleted_at IS NULL FOR UPDATE`);
        if (!user.rowCount) return false;
        await tx.execute(
          sql`SELECT id FROM venues WHERE id = ${row.venue_id} FOR SHARE`,
        );
        const court = await tx.execute(
          sql`SELECT id FROM courts WHERE id = ${row.court_id} AND venue_id = ${row.venue_id} FOR SHARE`,
        );
        if (!court.rowCount) return false;
        const booking =
          await tx.execute(sql`SELECT id FROM bookings WHERE id = ${row.id}
          AND court_id = ${row.court_id} AND customer_id = ${row.customer_id}
          AND status = 'confirmed' AND reminders_sent_at IS NULL
          AND lower(during) > now() AND lower(during) <= now() + interval '24 hours' FOR UPDATE`);
        if (!booking.rowCount) return false;
        const eventKey = `booking:${row.id}:reminder`;
        const payload = { bookingId: row.id, venueId: row.venue_id };
        const delivery = await tx
          .insert(outboxDeliveries)
          .values({
            eventKey,
            eventType: "booking_reminder",
            channel: "email",
            recipientId: row.customer_id,
            payload,
          })
          .onConflictDoNothing()
          .returning();
        if (!delivery.length) return false;
        await tx
          .insert(notifications)
          .values({
            eventKey,
            userId: row.customer_id,
            type: "booking_reminder",
            title: "Nhắc lịch đặt sân",
            body: "Bạn có lịch đặt sân sắp tới. Xem chi tiết đặt sân.",
            data: payload,
          })
          .onConflictDoNothing();
        return true;
      });
      if (inserted) enqueued++;
    }
    return enqueued;
  }
}
