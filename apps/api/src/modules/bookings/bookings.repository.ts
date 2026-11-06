import { Injectable } from "@nestjs/common";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";
import {
  InjectDrizzle,
  type DrizzleDb,
} from "../../database/database.module.js";
import {
  blackoutPeriods,
  bookings,
  cancellationPolicies,
  courts,
  openingHours,
  payments,
  pricingRules,
  users,
  venuePaymentAccounts,
  venues,
} from "../../database/schema/index.js";
import {
  formatTsTzRange,
  parseTsTzRange,
} from "../../common/utils/time-range.js";

export type DbClient = DrizzleDb;

@Injectable()
export class BookingsRepository {
  constructor(@InjectDrizzle() private readonly db: DrizzleDb) {}

  /** Lấy thông tin venue và các sân con còn active. */
  async findVenueWithCourts(venueId: string) {
    const [venue] = await this.db
      .select()
      .from(venues)
      .where(and(eq(venues.id, venueId), isNull(venues.deletedAt)))
      .limit(1);

    if (!venue) return null;

    const activeCourts = await this.db
      .select()
      .from(courts)
      .where(
        and(
          eq(courts.venueId, venueId),
          eq(courts.status, "active"),
          isNull(courts.deletedAt),
        ),
      )
      .orderBy(asc(courts.sortOrder), asc(courts.name));

    return {
      venue,
      courts: activeCourts,
    };
  }

  /** Khoá advisory theo courtId trong transaction hiện tại, giữ tới khi transaction commit/rollback.
   * Đảm bảo "expire hold cũ" + "kiểm tra idempotency" + "insert hold mới" trên CÙNG một sân
   * được tuần tự hoá, tránh khoảng hở giữa các bước khi có nhiều request đồng thời.
   * EXCLUDE constraint ở DB vẫn là tuyến phòng thủ cuối (không bị thay thế bởi khoá này). */
  async lockCourtForBooking(courtId: string, tx: DbClient): Promise<void> {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${courtId}, 0))`,
    );
  }

  /** Lấy chi tiết sân con kèm thông tin venue cha. */
  async findCourtWithVenue(courtId: string, db: DbClient = this.db) {
    const [row] = await db
      .select({
        court: courts,
        venue: venues,
      })
      .from(courts)
      .innerJoin(venues, eq(courts.venueId, venues.id))
      .where(
        and(
          eq(courts.id, courtId),
          isNull(courts.deletedAt),
          isNull(venues.deletedAt),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  /** Lấy giờ mở cửa của các court trong venue theo thứ trong tuần. */
  async getOpeningHoursByVenueAndDay(
    courtIds: string[],
    dayOfWeek: number,
    db: DbClient = this.db,
  ) {
    if (courtIds.length === 0) return [];
    return db
      .select()
      .from(openingHours)
      .where(
        and(
          inArray(openingHours.courtId, courtIds),
          eq(openingHours.dayOfWeek, dayOfWeek),
        ),
      );
  }

  /** Lấy tất cả pricing rules của các court trong venue. */
  async getPricingRulesByCourts(courtIds: string[], db: DbClient = this.db) {
    if (courtIds.length === 0) return [];
    return db
      .select()
      .from(pricingRules)
      .where(inArray(pricingRules.courtId, courtIds));
  }

  /** Lấy blackout periods của các court giao nhau với khoảng thời gian [from, to). */
  async getBlackoutsByCourtsAndRange(
    courtIds: string[],
    from: Date,
    to: Date,
  ) {
    if (courtIds.length === 0) return [];
    const range = formatTsTzRange(from, to);
    return this.db
      .select()
      .from(blackoutPeriods)
      .where(
        and(
          inArray(blackoutPeriods.courtId, courtIds),
          sql`${blackoutPeriods.during} && tstzrange(${from.toISOString()}, ${to.toISOString()}, '[)')`,
        ),
      );
  }

  /** Lấy các active booking giao nhau với khoảng thời gian [from, to). */
  async getActiveBookingsByCourtsAndRange(
    courtIds: string[],
    from: Date,
    to: Date,
  ) {
    if (courtIds.length === 0) return [];
    const now = new Date();

    return this.db
      .select()
      .from(bookings)
      .where(
        and(
          inArray(bookings.courtId, courtIds),
          sql`${bookings.during} && tstzrange(${from.toISOString()}, ${to.toISOString()}, '[)')`,
          or(
            inArray(bookings.status, ["pending_payment", "confirmed"]),
            and(
              eq(bookings.status, "held"),
              gt(bookings.expiresAt, now),
            ),
          ),
        ),
      );
  }

  /** Đếm số hold đang hiệu lực của customer (HOLD_LIMIT). */
  async countActiveHolds(
    customerId: string,
    db: DbClient = this.db,
  ): Promise<number> {
    const now = new Date();
    const [res] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookings)
      .where(
        and(
          eq(bookings.customerId, customerId),
          eq(bookings.status, "held"),
          gt(bookings.expiresAt, now),
        ),
      );
    return res?.count ?? 0;
  }

  /** Đếm số booking của customer trên sân trong 1 giờ qua (status <> 'cancelled') (HOLD_RATE_LIMIT_PER_HOUR). */
  async countRecentHoldsOnCourt(
    customerId: string,
    courtId: string,
    since: Date,
    db: DbClient = this.db,
  ): Promise<number> {
    const [res] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookings)
      .where(
        and(
          eq(bookings.customerId, customerId),
          eq(bookings.courtId, courtId),
          gte(bookings.createdAt, since),
          sql`${bookings.status} <> 'cancelled'`,
        ),
      );
    return res?.count ?? 0;
  }

  /** Lấy tài khoản ngân hàng của cơ sở. */
  async getVenuePaymentAccount(venueId: string, db: DbClient = this.db) {
    const [row] = await db
      .select()
      .from(venuePaymentAccounts)
      .where(eq(venuePaymentAccounts.venueId, venueId))
      .limit(1);
    return row ?? null;
  }

  /** Lấy chính sách huỷ/cọc của cơ sở. */
  async getCancellationPolicy(venueId: string, db: DbClient = this.db) {
    const [row] = await db
      .select()
      .from(cancellationPolicies)
      .where(eq(cancellationPolicies.venueId, venueId))
      .limit(1);
    return row ?? null;
  }

  /**
   * Kiểm tra xem chính customer này đã có hold còn hiệu lực trùng khớp chưa.
   * Ưu tiên khớp theo `idempotencyKey` của payment (đúng ngữ nghĩa idempotency:
   * cùng key -> luôn trả về cùng bản ghi, bất kể courtId/during có đổi hay không).
   * Nếu không có idempotencyKey, fallback về so khớp customerId + courtId + during
   * (giữ hành vi tương thích cho các request cũ không gửi key).
   */
  async findActiveHoldByIdempotency(
    customerId: string,
    courtId: string,
    start: Date,
    end: Date,
    idempotencyKey?: string | null,
    db: DbClient = this.db,
  ) {
    const now = new Date();

    if (idempotencyKey) {
      const [byKey] = await db
        .select({
          booking: bookings,
          payment: payments,
        })
        .from(bookings)
        .innerJoin(payments, eq(payments.bookingId, bookings.id))
        .where(
          and(
            eq(bookings.customerId, customerId),
            eq(payments.idempotencyKey, idempotencyKey),
            eq(bookings.status, "held"),
            gt(bookings.expiresAt, now),
          ),
        )
        .limit(1);

      if (byKey) return byKey;
    }

    const [row] = await db
      .select({
        booking: bookings,
        payment: payments,
      })
      .from(bookings)
      .innerJoin(payments, eq(payments.bookingId, bookings.id))
      .where(
        and(
          eq(bookings.customerId, customerId),
          eq(bookings.courtId, courtId),
          eq(bookings.status, "held"),
          gt(bookings.expiresAt, now),
          sql`${bookings.during} = tstzrange(${start.toISOString()}, ${end.toISOString()}, '[)')`,
        ),
      )
      .limit(1);

    return row ?? null;
  }

  /** Chạy một callback trong transaction dùng chung client DB (dùng cho createHold). */
  async runInTransaction<T>(
    fn: (tx: DbClient) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(fn);
  }

  /** Quét và expire các hold quá hạn của 1 sân cụ thể (chạy trước khi insert hold mới). */
  async expireCourtHolds(courtId: string, db: DbClient = this.db) {
    const now = new Date();
    const expiredBookings = await db
      .update(bookings)
      .set({
        status: "expired",
        updatedAt: now,
      })
      .where(
        and(
          eq(bookings.courtId, courtId),
          eq(bookings.status, "held"),
          lt(bookings.expiresAt, now),
        ),
      )
      .returning({ id: bookings.id });

    if (expiredBookings.length > 0) {
      const ids = expiredBookings.map((b) => b.id);
      await db
        .update(payments)
        .set({
          status: "expired",
          updatedAt: now,
        })
        .where(inArray(payments.bookingId, ids));
    }
  }

  /** Tạo hold booking + payment trong transaction. */
  async createHoldBooking(
    data: {
      courtId: string;
      customerId: string;
      start: Date;
      end: Date;
      totalPrice: number;
      depositAmount: number;
      expiresAt: Date;
      note?: string | null;
      transferCode: string;
      idempotencyKey?: string | null;
    },
    db: DbClient = this.db,
  ) {
    const [booking] = await db
      .insert(bookings)
      .values({
        courtId: data.courtId,
        customerId: data.customerId,
        source: "online",
        during: formatTsTzRange(data.start, data.end),
        status: "held",
        totalPrice: data.totalPrice,
        depositAmount: data.depositAmount,
        expiresAt: data.expiresAt,
        note: data.note ?? null,
      })
      .returning();

    if (!booking) {
      throw new Error("Không thể tạo bản ghi booking.");
    }

    const [payment] = await db
      .insert(payments)
      .values({
        bookingId: booking.id,
        amount: data.depositAmount,
        provider: "bank_transfer",
        transferCode: data.transferCode,
        status: "pending",
        idempotencyKey: data.idempotencyKey ?? null,
      })
      .returning();

    if (!payment) {
      throw new Error("Không thể tạo bản ghi payment.");
    }

    return { booking, payment };
  }

  /** Lấy chi tiết 1 booking (kèm court, venue, customer, payment). */
  async findBookingById(id: string) {
    const [row] = await this.db
      .select({
        booking: bookings,
        court: courts,
        venue: venues,
        customer: users,
        payment: payments,
      })
      .from(bookings)
      .innerJoin(courts, eq(bookings.courtId, courts.id))
      .innerJoin(venues, eq(courts.venueId, venues.id))
      .leftJoin(users, eq(bookings.customerId, users.id))
      .leftJoin(payments, eq(payments.bookingId, bookings.id))
      .where(eq(bookings.id, id))
      .limit(1);

    return row ?? null;
  }

  /** Lấy danh sách booking của customer kèm phân trang. */
  async findBookingsByCustomer(
    customerId: string,
    options: { status?: string; page: number; limit: number },
  ) {
    const conditions = [eq(bookings.customerId, customerId)];
    if (options.status) {
      conditions.push(eq(bookings.status, options.status));
    }

    const whereClause = and(...conditions);
    const offset = (options.page - 1) * options.limit;

    const [countResult] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(bookings)
      .where(whereClause);

    const total = countResult?.total ?? 0;

    const items = await this.db
      .select({
        booking: bookings,
        court: courts,
        venue: venues,
        payment: payments,
      })
      .from(bookings)
      .innerJoin(courts, eq(bookings.courtId, courts.id))
      .innerJoin(venues, eq(courts.venueId, venues.id))
      .leftJoin(payments, eq(payments.bookingId, bookings.id))
      .where(whereClause)
      .orderBy(desc(bookings.createdAt))
      .limit(options.limit)
      .offset(offset);

    return {
      items,
      total,
      page: options.page,
      limit: options.limit,
      totalPages: Math.ceil(total / options.limit) || 1,
    };
  }

  /** Lấy danh sách booking của owner tại các sân của mình. */
  async findBookingsByOwner(
    ownerId: string,
    options: {
      venueId?: string;
      courtId?: string;
      status?: string;
      from?: string;
      to?: string;
      page: number;
      limit: number;
    },
  ) {
    const conditions = [
      eq(venues.ownerId, ownerId),
      isNull(venues.deletedAt),
    ];

    if (options.venueId) {
      conditions.push(eq(venues.id, options.venueId));
    }
    if (options.courtId) {
      conditions.push(eq(courts.id, options.courtId));
    }
    if (options.status) {
      conditions.push(eq(bookings.status, options.status));
    }
    if (options.from) {
      const fromDate = new Date(`${options.from}T00:00:00+07:00`);
      conditions.push(sql`lower(${bookings.during}) >= ${fromDate}`);
    }
    if (options.to) {
      const toDate = new Date(`${options.to}T23:59:59+07:00`);
      conditions.push(sql`upper(${bookings.during}) <= ${toDate}`);
    }

    const whereClause = and(...conditions);
    const offset = (options.page - 1) * options.limit;

    const [countResult] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(bookings)
      .innerJoin(courts, eq(bookings.courtId, courts.id))
      .innerJoin(venues, eq(courts.venueId, venues.id))
      .where(whereClause);

    const total = countResult?.total ?? 0;

    const items = await this.db
      .select({
        booking: bookings,
        court: courts,
        venue: venues,
        customer: users,
        payment: payments,
      })
      .from(bookings)
      .innerJoin(courts, eq(bookings.courtId, courts.id))
      .innerJoin(venues, eq(courts.venueId, venues.id))
      .leftJoin(users, eq(bookings.customerId, users.id))
      .leftJoin(payments, eq(payments.bookingId, bookings.id))
      .where(whereClause)
      .orderBy(desc(bookings.createdAt))
      .limit(options.limit)
      .offset(offset);

    return {
      items,
      total,
      page: options.page,
      limit: options.limit,
      totalPages: Math.ceil(total / options.limit) || 1,
    };
  }

  /**
   * Cập nhật trạng thái booking và payment (huỷ booking, no-show, v.v.).
   * Khoá hàng booking bằng `FOR UPDATE` và kiểm tra lại trạng thái NGAY TRONG
   * transaction, chống race condition khi 2 request huỷ cùng lúc (hoặc huỷ
   * đụng cron auto-complete) cùng đọc trạng thái cũ và cùng ghi đè thành công.
   */
  async cancelBookingTx(
    bookingId: string,
    cancelledBy: string,
    reason: string | null,
    paymentStatus: "cancelled" | "refunded",
    refundAmount: number | null = null,
    expectedStatus?: string,
  ) {
    return this.db.transaction(async (tx) => {
      const [locked] = await tx
        .select({ status: bookings.status })
        .from(bookings)
        .where(eq(bookings.id, bookingId))
        .for("update");

      if (!locked) {
        return { booking: undefined, payment: undefined };
      }

      if (expectedStatus && locked.status !== expectedStatus) {
        // Trạng thái đã đổi giữa lúc service kiểm tra và lúc transaction này
        // giành được khoá (ví dụ cron hoặc request khác vừa huỷ/hoàn tất).
        // Trả về trạng thái hiện tại để service quyết định tiếp (ném lỗi phù hợp).
        return { booking: { ...locked } as any, payment: undefined, conflict: true as const };
      }

      const now = new Date();
      const [updatedBooking] = await tx
        .update(bookings)
        .set({
          status: "cancelled",
          cancelledBy,
          cancelReason: reason,
          cancelledAt: now,
          updatedAt: now,
        })
        .where(eq(bookings.id, bookingId))
        .returning();

      const [updatedPayment] = await tx
        .update(payments)
        .set({
          status: paymentStatus,
          refundAmount,
          refundedAt: paymentStatus === "refunded" ? now : null,
          updatedAt: now,
        })
        .where(eq(payments.bookingId, bookingId))
        .returning();

      return { booking: updatedBooking, payment: updatedPayment, conflict: false as const };
    });
  }

  /** Đánh dấu booking no-show. */
  async markNoShow(bookingId: string) {
    const [row] = await this.db
      .update(bookings)
      .set({
        status: "no_show",
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, bookingId))
      .returning();
    return row ?? null;
  }

  /** Tạo booking thủ công tại quầy (source: manual, confirmed, cash). */
  async createManualBooking(data: {
    courtId: string;
    start: Date;
    end: Date;
    totalPrice: number;
    guestName: string;
    guestPhone: string;
    createdBy: string;
    note?: string | null;
  }) {
    return this.db.transaction(async (tx) => {
      const now = new Date();
      const [booking] = await tx
        .insert(bookings)
        .values({
          courtId: data.courtId,
          source: "manual",
          guestName: data.guestName,
          guestPhone: data.guestPhone,
          createdBy: data.createdBy,
          during: formatTsTzRange(data.start, data.end),
          status: "confirmed",
          totalPrice: data.totalPrice,
          depositAmount: data.totalPrice,
          expiresAt: null,
          note: data.note ?? null,
        })
        .returning();

      if (!booking) {
        throw new Error("Không thể tạo bản ghi booking.");
      }

      const [payment] = await tx
        .insert(payments)
        .values({
          bookingId: booking.id,
          amount: data.totalPrice,
          provider: "cash",
          status: "completed",
          paidAt: now,
          reviewedBy: data.createdBy,
          reviewedAt: now,
        })
        .returning();

      if (!payment) {
        throw new Error("Không thể tạo bản ghi payment.");
      }

      return { booking, payment };
    });
  }
}
