import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import type {
  Blackout,
  OccupancyReport,
  OwnerTimelineDay,
  RevenueReport,
} from "../../../../../packages/shared/src/types.js";
import type {
  BookingSource,
  BookingStatus,
} from "../../../../../packages/shared/src/constants.js";
import type {
  BlackoutInput,
  BlackoutListQueryInput,
  OwnerReportQueryInput,
  OwnerTimelineQueryInput,
} from "../../../../../packages/shared/src/schemas.js";
import {
  formatVnIsoString,
  getVnDateTimeParts,
  isMultipleOf30Minutes,
  parseTsTzRange,
  parseVnDateTime,
  splitInto30MinBlocks,
} from "../../common/utils/time-range.js";
import { AuthService } from "../auth/auth.service.js";
import { BookingsService } from "../bookings/bookings.service.js";
import { RealtimePublisher } from "../realtime/realtime.publisher.js";
import { OwnerRepository, type OwnerBookingRow } from "./owner.repository.js";
import {
  aggregateRevenue,
  eachDate,
  isRangeOverlapping,
  splitOpenBlocks,
  timeToMinutes,
  toOccupancyPoint,
  topPeakHours,
  type MinuteRange,
} from "./reporting.rules.js";

const COUNTED_STATUSES = ["confirmed", "completed"] as const;

@Injectable()
export class OwnerService {
  constructor(
    private readonly repo: OwnerRepository,
    private readonly auth: AuthService,
    @Optional() private readonly bookings?: BookingsService,
    @Optional() private readonly realtime?: RealtimePublisher,
  ) {}

  async getTimeline(
    actorId: string,
    query: OwnerTimelineQueryInput,
  ): Promise<OwnerTimelineDay> {
    const actor = await this.auth.requireActiveUser(actorId);
    const venue = await this.repo.findVenue(query.venueId);
    if (!venue) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Cơ sở thể thao không tồn tại.",
      });
    }
    this.assertOwnership(actor.id, venue.ownerId);

    const allCourts = await this.repo.listCourts(venue.id);
    const courts = query.courtId
      ? allCourts.filter((court) => court.id === query.courtId)
      : allCourts;
    if (query.courtId && courts.length === 0) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Sân không thuộc cơ sở này.",
      });
    }

    const courtIds = courts.map((court) => court.id);
    const dayStart = parseVnDateTime(query.date, "00:00");
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);

    const [openingHours, bookings, blackouts] = await Promise.all([
      this.repo.listOpeningHours(courtIds),
      this.repo.listBookings(courtIds, dayStart, dayEnd, [
        "held",
        "pending_payment",
        "confirmed",
        "completed",
      ]),
      this.repo.listBlackouts(courtIds, dayStart, dayEnd),
    ]);

    return {
      date: query.date,
      venueId: venue.id,
      courts: courts.map((court) => ({
        id: court.id,
        name: court.name,
        description: court.description,
        sportId: court.sportId,
        status: court.status as "active" | "inactive",
      })),
      bookings: bookings.map((booking) => this.toTimelineBooking(booking)),
      blackouts: blackouts.map((blackout) => this.toBlackout(blackout)),
      openingHours: openingHours.map((hours) => ({
        id: hours.id,
        venueId: venue.id,
        courtId: hours.courtId,
        weekday: hours.dayOfWeek,
        openTime: String(hours.openTime).slice(0, 5),
        closeTime: String(hours.closeTime).slice(0, 5),
        isClosed: false,
      })),
    };
  }

  async listBlackouts(
    courtId: string,
    query: BlackoutListQueryInput,
  ): Promise<Blackout[]> {
    const court = await this.repo.findCourtWithVenue(courtId);
    if (!court) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Sân không tồn tại.",
      });
    }

    const from = parseVnDateTime(query.from, "00:00");
    const to = parseVnDateTime(query.to, "00:00");
    const rows = await this.repo.listBlackouts(
      [courtId],
      from,
      new Date(to.getTime() + 86_400_000),
    );
    return rows.map((row) => this.toBlackout(row));
  }

  async createBlackout(
    actorId: string,
    courtId: string,
    input: BlackoutInput,
  ): Promise<Blackout> {
    const actor = await this.auth.requireActiveUser(actorId);
    const court = await this.repo.findCourtWithVenue(courtId);
    if (!court) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Sân không tồn tại.",
      });
    }
    this.assertOwnership(actor.id, court.ownerId);

    const start = new Date(input.start);
    const end = new Date(input.end);
    if (
      !isMultipleOf30Minutes(start) ||
      !isMultipleOf30Minutes(end) ||
      start.getTime() >= end.getTime()
    ) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message:
          "Thời gian khoá sân phải là mốc 30 phút và bắt đầu trước khi kết thúc.",
      });
    }
    if (start.getTime() < Date.now()) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Không thể khoá sân trong quá khứ.",
      });
    }

    const startParts = getVnDateTimeParts(start);
    const endParts = getVnDateTimeParts(end);
    if (startParts.dateStr !== endParts.dateStr) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Khoảng khoá sân phải nằm trong cùng một ngày.",
      });
    }

    const hours = await this.repo.listOpeningHours([courtId]);
    const dayHours = hours.find(
      (row) => row.dayOfWeek === startParts.dayOfWeek,
    );
    const startMinutes = timeToMinutes(startParts.timeStr);
    const endMinutes = timeToMinutes(endParts.timeStr);
    if (
      !dayHours ||
      startMinutes < timeToMinutes(dayHours.openTime) ||
      endMinutes > timeToMinutes(dayHours.closeTime)
    ) {
      throw new BadRequestException({
        code: "BLACKOUT_OUTSIDE_OPENING_HOURS",
        message: "Khoảng khoá sân phải nằm trong giờ mở cửa của sân.",
      });
    }

    try {
      const result = await this.repo.createBlackout(
        courtId,
        start,
        end,
        input.reason ?? null,
      );
      if (result.kind === "booking_conflict") {
        throw new ConflictException({
          code: "BLACKOUT_BOOKING_CONFLICT",
          message: "Khoảng thời gian này đã có booking, không thể khoá sân.",
        });
      }
      const created = result.row!;
      const blackout = this.toBlackout({
        id: created.id,
        courtId: created.courtId,
        reason: created.reason ?? null,
        createdAt: created.createdAt ?? new Date(),
        start: start.toISOString(),
        end: end.toISOString(),
      });
      void this.publishBlackoutSlots(
        court.venueId,
        courtId,
        getVnDateTimeParts(start).dateStr,
      );
      return blackout;
    } catch (error) {
      if (this.isExclusionViolation(error)) {
        throw new ConflictException({
          code: "BLACKOUT_OVERLAP",
          message: "Khoảng thời gian này trùng với lịch khoá sân đã có.",
        });
      }
      throw error;
    }
  }

  async deleteBlackout(
    actorId: string,
    courtId: string,
    blackoutId: string,
  ): Promise<{ id: string; deleted: true }> {
    const actor = await this.auth.requireActiveUser(actorId);
    const court = await this.repo.findCourtWithVenue(courtId);
    if (!court) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Sân không tồn tại.",
      });
    }
    this.assertOwnership(actor.id, court.ownerId);

    const deleted = await this.repo.deleteBlackout(courtId, blackoutId);
    if (!deleted) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Không tìm thấy lịch khoá sân.",
      });
    }
    const range = parseTsTzRange(deleted.during);
    void this.publishBlackoutSlots(
      court.venueId,
      courtId,
      getVnDateTimeParts(range.start).dateStr,
    );
    return { id: deleted.id, deleted: true };
  }

  async getRevenue(
    actorId: string,
    query: OwnerReportQueryInput,
  ): Promise<RevenueReport> {
    const scope = await this.resolveReportScope(actorId, query);
    const from = parseVnDateTime(query.from, "00:00");
    const to = parseVnDateTime(query.to, "00:00");
    const rangeEnd = new Date(to.getTime() + 86_400_000);

    const bookings = await this.repo.listBookings(
      scope.courtIds,
      from,
      rangeEnd,
      COUNTED_STATUSES,
    );
    const daily = new Map<string, { revenue: number; bookings: number }>();
    for (const booking of bookings) {
      const date = getVnDateTimeParts(booking.start).dateStr;
      const current = daily.get(date) ?? { revenue: 0, bookings: 0 };
      current.revenue += booking.totalPrice;
      current.bookings += 1;
      daily.set(date, current);
    }

    const days = eachDate(query.from, query.to);
    const series = aggregateRevenue(
      days.map((date) => ({
        date,
        revenue: daily.get(date)?.revenue ?? 0,
        bookings: daily.get(date)?.bookings ?? 0,
      })),
      query.groupBy,
    );

    return {
      summary: {
        totalRevenue: bookings.reduce(
          (total, booking) => total + booking.totalPrice,
          0,
        ),
        totalBookings: bookings.length,
        from: query.from,
        to: query.to,
      },
      series,
    };
  }

  async getOccupancy(
    actorId: string,
    query: OwnerReportQueryInput,
  ): Promise<OccupancyReport> {
    const scope = await this.resolveReportScope(actorId, query);
    const from = parseVnDateTime(query.from, "00:00");
    const to = parseVnDateTime(query.to, "00:00");
    const rangeEnd = new Date(to.getTime() + 86_400_000);
    const courtIds = scope.courtIds;

    const [openingHours, blackouts, bookings] = await Promise.all([
      this.repo.listOpeningHours(courtIds),
      this.repo.listBlackouts(courtIds, from, rangeEnd),
      this.repo.listBookings(courtIds, from, rangeEnd, COUNTED_STATUSES),
    ]);

    const hoursByCourtDay = new Map(
      openingHours.map((row) => [`${row.courtId}:${row.dayOfWeek}`, row]),
    );
    const bookingStarts = new Map<string, Set<number>>();
    const allSlotStarts: Date[] = [];
    for (const booking of bookings) {
      for (const block of splitInto30MinBlocks(booking.start, booking.end)) {
        const parts = getVnDateTimeParts(block.start);
        const key = `${booking.courtId}:${parts.dateStr}`;
        const set = bookingStarts.get(key) ?? new Set<number>();
        set.add(parts.hours * 60 + parts.minutes);
        bookingStarts.set(key, set);
        allSlotStarts.push(block.start);
      }
    }

    const blackoutRanges = blackouts.map((row) => ({
      courtId: row.courtId,
      start: new Date(row.start),
      end: new Date(row.end),
    }));

    const series = eachDate(query.from, query.to).map((date) => {
      const weekday = getVnDateTimeParts(
        parseVnDateTime(date, "12:00"),
      ).dayOfWeek;
      const dayStart = parseVnDateTime(date, "00:00");
      const dayStartMs = dayStart.getTime();
      const dayEndMs = dayStartMs + 86_400_000;
      let availableSlots = 0;
      let bookedSlots = 0;

      for (const courtId of courtIds) {
        const hours = hoursByCourtDay.get(`${courtId}:${weekday}`);
        if (!hours) continue;

        const blocked: MinuteRange[] = blackoutRanges
          .filter(
            (range) =>
              range.courtId === courtId &&
              range.start.getTime() < dayEndMs &&
              dayStartMs < range.end.getTime(),
          )
          .map((range) => ({
            start: Math.max(
              0,
              Math.floor((range.start.getTime() - dayStartMs) / 60_000),
            ),
            end: Math.min(
              1440,
              Math.ceil((range.end.getTime() - dayStartMs) / 60_000),
            ),
          }));

        const starts = bookingStarts.get(`${courtId}:${date}`) ?? new Set();
        for (const block of splitOpenBlocks(hours.openTime, hours.closeTime)) {
          if (blocked.some((range) => isRangeOverlapping(block, range))) {
            continue;
          }
          availableSlots += 1;
          if (starts.has(block.start)) bookedSlots += 1;
        }
      }

      return toOccupancyPoint(date, bookedSlots, availableSlots);
    });

    const totalAvailable = series.reduce(
      (total, point) => total + point.availableSlots,
      0,
    );
    const totalBooked = series.reduce(
      (total, point) => total + point.bookedSlots,
      0,
    );

    return {
      summary: {
        occupancyRate:
          totalAvailable > 0
            ? Math.min(100, Math.round((totalBooked / totalAvailable) * 100))
            : 0,
        bookedSlots: totalBooked,
        availableSlots: totalAvailable,
        from: query.from,
        to: query.to,
        peakHours: topPeakHours(allSlotStarts),
      },
      series,
    };
  }

  private async resolveReportScope(
    actorId: string,
    query: OwnerReportQueryInput,
  ): Promise<{ courtIds: string[] }> {
    const actor = await this.auth.requireActiveUser(actorId);

    if (query.venueId) {
      const venue = await this.repo.findVenue(query.venueId);
      if (!venue) {
        throw new NotFoundException({
          code: "NOT_FOUND",
          message: "Cơ sở thể thao không tồn tại.",
        });
      }
      this.assertOwnership(actor.id, venue.ownerId);
      const courts = await this.repo.listCourts(venue.id);
      return this.scopeCourts(courts.map((court) => court.id), query.courtId);
    }

    const venues = await this.repo.listVenuesByOwner(actor.id);
    const courtIds: string[] = [];
    for (const venue of venues) {
      const courts = await this.repo.listCourts(venue.id);
      courtIds.push(...courts.map((court) => court.id));
    }
    return this.scopeCourts(courtIds, query.courtId);
  }

  private scopeCourts(courtIds: string[], courtId?: string) {
    if (!courtId) return { courtIds };
    if (!courtIds.includes(courtId)) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Bạn không có quyền xem báo cáo của sân này.",
      });
    }
    return { courtIds: [courtId] };
  }

  private assertOwnership(actorId: string, ownerId: string) {
    if (actorId !== ownerId) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Bạn không có quyền quản lý cơ sở này.",
      });
    }
  }

  private isExclusionViolation(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "23P01"
    );
  }

  private async publishBlackoutSlots(
    venueId: string,
    courtId: string,
    date: string,
  ): Promise<void> {
    if (!this.realtime || !this.bookings) return;
    try {
      const grid = await this.bookings.getVenueSlots(venueId, { date });
      const court = grid.data.courts.find((item) => item.courtId === courtId);
      if (!court) return;
      this.realtime.emitSlots({
        venueId,
        courtId,
        date,
        slots: court.slots,
      });
    } catch {
      // Realtime là best-effort; blackout đã commit trong DB.
    }
  }

  private toTimelineBooking(booking: OwnerBookingRow) {
    return {
      id: booking.id,
      courtId: booking.courtId,
      during: {
        start: formatVnIsoString(booking.start),
        end: formatVnIsoString(booking.end),
      },
      status: booking.status as BookingStatus,
      source: booking.source as BookingSource,
      guestName: booking.guestName,
      customerName: booking.customerName,
      totalPrice: booking.totalPrice,
    };
  }

  private toBlackout(row: {
    id: string;
    courtId: string;
    reason: string | null;
    createdAt: Date | string;
    start: string;
    end: string;
  }): Blackout {
    return {
      id: row.id,
      courtId: row.courtId,
      start: formatVnIsoString(new Date(row.start)),
      end: formatVnIsoString(new Date(row.end)),
      reason: row.reason,
      createdAt:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : new Date(row.createdAt).toISOString(),
    };
  }
}