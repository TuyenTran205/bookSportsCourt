import { Injectable } from "@nestjs/common";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  InjectDrizzle,
  type DrizzleDb,
} from "../../database/database.module.js";
import { bookings, courts, payments } from "../../database/schema/index.js";
import type { AuthTransaction } from "../auth/auth.repository.js";
import type {
  AdminBookingQueryInput,
  AdminStatsQueryInput,
} from "../../../../../packages/shared/src/phase4-schemas.js";
import type { BookingAdmin } from "../../../../../packages/shared/src/phase4-responses.js";
import type { ReportRange } from "./reporting.rules.js";

@Injectable()
export class AdminReportingRepository {
  constructor(@InjectDrizzle() private readonly db: DrizzleDb) {}
  snapshot<T>(work: (tx: AuthTransaction, now: Date) => Promise<T>) {
    return this.db.transaction(
      async (tx) => {
        const result = await tx.execute<{ now: string }>(
          sql`select transaction_timestamp() as now`,
        );
        return work(tx, new Date(result.rows[0]!.now));
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
  private start(range: ReportRange) {
    return sql`(${range.from}::date::timestamp at time zone 'Asia/Ho_Chi_Minh')`;
  }
  private end(range: ReportRange) {
    return sql`((${range.to}::date + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh')`;
  }
  private scope(query: AdminBookingQueryInput, range: ReportRange) {
    return and(
      sql`lower(${bookings.during}) >= ${this.start(range)} and lower(${bookings.during}) < ${this.end(range)}`,
      query.status ? eq(bookings.status, query.status) : undefined,
      query.venueId ? eq(courts.venueId, query.venueId) : undefined,
      query.customerId ? eq(bookings.customerId, query.customerId) : undefined,
    );
  }
  async bookingCount(
    tx: AuthTransaction,
    query: AdminBookingQueryInput,
    range: ReportRange,
  ) {
    const [row] = await tx
      .select({ total: sql<string>`count(*)::text` })
      .from(bookings)
      .innerJoin(courts, eq(courts.id, bookings.courtId))
      .where(this.scope(query, range));
    return row!.total;
  }
  async bookingRows(
    tx: AuthTransaction,
    query: AdminBookingQueryInput,
    range: ReportRange,
  ) {
    return tx
      .select({
        id: bookings.id,
        courtId: bookings.courtId,
        venueId: courts.venueId,
        customerId: bookings.customerId,
        source: bookings.source,
        guestName: bookings.guestName,
        guestPhoneMasked: sql<
          string | null
        >`case when ${bookings.guestPhone} is null then null else repeat('*',greatest(length(${bookings.guestPhone})-3,0)) || right(${bookings.guestPhone},3) end`,
        start: sql`lower(${bookings.during})`.mapWith(
          (value) => new Date(String(value)),
        ),
        end: sql`upper(${bookings.during})`.mapWith(
          (value) => new Date(String(value)),
        ),
        status: bookings.status,
        totalPrice: bookings.totalPrice,
        depositAmount: bookings.depositAmount,
        expiresAt: bookings.expiresAt,
        cancelReason: bookings.cancelReason,
        cancelledAt: bookings.cancelledAt,
        createdAt: bookings.createdAt,
        updatedAt: bookings.updatedAt,
        payment: sql<
          BookingAdmin["payment"]
        >`(select json_build_object('id',p.id,'provider',p.provider,'amount',p.amount,'status',p.status,'paidAt',p.paid_at,'refundAmount',p.refund_amount,'refundedAt',p.refunded_at) from ${payments} p where p.booking_id=${bookings.id} order by case when p.status in ('pending','submitted','completed') then 0 else 1 end,p.created_at desc,p.id desc limit 1)`,
      })
      .from(bookings)
      .innerJoin(courts, eq(courts.id, bookings.courtId))
      .where(this.scope(query, range))
      .orderBy(desc(bookings.createdAt), desc(bookings.id))
      .limit(query.limit)
      .offset((query.page - 1) * query.limit);
  }
  async bookingGroups(
    tx: AuthTransaction,
    range: ReportRange,
    group: AdminStatsQueryInput["groupBy"],
  ) {
    return (
      await tx.execute<{ date: string; status: string; n: string }>(sql`
      select to_char(date_trunc(${group},lower(during) at time zone 'Asia/Ho_Chi_Minh'),'YYYY-MM-DD') as date,status,count(*)::text as n
      from bookings where lower(during)>=${this.start(range)} and lower(during)<${this.end(range)} group by 1,2`)
    ).rows;
  }
  async moneyFlows(
    tx: AuthTransaction,
    range: ReportRange,
    group: AdminStatsQueryInput["groupBy"],
  ) {
    const gross = await tx.execute<{ date: string; amount: string }>(sql`
      select to_char(date_trunc(${group},paid_at at time zone 'Asia/Ho_Chi_Minh'),'YYYY-MM-DD') as date,sum(amount)::text as amount from payments
      where status in ('completed','refunded') and paid_at>=${this.start(range)} and paid_at<${this.end(range)} group by 1`);
    const refunded = await tx.execute<{ date: string; amount: string }>(sql`
      select to_char(date_trunc(${group},refunded_at at time zone 'Asia/Ho_Chi_Minh'),'YYYY-MM-DD') as date,sum(refund_amount)::text as amount from payments
      where status='refunded' and refund_amount is not null and refunded_at>=${this.start(range)} and refunded_at<${this.end(range)} group by 1`);
    return { gross: gross.rows, refunded: refunded.rows };
  }
  async populations(tx: AuthTransaction) {
    const users = await tx.execute<{ role: string; n: string }>(
      sql`select role,count(*)::text as n from users where deleted_at is null group by role`,
    );
    const venues = await tx.execute<{ status: string; n: string }>(
      sql`select status,count(*)::text as n from venues where deleted_at is null group by status`,
    );
    return { users: users.rows, venues: venues.rows };
  }
  async dataQuality(tx: AuthTransaction) {
    const result = await tx.execute<{
      n: string;
    }>(sql`select count(*)::text as n from payments where
      (status in ('completed','refunded') and paid_at is null) or (status='refunded' and (refund_amount is null or refunded_at is null))`);
    return result.rows[0]!.n;
  }
}
