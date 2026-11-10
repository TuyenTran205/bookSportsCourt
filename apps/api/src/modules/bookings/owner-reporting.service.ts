import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { v7 } from "uuid";
import type {
  AuthenticatedUser,
  OpeningHour,
  OwnerTimelineDay,
} from "../../../../../packages/shared/src/types.js";
import type {
  BookingSource,
  BookingStatus,
  CourtStatus,
} from "../../../../../packages/shared/src/constants.js";
import {
  InjectDrizzle,
  type DrizzleDb,
} from "../../database/database.module.js";
import {
  blackoutPeriods,
  bookings,
  courts,
  openingHours,
  payments,
  users,
  venues,
} from "../../database/schema/index.js";

@Injectable()
export class OwnerReportingService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDb) {}

  private async getOwnerVenueIds(
    user: AuthenticatedUser,
    requestedVenueId?: string,
  ): Promise<string[]> {
    if (user.role === "admin") {
      if (requestedVenueId) return [requestedVenueId];
      const allVenues = await this.db
        .select({ id: venues.id })
        .from(venues)
        .where(isNull(venues.deletedAt));
      return allVenues.map((v) => v.id);
    }

    const ownerVenues = await this.db
      .select({ id: venues.id })
      .from(venues)
      .where(and(eq(venues.ownerId, user.id), isNull(venues.deletedAt)));
    const ids = ownerVenues.map((v) => v.id);

    if (requestedVenueId) {
      if (!ids.includes(requestedVenueId)) {
        throw new ForbiddenException({
          code: "NOT_VENUE_OWNER",
          message: "Bạn không phải chủ sở hữu cơ sở thể thao này.",
        });
      }
      return [requestedVenueId];
    }
    return ids;
  }

  async listBookings(
    user: AuthenticatedUser,
    query: {
      venueId?: string;
      courtId?: string;
      status?: string;
      q?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const venueIds = await this.getOwnerVenueIds(user, query.venueId);
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 10)));
    const offset = (page - 1) * limit;

    if (venueIds.length === 0) {
      return {
        data: [],
        meta: { page, limit, total: 0, totalPages: 0 },
      };
    }

    const conditions = [inArray(courts.venueId, venueIds)];

    if (query.courtId) {
      conditions.push(eq(bookings.courtId, query.courtId));
    }
    if (query.status) {
      conditions.push(eq(bookings.status, query.status));
    }
    if (query.from) {
      conditions.push(sql`lower(${bookings.during}) >= ${query.from}::timestamptz`);
    }
    if (query.to) {
      conditions.push(sql`lower(${bookings.during}) <= (${query.to}::date + interval '1 day')::timestamptz`);
    }
    if (query.q) {
      const pattern = `%${query.q.trim()}%`;
      conditions.push(
        or(
          ilike(bookings.guestName, pattern),
          ilike(bookings.guestPhone, pattern),
          ilike(courts.name, pattern),
          ilike(users.fullName, pattern),
          sql`cast(${bookings.id} as text) ilike ${pattern}`,
        )!,
      );
    }

    const whereClause = and(...conditions);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookings)
      .innerJoin(courts, eq(bookings.courtId, courts.id))
      .leftJoin(users, eq(bookings.customerId, users.id))
      .where(whereClause);

    const total = countResult?.count ?? 0;
    const totalPages = Math.ceil(total / limit);

    const rows = await this.db
      .select({
        id: bookings.id,
        courtId: bookings.courtId,
        courtName: courts.name,
        venueId: courts.venueId,
        venueName: venues.name,
        customerId: bookings.customerId,
        customerName: users.fullName,
        customerPhone: users.phone,
        guestName: bookings.guestName,
        guestPhone: bookings.guestPhone,
        start: sql<Date>`lower(${bookings.during})`,
        end: sql<Date>`upper(${bookings.during})`,
        status: bookings.status,
        totalPrice: bookings.totalPrice,
        depositAmount: bookings.depositAmount,
        source: bookings.source,
        createdAt: bookings.createdAt,
      })
      .from(bookings)
      .innerJoin(courts, eq(bookings.courtId, courts.id))
      .innerJoin(venues, eq(courts.venueId, venues.id))
      .leftJoin(users, eq(bookings.customerId, users.id))
      .where(whereClause)
      .orderBy(desc(bookings.createdAt), desc(bookings.id))
      .limit(limit)
      .offset(offset);

    const data = rows.map((r) => {
      const startStr = r.start ? new Date(r.start).toISOString() : "";
      const endStr = r.end ? new Date(r.end).toISOString() : "";
      return {
        id: r.id,
        courtId: r.courtId,
        courtName: r.courtName,
        venueId: r.venueId,
        venueName: r.venueName,
        customerId: r.customerId,
        customerName: r.customerName || r.guestName || "Khách hàng",
        customerPhone: r.customerPhone || r.guestPhone || null,
        guestName: r.guestName,
        guestPhone: r.guestPhone,
        during: { start: startStr, end: endStr },
        start: startStr,
        end: endStr,
        status: r.status,
        totalPrice: r.totalPrice,
        depositAmount: r.depositAmount,
        source: r.source,
        paymentStatus: r.status === "confirmed" || r.status === "completed" ? "paid" : "pending",
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
      };
    });

    return {
      data,
      meta: { page, limit, total, totalPages },
    };
  }

  async getTimeline(
    user: AuthenticatedUser,
    venueId: string,
    date: string,
  ): Promise<OwnerTimelineDay> {
    if (!venueId || !date) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "venueId và date là bắt buộc.",
      });
    }

    const [venue] = await this.db
      .select({ id: venues.id, ownerId: venues.ownerId })
      .from(venues)
      .where(eq(venues.id, venueId));

    if (!venue) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Không tìm thấy cơ sở thể thao.",
      });
    }

    if (user.role !== "admin" && venue.ownerId !== user.id) {
      throw new ForbiddenException({
        code: "NOT_VENUE_OWNER",
        message: "Bạn không phải chủ sở hữu của cơ sở này.",
      });
    }

    const courtRows = await this.db
      .select({
        id: courts.id,
        name: courts.name,
        sportId: courts.sportId,
        description: courts.description,
        status: courts.status,
      })
      .from(courts)
      .where(and(eq(courts.venueId, venueId), isNull(courts.deletedAt)))
      .orderBy(asc(courts.name));

    const courtIds = courtRows.map((c) => c.id);

    if (courtIds.length === 0) {
      return {
        date,
        venueId,
        courts: [],
        bookings: [],
        blackouts: [],
        openingHours: [],
      };
    }

    const dayStart = `${date}T00:00:00+07:00`;
    const dayEnd = `${date}T23:59:59.999+07:00`;

    const bookingRows = await this.db
      .select({
        id: bookings.id,
        courtId: bookings.courtId,
        start: sql<Date>`lower(${bookings.during})`,
        end: sql<Date>`upper(${bookings.during})`,
        status: bookings.status,
        source: bookings.source,
        guestName: bookings.guestName,
        customerName: users.fullName,
        totalPrice: bookings.totalPrice,
      })
      .from(bookings)
      .leftJoin(users, eq(bookings.customerId, users.id))
      .where(
        and(
          inArray(bookings.courtId, courtIds),
          inArray(bookings.status, [
            "held",
            "pending_payment",
            "confirmed",
            "completed",
          ]),
          sql`${bookings.during} && tstzrange(${dayStart}::timestamptz, ${dayEnd}::timestamptz)`,
        ),
      );

    const timelineBookings = bookingRows.map((b) => ({
      id: b.id,
      courtId: b.courtId,
      during: {
        start: b.start ? new Date(b.start).toISOString() : "",
        end: b.end ? new Date(b.end).toISOString() : "",
      },
      status: b.status as BookingStatus,
      source: (b.source ?? "online") as BookingSource,
      guestName: b.guestName,
      customerName: b.customerName || b.guestName || "Khách hàng",
      totalPrice: b.totalPrice,
    }));

    const blackoutRows = await this.db
      .select({
        id: blackoutPeriods.id,
        courtId: blackoutPeriods.courtId,
        reason: blackoutPeriods.reason,
        start: sql<Date>`lower(${blackoutPeriods.during})`,
        end: sql<Date>`upper(${blackoutPeriods.during})`,
        createdAt: blackoutPeriods.createdAt,
      })
      .from(blackoutPeriods)
      .where(
        and(
          inArray(blackoutPeriods.courtId, courtIds),
          sql`${blackoutPeriods.during} && tstzrange(${dayStart}::timestamptz, ${dayEnd}::timestamptz)`,
        ),
      );

    const timelineBlackouts = blackoutRows.map((bo) => ({
      id: bo.id,
      courtId: bo.courtId,
      reason: bo.reason ?? null,
      start: bo.start ? new Date(bo.start).toISOString() : "",
      end: bo.end ? new Date(bo.end).toISOString() : "",
      createdAt: bo.createdAt
        ? new Date(bo.createdAt).toISOString()
        : new Date().toISOString(),
    }));

    const hoursRows = await this.db
      .select()
      .from(openingHours)
      .where(inArray(openingHours.courtId, courtIds))
      .orderBy(asc(openingHours.dayOfWeek));

    const openingHoursList: OpeningHour[] = [1, 2, 3, 4, 5, 6, 0].map(
      (weekday) => {
        const found = hoursRows.find((r) => r.dayOfWeek === weekday);
        return {
          id: found?.id ?? `${venueId}-oh-${weekday}`,
          venueId,
          courtId: null,
          weekday,
          openTime:
            found && found.openTime ? found.openTime.slice(0, 5) : "06:00",
          closeTime:
            found && found.closeTime ? found.closeTime.slice(0, 5) : "22:00",
          isClosed: !found,
        };
      },
    );

    return {
      date,
      venueId,
      courts: courtRows.map((c) => ({
        id: c.id,
        name: c.name,
        sportId: c.sportId,
        description: c.description ?? null,
        status: (c.status ?? "active") as CourtStatus,
      })),
      bookings: timelineBookings,
      blackouts: timelineBlackouts,
      openingHours: openingHoursList,
    };
  }

  async createManualBooking(
    user: AuthenticatedUser,
    body: {
      courtId: string;
      start?: string;
      end?: string;
      slots?: Array<{ start: string; end: string }>;
      guestName?: string;
      guestPhone?: string;
      customerId?: string;
      note?: string;
      totalPrice?: number;
    },
  ) {
    const rawStart =
      body.start ||
      (body.slots && body.slots.length > 0 && body.slots[0]
        ? body.slots[0].start
        : "");
    const rawEnd =
      body.end ||
      (body.slots && body.slots.length > 0 && body.slots[body.slots.length - 1]
        ? body.slots[body.slots.length - 1]!.end
        : "");

    if (!body.courtId || !rawStart || !rawEnd) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "courtId, thời gian bắt đầu và kết thúc là bắt buộc.",
      });
    }

    const [court] = await this.db
      .select({
        id: courts.id,
        venueId: courts.venueId,
        ownerId: venues.ownerId,
      })
      .from(courts)
      .innerJoin(venues, eq(courts.venueId, venues.id))
      .where(eq(courts.id, body.courtId));

    if (!court) {
      throw new NotFoundException({
        code: "COURT_NOT_FOUND",
        message: "Không tìm thấy sân thi đấu.",
      });
    }

    if (user.role !== "admin" && court.ownerId !== user.id) {
      throw new ForbiddenException({
        code: "NOT_VENUE_OWNER",
        message: "Bạn không phải chủ sở hữu của sân này.",
      });
    }

    const startDate = new Date(rawStart);
    const endDate = new Date(rawEnd);

    if (
      isNaN(startDate.getTime()) ||
      isNaN(endDate.getTime()) ||
      startDate >= endDate
    ) {
      throw new BadRequestException({
        code: "INVALID_TIME_RANGE",
        message: "Khoảng thời gian đặt sân không hợp lệ.",
      });
    }

    const bookingId = v7();
    const paymentId = v7();
    const price = body.totalPrice ?? 100000;

    return await this.db.transaction(async (tx) => {
      // Check collision
      const overlaps = await tx
        .select({ id: bookings.id })
        .from(bookings)
        .where(
          and(
            eq(bookings.courtId, body.courtId),
            inArray(bookings.status, ["held", "pending_payment", "confirmed"]),
            sql`${bookings.during} && tstzrange(${startDate.toISOString()}, ${endDate.toISOString()})`,
          ),
        );

      if (overlaps.length > 0) {
        throw new BadRequestException({
          code: "SLOT_CONFLICT",
          message: "Khung giờ này đã có người đặt, vui lòng chọn giờ khác.",
        });
      }

      await tx.insert(bookings).values({
        id: bookingId,
        courtId: body.courtId,
        customerId: body.customerId ?? null,
        source: "manual",
        guestName: body.guestName ?? "Khách tại quầy",
        guestPhone: body.guestPhone ?? null,
        createdBy: user.id,
        during: sql`tstzrange(${startDate.toISOString()}, ${endDate.toISOString()})`,
        status: "confirmed",
        totalPrice: price,
        depositAmount: price,
        note: body.note ?? "Đặt sân trực tiếp tại quầy",
      });

      await tx.insert(payments).values({
        id: paymentId,
        bookingId,
        amount: price,
        provider: "cash",
        status: "paid",
        paidAt: new Date(),
      });

      return {
        id: bookingId,
        courtId: body.courtId,
        status: "confirmed",
        source: "manual",
        totalPrice: price,
        depositAmount: price,
        during: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      };
    });
  }

  async getRevenueReport(
    user: AuthenticatedUser,
    query: {
      from?: string;
      to?: string;
      groupBy?: "day" | "week" | "month";
      venueId?: string;
      courtId?: string;
    },
  ) {
    const venueIds = await this.getOwnerVenueIds(user, query.venueId);

    const today = new Date();
    const toDate = query.to ? new Date(query.to) : today;
    const fromDate = query.from
      ? new Date(query.from)
      : new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);

    const fromStr = fromDate.toISOString().slice(0, 10);
    const toStr = toDate.toISOString().slice(0, 10);

    if (venueIds.length === 0) {
      return {
        summary: { totalRevenue: 0, totalBookings: 0, from: fromStr, to: toStr },
        series: this.generateDateSeries(fromStr, toStr).map((date) => ({
          date,
          revenue: 0,
          bookings: 0,
        })),
      };
    }

    const conditions = [
      inArray(courts.venueId, venueIds),
      inArray(bookings.status, ["confirmed", "completed"]),
      sql`lower(${bookings.during}) >= ${fromStr}::date`,
      sql`lower(${bookings.during}) < (${toStr}::date + interval '1 day')`,
    ];

    if (query.courtId) {
      conditions.push(eq(bookings.courtId, query.courtId));
    }

    const rows = await this.db
      .select({
        date: sql<string>`to_char(lower(${bookings.during}), 'YYYY-MM-DD')`,
        revenue: sql<number>`coalesce(sum(${bookings.totalPrice}), 0)::int`,
        bookingsCount: sql<number>`count(*)::int`,
      })
      .from(bookings)
      .innerJoin(courts, eq(bookings.courtId, courts.id))
      .where(and(...conditions))
      .groupBy(sql`to_char(lower(${bookings.during}), 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(lower(${bookings.during}), 'YYYY-MM-DD')`);

    const rowMap = new Map<string, { revenue: number; bookings: number }>();
    let totalRevenue = 0;
    let totalBookings = 0;

    for (const r of rows) {
      rowMap.set(r.date, { revenue: r.revenue, bookings: r.bookingsCount });
      totalRevenue += r.revenue;
      totalBookings += r.bookingsCount;
    }

    const series = this.generateDateSeries(fromStr, toStr).map((date) => {
      const item = rowMap.get(date);
      return {
        date,
        revenue: item?.revenue ?? 0,
        bookings: item?.bookings ?? 0,
      };
    });

    return {
      summary: {
        totalRevenue,
        totalBookings,
        from: fromStr,
        to: toStr,
      },
      series,
    };
  }

  async getOccupancyReport(
    user: AuthenticatedUser,
    query: {
      from?: string;
      to?: string;
      venueId?: string;
      courtId?: string;
    },
  ) {
    const venueIds = await this.getOwnerVenueIds(user, query.venueId);

    const today = new Date();
    const toDate = query.to ? new Date(query.to) : today;
    const fromDate = query.from
      ? new Date(query.from)
      : new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);

    const fromStr = fromDate.toISOString().slice(0, 10);
    const toStr = toDate.toISOString().slice(0, 10);

    if (venueIds.length === 0) {
      return {
        summary: {
          occupancyRate: 0,
          bookedSlots: 0,
          availableSlots: 0,
          from: fromStr,
          to: toStr,
          peakHours: [],
        },
        series: this.generateDateSeries(fromStr, toStr).map((date) => ({
          date,
          occupancyRate: 0,
          bookedSlots: 0,
          availableSlots: 0,
        })),
      };
    }

    const [courtCountResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(courts)
      .where(and(inArray(courts.venueId, venueIds), isNull(courts.deletedAt)));

    const courtCount = Math.max(1, courtCountResult?.count ?? 1);
    const dailyAvailableSlots = courtCount * 28; // 14 hours * 2 slots/hour

    const conditions = [
      inArray(courts.venueId, venueIds),
      inArray(bookings.status, ["confirmed", "completed", "held", "pending_payment"]),
      sql`lower(${bookings.during}) >= ${fromStr}::date`,
      sql`lower(${bookings.during}) < (${toStr}::date + interval '1 day')`,
    ];

    if (query.courtId) {
      conditions.push(eq(bookings.courtId, query.courtId));
    }

    const rows = await this.db
      .select({
        date: sql<string>`to_char(lower(${bookings.during}), 'YYYY-MM-DD')`,
        hour: sql<string>`to_char(lower(${bookings.during}), 'HH24:00')`,
        slotsCount: sql<number>`count(*)::int`,
      })
      .from(bookings)
      .innerJoin(courts, eq(bookings.courtId, courts.id))
      .where(and(...conditions))
      .groupBy(
        sql`to_char(lower(${bookings.during}), 'YYYY-MM-DD')`,
        sql`to_char(lower(${bookings.during}), 'HH24:00')`,
      );

    const dateMap = new Map<string, number>();
    const hourMap = new Map<string, number>();
    let totalBookedSlots = 0;

    for (const r of rows) {
      dateMap.set(r.date, (dateMap.get(r.date) ?? 0) + r.slotsCount);
      hourMap.set(r.hour, (hourMap.get(r.hour) ?? 0) + r.slotsCount);
      totalBookedSlots += r.slotsCount;
    }

    const dateList = this.generateDateSeries(fromStr, toStr);
    const totalAvailableSlots = dailyAvailableSlots * dateList.length;

    const series = dateList.map((date) => {
      const booked = dateMap.get(date) ?? 0;
      const rate = dailyAvailableSlots > 0 ? Number((booked / dailyAvailableSlots).toFixed(2)) : 0;
      return {
        date,
        occupancyRate: Math.min(1, rate),
        bookedSlots: booked,
        availableSlots: Math.max(0, dailyAvailableSlots - booked),
      };
    });

    const peakHours = Array.from(hourMap.entries())
      .map(([startTime, bookedSlots]) => {
        const startH = parseInt(startTime.slice(0, 2), 10);
        const endH = (startH + 1).toString().padStart(2, "0") + ":00";
        return {
          startTime,
          endTime: endH,
          bookedSlots,
        };
      })
      .sort((a, b) => b.bookedSlots - a.bookedSlots)
      .slice(0, 3);

    const overallRate =
      totalAvailableSlots > 0
        ? Number((totalBookedSlots / totalAvailableSlots).toFixed(2))
        : 0;

    return {
      summary: {
        occupancyRate: Math.min(1, overallRate),
        bookedSlots: totalBookedSlots,
        availableSlots: Math.max(0, totalAvailableSlots - totalBookedSlots),
        from: fromStr,
        to: toStr,
        peakHours,
      },
      series,
    };
  }

  private generateDateSeries(from: string, to: string): string[] {
    const dates: string[] = [];
    const current = new Date(from);
    const end = new Date(to);

    while (current <= end) {
      dates.push(current.toISOString().slice(0, 10));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }
}
