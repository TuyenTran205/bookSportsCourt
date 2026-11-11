import { Injectable } from "@nestjs/common";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lte,
  sql,
} from "drizzle-orm";
import { v7 } from "uuid";
import type {
  BookingSource,
  BookingStatus,
  PaymentProvider,
  PaymentStatus,
} from "../../../../../packages/shared/src/constants.js";
import type {
  BankAccountInfo,
  Booking,
  BookingDetail,
  Payment,
  Review,
} from "../../../../../packages/shared/src/types.js";
import {
  InjectDrizzle,
  type DrizzleDb,
} from "../../database/database.module.js";
import {
  blackoutPeriods,
  bookings,
  cancellationPolicies,
  courts,
  notifications,
  openingHours,
  outboxDeliveries,
  payments,
  pricingRules,
  reviews,
  users,
  venuePaymentAccounts,
  venues,
} from "../../database/schema/index.js";
import type { AuthTransaction } from "../auth/auth.repository.js";
import {
  DEFAULT_CANCELLATION_POLICY,
  formatDateToVnIso,
  generateTransferCode,
  maskPhone,
  toPgTstzRange,
  type CancellationPolicyRule,
  type OpeningHourRule,
  type PricingRuleRow,
} from "./bookings.rules.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface RawBookingBundle {
  booking: typeof bookings.$inferSelect;
  start: Date;
  end: Date;
  court: typeof courts.$inferSelect;
  venue: typeof venues.$inferSelect;
  customer: typeof users.$inferSelect | null;
  payment: typeof payments.$inferSelect | null;
  review: typeof reviews.$inferSelect | null;
}

@Injectable()
export class BookingsRepository {
  constructor(@InjectDrizzle() private readonly db: DrizzleDb) {}

  async transaction<T>(work: (tx: AuthTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL statement_timeout = '5000ms'`);
      return work(tx);
    });
  }

  async withSerializableRetry<T>(
    work: (tx: AuthTransaction) => Promise<T>,
    maxRetries = 3,
  ): Promise<T> {
    let attempt = 0;
    while (true) {
      try {
        return await this.db.transaction(
          async (tx) => {
            await tx.execute(sql`SET LOCAL statement_timeout = '5000ms'`);
            return work(tx);
          },
          { isolationLevel: "serializable" },
        );
      } catch (error: unknown) {
        attempt++;
        const code =
          typeof error === "object" && error !== null && "code" in error
            ? String((error as { code?: unknown }).code)
            : "";
        if ((code === "40001" || code === "40P01") && attempt < maxRetries) {
          continue;
        }
        throw error;
      }
    }
  }

  async acquireCourtAdvisoryLock(
    tx: AuthTransaction,
    courtId: string,
  ): Promise<void> {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${courtId}))`);
  }

  async now(tx: AuthTransaction | DrizzleDb = this.db): Promise<Date> {
    const res = await tx.execute<{ now: Date | string }>(
      sql`SELECT clock_timestamp() AS now`,
    );
    const raw = res.rows[0]?.now;
    return raw instanceof Date ? raw : new Date(String(raw));
  }

  /**
   * Lazy-expire các hold đã quá hạn trên một sân cụ thể trong transaction.
   * Cập nhật đồng bộ cả bảng `bookings` và `payments` sang `'expired'`.
   */
  async expireStaleHoldsForCourt(
    tx: AuthTransaction,
    courtId: string,
    now: Date,
  ): Promise<string[]> {
    const expiredBookings = await tx
      .update(bookings)
      .set({ status: "expired", expiresAt: null, updatedAt: now })
      .where(
        and(
          eq(bookings.courtId, courtId),
          eq(bookings.status, "held"),
          lte(bookings.expiresAt, now),
        ),
      )
      .returning({ id: bookings.id });

    if (expiredBookings.length === 0) return [];

    const ids = expiredBookings.map((b) => b.id);
    await tx
      .update(payments)
      .set({ status: "expired", updatedAt: now })
      .where(
        and(inArray(payments.bookingId, ids), eq(payments.status, "pending")),
      );

    return ids;
  }

  /** Lazy-expire các hold đã quá hạn của toàn bộ các sân thuộc một Venue. */
  async expireStaleHoldsForVenue(venueId: string): Promise<number> {
    return this.transaction(async (tx) => {
      const now = await this.now(tx);
      const venueCourts = await tx
        .select({ id: courts.id })
        .from(courts)
        .where(eq(courts.venueId, venueId));

      if (venueCourts.length === 0) return 0;
      const courtIds = venueCourts.map((c) => c.id);

      const expired = await tx
        .update(bookings)
        .set({ status: "expired", expiresAt: null, updatedAt: now })
        .where(
          and(
            inArray(bookings.courtId, courtIds),
            eq(bookings.status, "held"),
            lte(bookings.expiresAt, now),
          ),
        )
        .returning({ id: bookings.id });

      if (expired.length > 0) {
        const bookingIds = expired.map((b) => b.id);
        await tx
          .update(payments)
          .set({ status: "expired", updatedAt: now })
          .where(
            and(
              inArray(payments.bookingId, bookingIds),
              eq(payments.status, "pending"),
            ),
          );
      }

      return expired.length;
    });
  }

  /** Lazy-expire các hold đã quá hạn của một khách hàng cụ thể. */
  async expireStaleHoldsForCustomer(customerId: string): Promise<number> {
    return this.transaction(async (tx) => {
      const now = await this.now(tx);
      const expired = await tx
        .update(bookings)
        .set({ status: "expired", expiresAt: null, updatedAt: now })
        .where(
          and(
            eq(bookings.customerId, customerId),
            eq(bookings.status, "held"),
            lte(bookings.expiresAt, now),
          ),
        )
        .returning({ id: bookings.id });

      if (expired.length > 0) {
        const bookingIds = expired.map((b) => b.id);
        await tx
          .update(payments)
          .set({ status: "expired", updatedAt: now })
          .where(
            and(
              inArray(payments.bookingId, bookingIds),
              eq(payments.status, "pending"),
            ),
          );
      }

      return expired.length;
    });
  }

  /**
   * Cron batch expire cho toàn hệ thống (tối đa `batchLimit` bản ghi mỗi lượt).
   * Dùng `pg_try_advisory_xact_lock` để an toàn khi chạy nhiều instance.
   */
  async batchExpireHoldsCron(batchLimit = 500): Promise<number> {
    return this.transaction(async (tx) => {
      const lockRes = await tx.execute<{ locked: boolean }>(
        sql`SELECT pg_try_advisory_xact_lock(hashtext('bsc:cron:expire_holds')) AS locked`,
      );
      if (!lockRes.rows[0]?.locked) return 0;

      const now = await this.now(tx);
      const staleRows = await tx.execute<{
        id: string;
        court_id: string;
        customer_id: string | null;
        venue_id: string;
        owner_id: string;
        start_at: Date | string;
        end_at: Date | string;
      }>(sql`
        SELECT
          b.id,
          b.court_id,
          b.customer_id,
          c.venue_id,
          v.owner_id,
          lower(b.during) AS start_at,
          upper(b.during) AS end_at
        FROM bookings b
        INNER JOIN courts c ON c.id = b.court_id
        INNER JOIN venues v ON v.id = c.venue_id
        WHERE b.status = 'held'
          AND b.expires_at <= ${now}
        ORDER BY b.expires_at ASC
        LIMIT ${batchLimit}
        FOR UPDATE OF b SKIP LOCKED
      `);

      const rows = staleRows.rows;
      if (rows.length === 0) return 0;

      const bookingIds = rows.map((r) => r.id);

      await tx
        .update(bookings)
        .set({ status: "expired", expiresAt: null, updatedAt: now })
        .where(inArray(bookings.id, bookingIds));

      await tx
        .update(payments)
        .set({ status: "expired", updatedAt: now })
        .where(
          and(
            inArray(payments.bookingId, bookingIds),
            eq(payments.status, "pending"),
          ),
        );

      for (const row of rows) {
        const eventKey = `booking:${row.id}:hold_expired`;
        if (row.customer_id) {
          await tx
            .insert(outboxDeliveries)
            .values({
              eventKey,
              eventType: "hold_expired",
              channel: "realtime",
              recipientId: row.customer_id,
              payload: {
                bookingId: row.id,
                courtId: row.court_id,
              },
            })
            .onConflictDoNothing();
        }
        await tx
          .insert(outboxDeliveries)
          .values({
            eventKey: `${eventKey}:slots`,
            eventType: "slot_refresh_requested",
            channel: "realtime",
            recipientId: row.owner_id,
            payload: {
              venueId: row.venue_id,
              courtId: row.court_id,
              start: new Date(String(row.start_at)).toISOString(),
              end: new Date(String(row.end_at)).toISOString(),
            },
          })
          .onConflictDoNothing();
      }

      return rows.length;
    });
  }

  /**
   * Cron tự động chuyển `confirmed` -> `completed` sau khi qua `upper(during) + graceMinutes`.
   */
  async batchAutoCompleteBookingsCron(graceMinutes = 30): Promise<number> {
    return this.transaction(async (tx) => {
      const lockRes = await tx.execute<{ locked: boolean }>(
        sql`SELECT pg_try_advisory_xact_lock(hashtext('bsc:cron:auto_complete')) AS locked`,
      );
      if (!lockRes.rows[0]?.locked) return 0;

      const now = await this.now(tx);
      const cutoff = new Date(now.getTime() - graceMinutes * 60_000);

      const completed = await tx
        .update(bookings)
        .set({ status: "completed", updatedAt: now })
        .where(
          and(
            eq(bookings.status, "confirmed"),
            sql`upper(${bookings.during}) <= ${cutoff}`,
          ),
        )
        .returning({ id: bookings.id });

      return completed.length;
    });
  }

  /** Tìm Venue đang hoạt động công khai (`approved` và chưa xoá mềm) theo UUID hoặc slug. */
  async findApprovedVenueByIdOrSlug(idOrSlug: string) {
    const condition = UUID_REGEX.test(idOrSlug)
      ? eq(venues.id, idOrSlug)
      : eq(venues.slug, idOrSlug);

    const [venue] = await this.db
      .select()
      .from(venues)
      .where(
        and(condition, eq(venues.status, "approved"), isNull(venues.deletedAt)),
      )
      .limit(1);

    return venue ?? null;
  }

  /** Lấy dữ liệu tổng hợp để dựng lưới giờ 30 phút cho Venue trong một ngày. */
  async loadVenueSlotGridData(params: {
    venueId: string;
    courtId?: string;
    dayStartUtc: Date;
    dayEndUtc: Date;
  }) {
    const { venueId, courtId, dayStartUtc, dayEndUtc } = params;

    const courtRows = await this.db
      .select()
      .from(courts)
      .where(
        and(
          eq(courts.venueId, venueId),
          eq(courts.status, "active"),
          isNull(courts.deletedAt),
          courtId ? eq(courts.id, courtId) : undefined,
        ),
      )
      .orderBy(asc(courts.sortOrder), asc(courts.createdAt), asc(courts.id));

    if (courtRows.length === 0) {
      return {
        courts: [],
        openingHoursByCourt: new Map<string, OpeningHourRule[]>(),
        pricingRulesByCourt: new Map<string, PricingRuleRow[]>(),
        bookingsByCourt: new Map<
          string,
          Array<{
            id: string;
            customerId: string | null;
            status: string;
            start: Date;
            end: Date;
            expiresAt: Date | null;
            updatedAt: Date;
          }>
        >(),
        blackoutsByCourt: new Map<string, Array<{ start: Date; end: Date }>>(),
        maxUpdatedAt: new Date(),
      };
    }

    const courtIds = courtRows.map((c) => c.id);
    const dayRangeLiteral = toPgTstzRange(dayStartUtc, dayEndUtc);

    const [hoursRows, priceRows, bookingRows, blackoutRows] = await Promise.all(
      [
        this.db
          .select()
          .from(openingHours)
          .where(inArray(openingHours.courtId, courtIds)),
        this.db
          .select()
          .from(pricingRules)
          .where(inArray(pricingRules.courtId, courtIds)),
        this.db
          .select({
            id: bookings.id,
            courtId: bookings.courtId,
            customerId: bookings.customerId,
            status: bookings.status,
            start: sql`lower(${bookings.during})`.mapWith(
              (v) => new Date(String(v)),
            ),
            end: sql`upper(${bookings.during})`.mapWith(
              (v) => new Date(String(v)),
            ),
            expiresAt: bookings.expiresAt,
            updatedAt: bookings.updatedAt,
          })
          .from(bookings)
          .where(
            and(
              inArray(bookings.courtId, courtIds),
              inArray(bookings.status, [
                "held",
                "pending_payment",
                "confirmed",
              ]),
              sql`${bookings.during} && ${dayRangeLiteral}::tstzrange`,
            ),
          ),
        this.db
          .select({
            id: blackoutPeriods.id,
            courtId: blackoutPeriods.courtId,
            start: sql`lower(${blackoutPeriods.during})`.mapWith(
              (v) => new Date(String(v)),
            ),
            end: sql`upper(${blackoutPeriods.during})`.mapWith(
              (v) => new Date(String(v)),
            ),
            createdAt: blackoutPeriods.createdAt,
          })
          .from(blackoutPeriods)
          .where(
            and(
              inArray(blackoutPeriods.courtId, courtIds),
              sql`${blackoutPeriods.during} && ${dayRangeLiteral}::tstzrange`,
            ),
          ),
      ],
    );

    const openingHoursByCourt = new Map<string, OpeningHourRule[]>();
    for (const h of hoursRows) {
      const list = openingHoursByCourt.get(h.courtId) ?? [];
      list.push({
        dayOfWeek: h.dayOfWeek,
        openTime: h.openTime,
        closeTime: h.closeTime,
      });
      openingHoursByCourt.set(h.courtId, list);
    }

    const pricingRulesByCourt = new Map<string, PricingRuleRow[]>();
    for (const p of priceRows) {
      const list = pricingRulesByCourt.get(p.courtId) ?? [];
      list.push({
        id: p.id,
        courtId: p.courtId,
        name: p.name,
        pricePerSlot: p.pricePerSlot,
        startTime: p.startTime,
        endTime: p.endTime,
        dayOfWeek: p.dayOfWeek ?? null,
        dateOverride: p.dateOverride ?? null,
        priority: p.priority,
      });
      pricingRulesByCourt.set(p.courtId, list);
    }

    let maxUpdatedMs = Math.max(
      ...courtRows.map((c) => c.updatedAt.getTime()),
      0,
    );

    const bookingsByCourt = new Map<
      string,
      Array<{
        id: string;
        customerId: string | null;
        status: string;
        start: Date;
        end: Date;
        expiresAt: Date | null;
        updatedAt: Date;
      }>
    >();
    for (const b of bookingRows) {
      if (b.updatedAt.getTime() > maxUpdatedMs) {
        maxUpdatedMs = b.updatedAt.getTime();
      }
      const list = bookingsByCourt.get(b.courtId) ?? [];
      list.push(b);
      bookingsByCourt.set(b.courtId, list);
    }

    const blackoutsByCourt = new Map<
      string,
      Array<{ start: Date; end: Date }>
    >();
    for (const bo of blackoutRows) {
      if (bo.createdAt.getTime() > maxUpdatedMs) {
        maxUpdatedMs = bo.createdAt.getTime();
      }
      const list = blackoutsByCourt.get(bo.courtId) ?? [];
      list.push({ start: bo.start, end: bo.end });
      blackoutsByCourt.set(bo.courtId, list);
    }

    return {
      courts: courtRows,
      openingHoursByCourt,
      pricingRulesByCourt,
      bookingsByCourt,
      blackoutsByCourt,
      maxUpdatedAt: maxUpdatedMs > 0 ? new Date(maxUpdatedMs) : new Date(),
    };
  }

  /**
   * Khoá theo đúng thứ tự cố định: `user` -> `venue (FOR SHARE)` -> `court (FOR SHARE)`
   * để tránh deadlock và phối hợp an toàn với luồng xoá/duyệt Venue (BSC-014).
   */
  async lockContextForHold(
    tx: AuthTransaction,
    customerId: string,
    courtId: string,
  ) {
    const [customer] = await tx
      .select()
      .from(users)
      .where(and(eq(users.id, customerId), isNull(users.deletedAt)))
      .for("share");

    const [courtLookup] = await tx
      .select({ id: courts.id, venueId: courts.venueId })
      .from(courts)
      .where(eq(courts.id, courtId));

    if (!courtLookup) {
      return { customer, venue: null, court: null };
    }

    const [venue] = await tx
      .select()
      .from(venues)
      .where(eq(venues.id, courtLookup.venueId))
      .for("share");

    const [court] = await tx
      .select()
      .from(courts)
      .where(eq(courts.id, courtId))
      .for("share");

    return { customer: customer ?? null, venue: venue ?? null, court: court ?? null };
  }

  /**
   * Kiểm tra hold hiện có của chính customer (Idempotency theo `idempotencyKey` hoặc `courtId + during`).
   */
  async findIdempotentHold(
    tx: AuthTransaction,
    params: {
      customerId: string;
      courtId: string;
      start: Date;
      end: Date;
      idempotencyKey: string | null;
      now: Date;
    },
  ) {
    const { customerId, courtId, start, end, idempotencyKey, now } = params;
    const rangeStr = toPgTstzRange(start, end);

    if (idempotencyKey) {
      const [byKey] = await tx
        .select({
          booking: bookings,
          payment: payments,
          start: sql`lower(${bookings.during})`.mapWith(
            (v) => new Date(String(v)),
          ),
          end: sql`upper(${bookings.during})`.mapWith(
            (v) => new Date(String(v)),
          ),
        })
        .from(payments)
        .innerJoin(bookings, eq(bookings.id, payments.bookingId))
        .where(
          and(
            eq(payments.idempotencyKey, idempotencyKey),
            eq(bookings.customerId, customerId),
          ),
        )
        .limit(1);

      if (byKey) {
        if (
          byKey.booking.status === "held" &&
          (!byKey.booking.expiresAt || byKey.booking.expiresAt > now)
        ) {
          return byKey;
        }
      }
    }

    const [byRange] = await tx
      .select({
        booking: bookings,
        payment: payments,
        start: sql`lower(${bookings.during})`.mapWith(
          (v) => new Date(String(v)),
        ),
        end: sql`upper(${bookings.during})`.mapWith(
          (v) => new Date(String(v)),
        ),
      })
      .from(bookings)
      .innerJoin(payments, eq(payments.bookingId, bookings.id))
      .where(
        and(
          eq(bookings.customerId, customerId),
          eq(bookings.courtId, courtId),
          eq(bookings.status, "held"),
          gt(bookings.expiresAt, now),
          sql`${bookings.during} = ${rangeStr}::tstzrange`,
        ),
      )
      .limit(1);

    return byRange ?? null;
  }

  /** Đếm số lượt giữ chỗ đang còn hiệu lực của customer (`HOLD_LIMIT`). */
  async countActiveCustomerHolds(
    tx: AuthTransaction,
    customerId: string,
    now: Date,
  ): Promise<number> {
    const [row] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(bookings)
      .where(
        and(
          eq(bookings.customerId, customerId),
          eq(bookings.status, "held"),
          gt(bookings.expiresAt, now),
        ),
      );
    return row?.count ?? 0;
  }

  /**
   * Đếm số lần giữ rồi thả/hết hạn trên cùng một sân trong 1 giờ qua (`HOLD_RATE_LIMIT_PER_HOUR`).
   */
  async countRecentReleasedHoldsOnCourt(
    tx: AuthTransaction,
    customerId: string,
    courtId: string,
    now: Date,
  ): Promise<number> {
    const oneHourAgo = new Date(now.getTime() - 3_600_000);
    const [row] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(bookings)
      .where(
        and(
          eq(bookings.customerId, customerId),
          eq(bookings.courtId, courtId),
          inArray(bookings.status, ["expired", "cancelled"]),
          gt(bookings.createdAt, oneHourAgo),
        ),
      );
    return row?.count ?? 0;
  }

  async loadCourtSchedulingConfig(
    tx: AuthTransaction | DrizzleDb,
    courtId: string,
    venueId: string,
  ) {
    const [hours, prices, accountRows, policyRows] = await Promise.all([
      tx
        .select()
        .from(openingHours)
        .where(eq(openingHours.courtId, courtId)),
      tx
        .select()
        .from(pricingRules)
        .where(eq(pricingRules.courtId, courtId)),
      tx
        .select()
        .from(venuePaymentAccounts)
        .where(eq(venuePaymentAccounts.venueId, venueId))
        .limit(1),
      tx
        .select()
        .from(cancellationPolicies)
        .where(eq(cancellationPolicies.venueId, venueId))
        .limit(1),
    ]);

    const openingHourRules: OpeningHourRule[] = hours.map((h) => ({
      dayOfWeek: h.dayOfWeek,
      openTime: h.openTime,
      closeTime: h.closeTime,
    }));

    const pricingRuleRows: PricingRuleRow[] = prices.map((p) => ({
      id: p.id,
      courtId: p.courtId,
      name: p.name,
      pricePerSlot: p.pricePerSlot,
      startTime: p.startTime,
      endTime: p.endTime,
      dayOfWeek: p.dayOfWeek ?? null,
      dateOverride: p.dateOverride ?? null,
      priority: p.priority,
    }));

    const paymentAccount: BankAccountInfo | null = accountRows[0]
      ? {
          bankBin: accountRows[0].bankBin,
          accountNo: accountRows[0].accountNo,
          accountName: accountRows[0].accountName,
        }
      : null;

    const cancellationPolicy: CancellationPolicyRule = policyRows[0]
      ? {
          cancelBeforeHours: policyRows[0].cancelBeforeHours,
          refundPercent: policyRows[0].refundPercent,
          depositPercent: policyRows[0].depositPercent,
        }
      : DEFAULT_CANCELLATION_POLICY;

    return {
      openingHours: openingHourRules,
      pricingRules: pricingRuleRows,
      paymentAccount,
      cancellationPolicy,
    };
  }

  /** Kiểm tra xem khoảng `[start, end)` có giao với khoảng khoá bảo trì (`blackout_periods`) nào không. */
  async hasBlackoutOverlap(
    tx: AuthTransaction | DrizzleDb,
    courtId: string,
    start: Date,
    end: Date,
  ): Promise<boolean> {
    const rangeStr = toPgTstzRange(start, end);
    const [row] = await tx
      .select({ id: blackoutPeriods.id })
      .from(blackoutPeriods)
      .where(
        and(
          eq(blackoutPeriods.courtId, courtId),
          sql`${blackoutPeriods.during} && ${rangeStr}::tstzrange`,
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  /** Kiểm tra xem khoảng `[start, end)` có giao với booking đang active nào không. */
  async findOverlappingBookings(
    tx: AuthTransaction | DrizzleDb,
    courtId: string,
    start: Date,
    end: Date,
    now: Date,
  ) {
    const rangeStr = toPgTstzRange(start, end);
    return tx
      .select({
        id: bookings.id,
        status: bookings.status,
        expiresAt: bookings.expiresAt,
        start: sql`lower(${bookings.during})`.mapWith(
          (v) => new Date(String(v)),
        ),
        end: sql`upper(${bookings.during})`.mapWith(
          (v) => new Date(String(v)),
        ),
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.courtId, courtId),
          inArray(bookings.status, ["held", "pending_payment", "confirmed"]),
          sql`(${bookings.status} <> 'held' OR ${bookings.expiresAt} > ${now})`,
          sql`${bookings.during} && ${rangeStr}::tstzrange`,
        ),
      );
  }

  /**
   * Tạo bản ghi `bookings` (`status = 'held'`) và `payments` (`status = 'pending'`)
   * nguyên tử trong cùng một transaction, đồng thời ghi `outbox_deliveries`.
   */
  async createHoldBookingAndPayment(
    tx: AuthTransaction,
    params: {
      courtId: string;
      venueId: string;
      ownerId: string;
      customerId: string;
      start: Date;
      end: Date;
      totalPrice: number;
      depositAmount: number;
      expiresAt: Date;
      note: string | null;
      bankAccount: BankAccountInfo;
      idempotencyKey: string | null;
      now: Date;
    },
  ) {
    const {
      courtId,
      venueId,
      ownerId,
      customerId,
      start,
      end,
      totalPrice,
      depositAmount,
      expiresAt,
      note,
      bankAccount,
      idempotencyKey,
      now,
    } = params;

    const bookingId = v7();
    const rangeStr = toPgTstzRange(start, end);

    const [insertedBooking] = await tx
      .insert(bookings)
      .values({
        id: bookingId,
        courtId,
        customerId,
        source: "online",
        createdBy: customerId,
        during: rangeStr,
        status: "held",
        totalPrice,
        depositAmount,
        note,
        expiresAt,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    let insertedPayment: typeof payments.$inferSelect | undefined;
    for (let attempt = 0; attempt < 5; attempt++) {
      const transferCode = generateTransferCode();
      try {
        const [p] = await tx
          .insert(payments)
          .values({
            id: v7(),
            bookingId,
            amount: depositAmount,
            provider: "bank_transfer",
            transferCode,
            bankAccountSnapshot: bankAccount,
            status: "pending",
            idempotencyKey,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        insertedPayment = p;
        break;
      } catch (err: unknown) {
        const code =
          typeof err === "object" && err !== null && "code" in err
            ? String((err as { code?: unknown }).code)
            : "";
        const constraint =
          typeof err === "object" && err !== null && "constraint" in err
            ? String((err as { constraint?: unknown }).constraint)
            : "";
        if (
          code === "23505" &&
          constraint.includes("transfer_code") &&
          attempt < 4
        ) {
          continue;
        }
        throw err;
      }
    }

    const eventKey = `booking:${bookingId}:created`;
    await tx
      .insert(outboxDeliveries)
      .values([
        {
          eventKey,
          eventType: "booking_created",
          channel: "realtime",
          recipientId: ownerId,
          payload: {
            bookingId,
            venueId,
            courtId,
          },
        },
        {
          eventKey: `${eventKey}:slots`,
          eventType: "slot_refresh_requested",
          channel: "realtime",
          recipientId: ownerId,
          payload: {
            venueId,
            courtId,
            start: start.toISOString(),
            end: end.toISOString(),
          },
        },
      ])
      .onConflictDoNothing();

    return {
      booking: insertedBooking!,
      payment: insertedPayment!,
      start,
      end,
    };
  }

  /** Truy vấn đầy đủ thông tin một Booking (kèm court, venue, customer, payment, review). */
  async findBookingBundleById(
    bookingId: string,
    tx: AuthTransaction | DrizzleDb = this.db,
    lockBooking = false,
  ): Promise<RawBookingBundle | null> {
    const baseQuery = tx
      .select({
        booking: bookings,
        start: sql`lower(${bookings.during})`.mapWith(
          (v) => new Date(String(v)),
        ),
        end: sql`upper(${bookings.during})`.mapWith(
          (v) => new Date(String(v)),
        ),
        court: courts,
        venue: venues,
      })
      .from(bookings)
      .innerJoin(courts, eq(courts.id, bookings.courtId))
      .innerJoin(venues, eq(venues.id, courts.venueId))
      .where(eq(bookings.id, bookingId));

    const [row] = await (lockBooking
      ? baseQuery.for("update", { of: bookings })
      : baseQuery);

    if (!row) return null;

    const [customerRow, paymentRow, reviewRow] = await Promise.all([
      row.booking.customerId
        ? tx
            .select()
            .from(users)
            .where(eq(users.id, row.booking.customerId))
            .limit(1)
            .then((r) => r[0] ?? null)
        : Promise.resolve(null),
      tx
        .select()
        .from(payments)
        .where(eq(payments.bookingId, bookingId))
        .orderBy(
          sql`CASE WHEN ${payments.status} IN ('pending', 'submitted', 'completed') THEN 0 ELSE 1 END`,
          desc(payments.createdAt),
          desc(payments.id),
        )
        .limit(1)
        .then((r) => r[0] ?? null),
      tx
        .select()
        .from(reviews)
        .where(eq(reviews.bookingId, bookingId))
        .limit(1)
        .then((r) => r[0] ?? null),
    ]);

    return {
      booking: row.booking,
      start: row.start,
      end: row.end,
      court: row.court,
      venue: row.venue,
      customer: customerRow,
      payment: paymentRow,
      review: reviewRow,
    };
  }

  /** Chuyển `RawBookingBundle` sang `BookingDetail` đúng hợp đồng API. */
  toBookingDetail(bundle: RawBookingBundle): BookingDetail {
    const { booking, start, end, court, venue, customer, payment, review } =
      bundle;

    const bookingBase: Booking = {
      id: booking.id,
      courtId: booking.courtId,
      customerId: booking.customerId,
      source: booking.source as BookingSource,
      guestName: booking.guestName ?? null,
      guestPhone: booking.guestPhone ?? null,
      during: {
        start: formatDateToVnIso(start),
        end: formatDateToVnIso(end),
      },
      status: booking.status as BookingStatus,
      totalPrice: booking.totalPrice,
      depositAmount: booking.depositAmount,
      note: booking.note ?? null,
      expiresAt: booking.expiresAt ? booking.expiresAt.toISOString() : null,
      cancelledAt: booking.cancelledAt
        ? booking.cancelledAt.toISOString()
        : null,
      cancelReason: booking.cancelReason ?? null,
      createdAt: booking.createdAt.toISOString(),
    };

    const paymentDto: Payment | null = payment
      ? {
          id: payment.id,
          amount: payment.amount,
          provider: payment.provider as PaymentProvider,
          transferCode: payment.transferCode ?? null,
          proofUrl: payment.proofUrl ?? null,
          proofUploadedAt: payment.proofUploadedAt
            ? payment.proofUploadedAt.toISOString()
            : null,
          status: payment.status as PaymentStatus,
          paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
          reviewedBy: payment.reviewedBy ?? null,
          rejectReason: payment.rejectReason ?? null,
          refundAmount: payment.refundAmount ?? null,
        }
      : null;

    const reviewDto: Review | null = review
      ? {
          id: review.id,
          bookingId: review.bookingId,
          venueId: review.venueId,
          customerId: review.customerId,
          rating: review.rating,
          comment: review.content ?? null,
          ownerReply: review.ownerReply ?? null,
          ownerRepliedAt: review.ownerRepliedAt
            ? review.ownerRepliedAt.toISOString()
            : null,
          isVisible: review.isVisible,
          createdAt: review.createdAt.toISOString(),
        }
      : null;

    return {
      ...bookingBase,
      court: {
        id: court.id,
        name: court.name,
        venue: {
          id: venue.id,
          name: venue.name,
          slug: venue.slug,
          address: venue.address,
        },
      },
      customer: customer
        ? {
            id: customer.id,
            fullName: customer.fullName,
            phone: maskPhone(customer.phone),
            email: customer.email,
          }
        : null,
      payment: paymentDto,
      review: reviewDto,
    };
  }

  /** Danh sách lịch sử đặt sân của chính Customer đang đăng nhập (có phân trang). */
  async listCustomerBookings(params: {
    customerId: string;
    status?: string;
    from?: string;
    to?: string;
    page: number;
    limit: number;
  }): Promise<{ rows: BookingDetail[]; total: number }> {
    const { customerId, status, from, to, page, limit } = params;

    const scope = and(
      eq(bookings.customerId, customerId),
      status ? eq(bookings.status, status) : undefined,
      from
        ? sql`lower(${bookings.during}) >= (${from}::date::timestamp at time zone 'Asia/Ho_Chi_Minh')`
        : undefined,
      to
        ? sql`lower(${bookings.during}) < ((${to}::date + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh')`
        : undefined,
    );

    const [countRow] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(bookings)
      .where(scope);

    const total = countRow?.total ?? 0;
    const offset = (page - 1) * limit;
    if (total === 0 || offset >= total) {
      return { rows: [], total };
    }

    const baseRows = await this.db
      .select({ id: bookings.id })
      .from(bookings)
      .where(scope)
      .orderBy(desc(bookings.createdAt), desc(bookings.id))
      .limit(limit)
      .offset(offset);

    const details: BookingDetail[] = [];
    for (const r of baseRows) {
      const bundle = await this.findBookingBundleById(r.id);
      if (bundle) {
        details.push(this.toBookingDetail(bundle));
      }
    }

    return { rows: details, total };
  }

  /** Lấy chính sách huỷ của một Venue (hoặc mặc định 24h / 100%). */
  async getVenueCancellationPolicy(
    venueId: string,
    tx: AuthTransaction | DrizzleDb = this.db,
  ): Promise<CancellationPolicyRule> {
    const [row] = await tx
      .select()
      .from(cancellationPolicies)
      .where(eq(cancellationPolicies.venueId, venueId))
      .limit(1);

    if (!row) return DEFAULT_CANCELLATION_POLICY;
    return {
      cancelBeforeHours: row.cancelBeforeHours,
      refundPercent: row.refundPercent,
      depositPercent: row.depositPercent,
    };
  }

  /** Cập nhật huỷ booking nguyên tử kèm cập nhật payment, audit log và outbox. */
  async cancelBookingInTx(
    tx: AuthTransaction,
    params: {
      bundle: RawBookingBundle;
      actorId: string;
      actorRole: string;
      reason: string;
      now: Date;
    },
  ): Promise<BookingDetail> {
    const { bundle, actorId, actorRole, reason, now } = params;
    const { booking, payment, venue, court, start, end } = bundle;

    await tx
      .update(bookings)
      .set({
        status: "cancelled",
        cancelledBy: actorId,
        cancelledAt: now,
        cancelReason: reason,
        expiresAt: null,
        updatedAt: now,
      })
      .where(eq(bookings.id, booking.id));

    if (
      payment &&
      (payment.status === "pending" || payment.status === "submitted")
    ) {
      await tx
        .update(payments)
        .set({
          status: "cancelled",
          updatedAt: now,
        })
        .where(eq(payments.id, payment.id));
    }

    const eventKey = `booking:${booking.id}:cancelled`;
    if (booking.customerId && booking.customerId !== actorId) {
      await tx
        .insert(notifications)
        .values({
          eventKey,
          userId: booking.customerId,
          type: "booking_cancelled",
          title: "Đơn đặt sân đã bị huỷ",
          body: `Đơn đặt sân tại ${venue.name} đã bị huỷ.`,
          data: { bookingId: booking.id, venueId: venue.id, reason },
        })
        .onConflictDoNothing();

      await tx
        .insert(outboxDeliveries)
        .values({
          eventKey,
          eventType: "booking_cancelled",
          channel: "realtime",
          recipientId: booking.customerId,
          payload: { bookingId: booking.id, reason },
        })
        .onConflictDoNothing();
    }

    await tx
      .insert(outboxDeliveries)
      .values({
        eventKey: `${eventKey}:slots`,
        eventType: "slot_refresh_requested",
        channel: "realtime",
        recipientId: venue.ownerId,
        payload: {
          venueId: venue.id,
          courtId: court.id,
          start: start.toISOString(),
          end: end.toISOString(),
        },
      })
      .onConflictDoNothing();

    const updatedBundle = await this.findBookingBundleById(booking.id, tx);
    return this.toBookingDetail(updatedBundle!);
  }

  /** Xác nhận trực tiếp từ `held` -> `confirmed` trong transaction. */
  async confirmHeldBookingInTx(
    tx: AuthTransaction,
    bundle: RawBookingBundle,
    actorId: string,
    now: Date,
  ): Promise<BookingDetail> {
    const { booking, payment, venue, court, start, end } = bundle;

    await tx
      .update(bookings)
      .set({
        status: "confirmed",
        expiresAt: null,
        updatedAt: now,
      })
      .where(eq(bookings.id, booking.id));

    if (payment && payment.status === "pending") {
      await tx
        .update(payments)
        .set({
          status: "completed",
          paidAt: now,
          updatedAt: now,
        })
        .where(eq(payments.id, payment.id));
    }

    const eventKey = `booking:${booking.id}:confirmed`;
    await tx
      .insert(outboxDeliveries)
      .values({
        eventKey: `${eventKey}:slots`,
        eventType: "slot_refresh_requested",
        channel: "realtime",
        recipientId: venue.ownerId,
        payload: {
          venueId: venue.id,
          courtId: court.id,
          start: start.toISOString(),
          end: end.toISOString(),
        },
      })
      .onConflictDoNothing();

    const updatedBundle = await this.findBookingBundleById(booking.id, tx);
    return this.toBookingDetail(updatedBundle!);
  }

  /** Đánh dấu `no_show` cho đơn đã `confirmed` và đã qua giờ bắt đầu. */
  async markNoShowInTx(
    tx: AuthTransaction,
    bundle: RawBookingBundle,
    actorId: string,
    now: Date,
  ): Promise<BookingDetail> {
    const { booking } = bundle;

    await tx
      .update(bookings)
      .set({
        status: "no_show",
        updatedAt: now,
      })
      .where(eq(bookings.id, booking.id));

    const updatedBundle = await this.findBookingBundleById(booking.id, tx);
    return this.toBookingDetail(updatedBundle!);
  }
}
