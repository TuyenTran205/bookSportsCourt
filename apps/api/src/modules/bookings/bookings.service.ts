import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";
import type {
  BookingSource,
  BookingStatus,
} from "../../../../../packages/shared/src/constants.js";
import { BOOKING_STATUSES } from "../../../../../packages/shared/src/constants.js";
import type {
  AuthenticatedUser,
  Booking,
  BookingDetail,
  CourtSlots,
  HoldBookingResponse,
} from "../../../../../packages/shared/src/types.js";
import { BookingsRepository } from "./bookings.repository.js";
import {
  addDaysToDateString,
  assertBlocksWithinOpeningHours,
  buildCourtSlotsForDate,
  calculateBlocksPrice,
  calculateDepositAmount,
  DEFAULT_HOLD_TTL_MINUTES,
  evaluateCancellationPreview,
  formatDateToVnIso,
  HOLD_LIMIT,
  HOLD_RATE_LIMIT_PER_HOUR,
  isValidDateString,
  parseHoldInput,
  SLOT_MS,
  splitRangeIntoBlocks,
} from "./bookings.rules.js";

const uuidSchema = z.string().uuid();

@Injectable()
export class BookingsService {
  constructor(
    private readonly repo: BookingsRepository,
    private readonly config: ConfigService,
  ) {}

  private holdTtlMinutes(): number {
    const raw = Number(
      this.config.get("HOLD_TTL_MINUTES") ??
        this.config.get("BOOKING_HOLD_TTL_MINUTES") ??
        DEFAULT_HOLD_TTL_MINUTES,
    );
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_HOLD_TTL_MINUTES;
  }

  private parseUuid(value: unknown, fieldLabel = "ID"): string {
    const parsed = uuidSchema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: `${fieldLabel} không đúng định dạng UUID.`,
      });
    }
    return parsed.data;
  }

  private formatHoldResponse(
    bookingRow: {
      id: string;
      courtId: string;
      customerId: string | null;
      source: string;
      guestName: string | null;
      guestPhone: string | null;
      status: string;
      totalPrice: number;
      depositAmount: number;
      note: string | null;
      expiresAt: Date | null;
      cancelledAt: Date | null;
      cancelReason: string | null;
      createdAt: Date;
    },
    paymentRow: {
      id: string;
      amount: number;
      transferCode: string | null;
      bankAccountSnapshot: {
        bankBin: string;
        accountNo: string;
        accountName: string;
      } | null;
    },
    start: Date,
    end: Date,
    now: Date,
  ): HoldBookingResponse & { remainingMs: number } {
    const booking: Booking = {
      id: bookingRow.id,
      courtId: bookingRow.courtId,
      customerId: bookingRow.customerId,
      source: bookingRow.source as BookingSource,
      guestName: bookingRow.guestName ?? null,
      guestPhone: bookingRow.guestPhone ?? null,
      during: {
        start: formatDateToVnIso(start),
        end: formatDateToVnIso(end),
      },
      status: bookingRow.status as BookingStatus,
      totalPrice: bookingRow.totalPrice,
      depositAmount: bookingRow.depositAmount,
      note: bookingRow.note ?? null,
      expiresAt: bookingRow.expiresAt
        ? bookingRow.expiresAt.toISOString()
        : null,
      cancelledAt: bookingRow.cancelledAt
        ? bookingRow.cancelledAt.toISOString()
        : null,
      cancelReason: bookingRow.cancelReason ?? null,
      createdAt: bookingRow.createdAt.toISOString(),
    };

    const remainingMs = bookingRow.expiresAt
      ? Math.max(0, bookingRow.expiresAt.getTime() - now.getTime())
      : 0;

    return {
      booking,
      remainingMs,
      payment: {
        id: paymentRow.id,
        amount: paymentRow.amount,
        transferCode: paymentRow.transferCode ?? "",
        bankAccount: paymentRow.bankAccountSnapshot ?? {
          bankBin: "",
          accountNo: "",
          accountName: "",
        },
      },
    };
  }

  /**
   * 1. `GET /venues/:id/slots` — Dựng ma trận lưới giờ 30 phút theo ngày.
   * Thực hiện lazy-expire các hold quá hạn của Venue trước khi dựng lưới.
   */
  async getVenueSlots(
    venueIdOrSlug: string,
    query: Record<string, unknown>,
    currentUser?: AuthenticatedUser,
  ): Promise<{
    data: { date: string; courts: CourtSlots[] };
    gridVersion: string;
  }> {
    const dateStr = typeof query.date === "string" ? query.date.trim() : "";
    if (!isValidDateString(dateStr)) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Tham số date bắt buộc có định dạng hợp lệ YYYY-MM-DD.",
      });
    }

    let courtId: string | undefined;
    if (query.courtId !== undefined && query.courtId !== "") {
      courtId = this.parseUuid(query.courtId, "courtId");
    }

    const venue = await this.repo.findApprovedVenueByIdOrSlug(venueIdOrSlug);
    if (!venue) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Không tìm thấy cơ sở thể thao.",
      });
    }

    // Lazy-expire các hold quá hạn trên venue này trước khi tính lưới giờ
    await this.repo.expireStaleHoldsForVenue(venue.id);

    const dayStartUtc = new Date(`${dateStr}T00:00:00+07:00`);
    const nextDateStr = addDaysToDateString(dateStr, 1);
    const dayEndUtc = new Date(`${nextDateStr}T00:00:00+07:00`);

    const [gridData, now] = await Promise.all([
      this.repo.loadVenueSlotGridData({
        venueId: venue.id,
        courtId,
        dayStartUtc,
        dayEndUtc,
      }),
      this.repo.now(),
    ]);

    if (courtId && gridData.courts.length === 0) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Không tìm thấy sân con trong cơ sở này.",
      });
    }

    const courtsResult: CourtSlots[] = gridData.courts.map((court) => {
      const slots = buildCourtSlotsForDate({
        dateStr,
        openingHours: gridData.openingHoursByCourt.get(court.id) ?? [],
        pricingRules: gridData.pricingRulesByCourt.get(court.id) ?? [],
        bookings: gridData.bookingsByCourt.get(court.id) ?? [],
        blackouts: gridData.blackoutsByCourt.get(court.id) ?? [],
        currentUserId: currentUser?.id ?? null,
        now,
        fallbackPricePerSlot: venue.fromPrice ?? 0,
      });

      return {
        courtId: court.id,
        slots,
      };
    });

    return {
      data: {
        date: dateStr,
        courts: courtsResult,
      },
      gridVersion: gridData.maxUpdatedAt.toISOString(),
    };
  }

  /**
   * 2. `POST /bookings/hold` — Giữ chỗ tạm 10 phút.
   * Sử dụng transaction + advisory lock theo `courtId` + PostgreSQL EXCLUDE constraint.
   */
  async createHold(
    user: AuthenticatedUser,
    body: unknown,
    headerIdempotencyKey?: string,
  ): Promise<{
    statusCode: 200 | 201;
    data: HoldBookingResponse & { remainingMs: number };
  }> {
    const input = parseHoldInput(body, headerIdempotencyKey);
    const blocks = splitRangeIntoBlocks(input.start, input.end);

    try {
      return await this.repo.transaction(async (tx) => {
        // 1. Advisory lock theo courtId để tuần tự hóa các yêu cầu tranh chấp trên cùng 1 sân
        await this.repo.acquireCourtAdvisoryLock(tx, input.courtId);

        // 2. Khoá theo thứ tự cố định: Customer -> Venue (FOR SHARE) -> Court (FOR SHARE)
        const { customer, venue, court } = await this.repo.lockContextForHold(
          tx,
          user.id,
          input.courtId,
        );

        if (!customer || customer.status !== "active") {
          throw new ForbiddenException({
            code: "ACCOUNT_SUSPENDED",
            message: "Tài khoản không hoạt động.",
          });
        }

        if (
          !venue ||
          venue.deletedAt !== null ||
          venue.status !== "approved" ||
          !court ||
          court.deletedAt !== null ||
          court.status !== "active"
        ) {
          throw new NotFoundException({
            code: "NOT_FOUND",
            message: "Sân hoặc cơ sở thể thao không tồn tại hoặc tạm ngừng nhận đặt.",
          });
        }

        const now = await this.repo.now(tx);

        // 3. Lazy-expire các hold đã quá hạn trên sân này trước khi kiểm tra trùng
        await this.repo.expireStaleHoldsForCourt(tx, court.id, now);

        // 4. Kiểm tra Idempotency (trùng Idempotency-Key hoặc cùng khách gửi lại đúng courtId + during)
        const existingHold = await this.repo.findIdempotentHold(tx, {
          customerId: user.id,
          courtId: court.id,
          start: input.start,
          end: input.end,
          idempotencyKey: input.idempotencyKey,
          now,
        });

        if (existingHold) {
          return {
            statusCode: 200 as const,
            data: this.formatHoldResponse(
              existingHold.booking,
              existingHold.payment,
              existingHold.start,
              existingHold.end,
              now,
            ),
          };
        }

        // 5. Không cho phép giữ chỗ cho thời điểm đã qua
        if (input.start.getTime() <= now.getTime()) {
          throw new BadRequestException({
            code: "INVALID_TIME_RANGE",
            message: "Không thể giữ chỗ cho khung giờ trong quá khứ.",
          });
        }

        // 6. Đọc cấu hình giờ mở cửa, bảng giá, tài khoản nhận tiền, chính sách cọc
        const config = await this.repo.loadCourtSchedulingConfig(
          tx,
          court.id,
          venue.id,
        );

        // 7. Kiểm tra giờ mở cửa
        assertBlocksWithinOpeningHours(blocks, config.openingHours);

        // 8. Kiểm tra khoá bảo trì (blackout_periods)
        const inBlackout = await this.repo.hasBlackoutOverlap(
          tx,
          court.id,
          input.start,
          input.end,
        );
        if (inBlackout) {
          throw new ConflictException({
            code: "BOOKING_CONFLICT",
            message: "Khung giờ đã chọn nằm trong khoảng bảo trì của sân.",
          });
        }

        // 9. Kiểm tra trùng với các booking đang hoạt động của người khác
        const overlaps = await this.repo.findOverlappingBookings(
          tx,
          court.id,
          input.start,
          input.end,
          now,
        );
        if (overlaps.length > 0) {
          throw new ConflictException({
            code: "BOOKING_CONFLICT",
            message: "Khung giờ này vừa có người khác giữ chỗ hoặc đặt sân.",
          });
        }

        // 10. Kiểm tra giới hạn tối đa 3 hold đồng thời của một khách hàng (HOLD_LIMIT)
        const activeHoldCount = await this.repo.countActiveCustomerHolds(
          tx,
          user.id,
          now,
        );
        if (activeHoldCount >= HOLD_LIMIT) {
          throw new UnprocessableEntityException({
            code: "HOLD_LIMIT_EXCEEDED",
            message: `Bạn chỉ được giữ tối đa ${HOLD_LIMIT} chỗ đồng thời. Vui lòng hoàn tất hoặc huỷ lượt giữ chỗ hiện tại.`,
          });
        }

        // 11. Kiểm tra rate limit giữ/nhả liên tục trên cùng một sân (HOLD_RATE_LIMIT_PER_HOUR)
        const recentReleasedCount =
          await this.repo.countRecentReleasedHoldsOnCourt(
            tx,
            user.id,
            court.id,
            now,
          );
        if (recentReleasedCount >= HOLD_RATE_LIMIT_PER_HOUR) {
          throw new HttpException(
            {
              code: "HOLD_RATE_LIMITED",
              message:
                "Bạn đã giữ và huỷ chỗ trên sân này quá nhiều lần trong 1 giờ qua. Vui lòng thử lại sau.",
            },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }

        // 12. Kiểm tra cơ sở đã cấu hình tài khoản ngân hàng nhận tiền chưa
        if (!config.paymentAccount) {
          throw new UnprocessableEntityException({
            code: "PAYMENT_ACCOUNT_MISSING",
            message:
              "Cơ sở thể thao chưa cấu hình tài khoản nhận thanh toán chuyển khoản.",
          });
        }

        // 13. Tính giá tại Server từ pricing_rules (không tin bất kỳ giá nào từ client)
        const { totalPrice } = calculateBlocksPrice(
          config.pricingRules,
          blocks,
        );
        const depositAmount = calculateDepositAmount(
          totalPrice,
          config.cancellationPolicy.depositPercent,
        );

        const expiresAt = new Date(
          now.getTime() + this.holdTtlMinutes() * 60_000,
        );

        // 14. INSERT booking (status='held') + payment (status='pending')
        const created = await this.repo.createHoldBookingAndPayment(tx, {
          courtId: court.id,
          venueId: venue.id,
          ownerId: venue.ownerId,
          customerId: user.id,
          start: input.start,
          end: input.end,
          totalPrice,
          depositAmount,
          expiresAt,
          note: input.note,
          bankAccount: config.paymentAccount,
          idempotencyKey: input.idempotencyKey,
          now,
        });

        return {
          statusCode: 201 as const,
          data: this.formatHoldResponse(
            created.booking,
            created.payment,
            created.start,
            created.end,
            now,
          ),
        };
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      const pgCode =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: unknown }).code)
          : "";
      if (pgCode === "23P01") {
        throw new ConflictException({
          code: "BOOKING_CONFLICT",
          message: "Khung giờ này vừa có người khác giữ chỗ hoặc đặt sân.",
        });
      }
      if (pgCode === "23514") {
        throw new BadRequestException({
          code: "INVALID_TIME_RANGE",
          message: "Thời gian đặt sân phải theo đúng lưới 30 phút.",
        });
      }
      throw error;
    }
  }

  /**
   * Xem trước báo giá (`POST /bookings/quote`) phục vụ thanh tóm tắt ở Frontend.
   * Không ghi dữ liệu vào DB; mọi số tiền tính trực tiếp từ `pricing_rules` và `cancellation_policies`.
   */
  async quoteBooking(body: unknown): Promise<{
    total: number;
    deposit: number;
    depositPercent: number;
    ranges: Array<{ start: string; end: string }>;
    unavailable: string[];
  }> {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu báo giá không hợp lệ.",
      });
    }
    const record = body as Record<string, unknown>;
    const courtId = this.parseUuid(record.courtId, "courtId");

    const rawSlots = Array.isArray(record.slots) ? record.slots : [];
    if (rawSlots.length === 0) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Danh sách khung giờ (slots) không được để trống.",
      });
    }

    const parsedSlots = rawSlots
      .map((item, idx) => {
        if (!item || typeof item !== "object") {
          throw new BadRequestException({
            code: "VALIDATION_ERROR",
            message: `Slot thứ ${idx + 1} không hợp lệ.`,
          });
        }
        const s = new Date(String((item as Record<string, unknown>).start));
        const e = new Date(String((item as Record<string, unknown>).end));
        if (
          Number.isNaN(s.getTime()) ||
          Number.isNaN(e.getTime()) ||
          s >= e ||
          (e.getTime() - s.getTime()) % SLOT_MS !== 0
        ) {
          throw new BadRequestException({
            code: "INVALID_TIME_RANGE",
            message: "Khung giờ không hợp lệ.",
          });
        }
        return {
          start: s,
          end: e,
          rawStart: String((item as Record<string, unknown>).start),
          rawEnd: String((item as Record<string, unknown>).end),
        };
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    return this.repo.transaction(async (tx) => {
      const { venue, court } = await this.repo.lockContextForHold(
        tx,
        "00000000-0000-0000-0000-000000000000",
        courtId,
      );
      if (!venue || !court || court.deletedAt !== null) {
        throw new NotFoundException({
          code: "NOT_FOUND",
          message: "Không tìm thấy sân con.",
        });
      }

      const now = await this.repo.now(tx);
      await this.repo.expireStaleHoldsForCourt(tx, courtId, now);

      const config = await this.repo.loadCourtSchedulingConfig(
        tx,
        court.id,
        venue.id,
      );

      let total = 0;
      const unavailable: string[] = [];

      for (const slot of parsedSlots) {
        const blocks = splitRangeIntoBlocks(slot.start, slot.end);
        const { totalPrice } = calculateBlocksPrice(
          config.pricingRules,
          blocks,
        );
        total += totalPrice;

        const [overlaps, inBlackout] = await Promise.all([
          this.repo.findOverlappingBookings(
            tx,
            courtId,
            slot.start,
            slot.end,
            now,
          ),
          this.repo.hasBlackoutOverlap(tx, courtId, slot.start, slot.end),
        ]);
        if (
          overlaps.length > 0 ||
          inBlackout ||
          slot.start.getTime() <= now.getTime()
        ) {
          unavailable.push(slot.rawStart);
        }
      }

      // Gộp các slot liên tiếp thành dải (ranges)
      const ranges: Array<{ start: string; end: string }> = [];
      for (const slot of parsedSlots) {
        const prev = ranges[ranges.length - 1];
        if (prev && new Date(prev.end).getTime() === slot.start.getTime()) {
          prev.end = slot.rawEnd;
        } else {
          ranges.push({ start: slot.rawStart, end: slot.rawEnd });
        }
      }

      const depositPercent = config.cancellationPolicy.depositPercent;
      const deposit = calculateDepositAmount(total, depositPercent);

      return {
        total,
        deposit,
        depositPercent,
        ranges,
        unavailable,
      };
    });
  }

  /**
   * 3. `GET /bookings` — Danh sách lịch sử đặt sân của chính Customer đang đăng nhập.
   */
  async listMyBookings(
    user: AuthenticatedUser,
    query: Record<string, unknown>,
  ): Promise<{
    data: BookingDetail[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    let status: string | undefined;
    if (query.status !== undefined && query.status !== "") {
      const s = String(query.status);
      if (!(BOOKING_STATUSES as readonly string[]).includes(s)) {
        throw new BadRequestException({
          code: "VALIDATION_ERROR",
          message: "Trạng thái lọc (status) không hợp lệ.",
        });
      }
      status = s;
    }

    let from: string | undefined;
    if (query.from !== undefined && query.from !== "") {
      from = String(query.from).trim();
      if (!isValidDateString(from)) {
        throw new BadRequestException({
          code: "VALIDATION_ERROR",
          message: "Tham số from phải có định dạng YYYY-MM-DD.",
        });
      }
    }

    let to: string | undefined;
    if (query.to !== undefined && query.to !== "") {
      to = String(query.to).trim();
      if (!isValidDateString(to)) {
        throw new BadRequestException({
          code: "VALIDATION_ERROR",
          message: "Tham số to phải có định dạng YYYY-MM-DD.",
        });
      }
    }

    const rawPage = query.page !== undefined ? Number(query.page) : 1;
    const rawLimit =
      query.limit !== undefined
        ? Number(query.limit)
        : query.pageSize !== undefined
          ? Number(query.pageSize)
          : 20;

    if (!Number.isInteger(rawPage) || rawPage < 1) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Tham số page phải là số nguyên dương.",
      });
    }
    if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 100) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Tham số limit phải nằm trong khoảng 1..100.",
      });
    }

    await this.repo.expireStaleHoldsForCustomer(user.id);

    const { rows, total } = await this.repo.listCustomerBookings({
      customerId: user.id,
      status,
      from,
      to,
      page: rawPage,
      limit: rawLimit,
    });

    return {
      data: rows,
      meta: {
        page: rawPage,
        limit: rawLimit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / rawLimit),
      },
    };
  }

  /**
   * 4. `GET /bookings/:id` — Chi tiết một đơn đặt sân.
   * Chống dò ID (Anti-enumeration): trả 404 nếu Customer truy cập đơn của người khác.
   */
  async getBookingById(
    user: AuthenticatedUser,
    id: string,
  ): Promise<BookingDetail & { remainingMs?: number }> {
    const bookingId = this.parseUuid(id, "Mã đặt sân");

    return this.repo.transaction(async (tx) => {
      const now = await this.repo.now(tx);
      let bundle = await this.repo.findBookingBundleById(bookingId, tx);

      if (!bundle) {
        throw new NotFoundException({
          code: "NOT_FOUND",
          message: "Không tìm thấy đơn đặt sân.",
        });
      }

      if (user.role === "customer" && bundle.booking.customerId !== user.id) {
        // Trả 404 thay vì 403 để chống dò ID (anti-enumeration)
        throw new NotFoundException({
          code: "NOT_FOUND",
          message: "Không tìm thấy đơn đặt sân.",
        });
      }

      if (user.role === "owner" && bundle.venue.ownerId !== user.id) {
        throw new ForbiddenException({
          code: "NOT_VENUE_OWNER",
          message: "Bạn không phải chủ sở hữu cơ sở của đơn đặt sân này.",
        });
      }

      if (
        bundle.booking.status === "held" &&
        bundle.booking.expiresAt &&
        now >= bundle.booking.expiresAt
      ) {
        await this.repo.expireStaleHoldsForCourt(
          tx,
          bundle.booking.courtId,
          now,
        );
        bundle = (await this.repo.findBookingBundleById(bookingId, tx))!;
      }

      const detail = this.repo.toBookingDetail(bundle);
      if (bundle.booking.status === "held" && bundle.booking.expiresAt) {
        const remainingMs = Math.max(
          0,
          bundle.booking.expiresAt.getTime() - now.getTime(),
        );
        return { ...detail, remainingMs };
      }

      return detail;
    });
  }

  /**
   * `GET /bookings/hold/:id` — Lấy trạng thái đếm ngược của lượt giữ chỗ (phục vụ màn Checkout FE).
   */
  async getHoldById(
    user: AuthenticatedUser,
    id: string,
  ): Promise<HoldBookingResponse & { remainingMs: number }> {
    const bookingId = this.parseUuid(id, "Mã giữ chỗ");

    return this.repo.transaction(async (tx) => {
      const now = await this.repo.now(tx);
      let bundle = await this.repo.findBookingBundleById(bookingId, tx);

      if (!bundle || bundle.booking.customerId !== user.id) {
        throw new NotFoundException({
          code: "NOT_FOUND",
          message: "Không tìm thấy lượt giữ chỗ.",
        });
      }

      if (
        bundle.booking.status === "held" &&
        bundle.booking.expiresAt &&
        now >= bundle.booking.expiresAt
      ) {
        await this.repo.expireStaleHoldsForCourt(
          tx,
          bundle.booking.courtId,
          now,
        );
        bundle = (await this.repo.findBookingBundleById(bookingId, tx))!;
      }

      if (!bundle.payment) {
        throw new ConflictException({
          code: "PAYMENT_DATA_INCOMPLETE",
          message: "Thiếu dữ liệu thanh toán cho lượt giữ chỗ.",
        });
      }

      return this.formatHoldResponse(
        bundle.booking,
        bundle.payment,
        bundle.start,
        bundle.end,
        now,
      );
    });
  }

  /**
   * 5. `GET /bookings/:id/cancellation-preview` — Xem điều kiện huỷ và tiền hoàn dự kiến.
   */
  async getCancellationPreview(user: AuthenticatedUser, id: string) {
    const bookingId = this.parseUuid(id, "Mã đặt sân");

    return this.repo.transaction(async (tx) => {
      const now = await this.repo.now(tx);
      const bundle = await this.repo.findBookingBundleById(bookingId, tx);

      if (!bundle || bundle.booking.customerId !== user.id) {
        throw new NotFoundException({
          code: "NOT_FOUND",
          message: "Không tìm thấy đơn đặt sân.",
        });
      }

      const policy = await this.repo.getVenueCancellationPolicy(
        bundle.venue.id,
        tx,
      );

      return evaluateCancellationPreview({
        bookingStatus: bundle.booking.status,
        bookingStart: bundle.start,
        bookingExpiresAt: bundle.booking.expiresAt,
        depositAmount: bundle.booking.depositAmount,
        paymentStatus: bundle.payment?.status ?? null,
        paymentAmount: bundle.payment?.amount ?? null,
        policy,
        now,
      });
    });
  }

  /**
   * 6. `PATCH /bookings/:id/cancel` (và `POST /bookings/:id/cancel`) — Huỷ đơn đặt sân theo chính sách.
   */
  async cancelBooking(
    user: AuthenticatedUser,
    id: string,
    body: unknown,
  ): Promise<BookingDetail> {
    const bookingId = this.parseUuid(id, "Mã đặt sân");

    let reasonInput: string | undefined;
    if (body && typeof body === "object" && !Array.isArray(body)) {
      const rawReason = (body as Record<string, unknown>).reason;
      if (rawReason !== undefined && rawReason !== null) {
        if (typeof rawReason !== "string") {
          throw new BadRequestException({
            code: "VALIDATION_ERROR",
            message: "Lý do huỷ (reason) phải là chuỗi ký tự.",
          });
        }
        const trimmed = rawReason.trim();
        if (trimmed.length > 500) {
          throw new BadRequestException({
            code: "VALIDATION_ERROR",
            message: "Lý do huỷ (reason) không được vượt quá 500 ký tự.",
          });
        }
        if (trimmed.length > 0) {
          reasonInput = trimmed;
        }
      }
    }

    await this.repo.expireStaleHoldsForCustomer(user.id);

    return this.repo.transaction(async (tx) => {
      const now = await this.repo.now(tx);
      const bundle = await this.repo.findBookingBundleById(bookingId, tx, true);

      if (!bundle) {
        throw new NotFoundException({
          code: "NOT_FOUND",
          message: "Không tìm thấy đơn đặt sân.",
        });
      }

      if (user.role === "customer" && bundle.booking.customerId !== user.id) {
        throw new NotFoundException({
          code: "NOT_FOUND",
          message: "Không tìm thấy đơn đặt sân.",
        });
      }

      if (user.role === "owner" && bundle.venue.ownerId !== user.id) {
        throw new ForbiddenException({
          code: "NOT_VENUE_OWNER",
          message: "Bạn không phải chủ sở hữu cơ sở của đơn đặt sân này.",
        });
      }

      const currentStatus = bundle.booking.status;
      if (
        currentStatus === "expired" ||
        (currentStatus === "held" &&
          bundle.booking.expiresAt &&
          now >= bundle.booking.expiresAt)
      ) {
        throw new UnprocessableEntityException({
          code: "HOLD_EXPIRED",
          message: "Lượt giữ chỗ đã hết hạn.",
        });
      }

      if (
        ["completed", "cancelled", "no_show"].includes(currentStatus)
      ) {
        throw new BadRequestException({
          code: "INVALID_STATUS_TRANSITION",
          message: `Không thể huỷ đơn đặt sân đang ở trạng thái ${currentStatus}.`,
        });
      }

      if (user.role === "customer" && currentStatus !== "held") {
        const policy = await this.repo.getVenueCancellationPolicy(
          bundle.venue.id,
          tx,
        );
        const preview = evaluateCancellationPreview({
          bookingStatus: currentStatus,
          bookingStart: bundle.start,
          bookingExpiresAt: bundle.booking.expiresAt,
          depositAmount: bundle.booking.depositAmount,
          paymentStatus: bundle.payment?.status ?? null,
          paymentAmount: bundle.payment?.amount ?? null,
          policy,
          now,
        });

        if (!preview.canCancel) {
          throw new UnprocessableEntityException({
            code: "CANCELLATION_NOT_ALLOWED",
            message: `Theo chính sách của cơ sở, khách hàng chỉ được huỷ trước giờ bắt đầu tối thiểu ${policy.cancelBeforeHours} giờ.`,
          });
        }
      }

      const defaultReason =
        user.role === "customer"
          ? "Khách tự huỷ"
          : user.role === "owner"
            ? "Chủ sân huỷ"
            : "Quản trị viên huỷ";

      return this.repo.cancelBookingInTx(tx, {
        bundle,
        actorId: user.id,
        actorRole: user.role,
        reason: reasonInput ?? defaultReason,
        now,
      });
    });
  }

  /**
   * Nhả giữ chỗ chủ động (`DELETE /bookings/holds/:holdId`) -> HTTP 204 No Content.
   */
  async releaseHold(user: AuthenticatedUser, holdId: string): Promise<void> {
    const bookingId = this.parseUuid(holdId, "Mã giữ chỗ");

    await this.repo.transaction(async (tx) => {
      const now = await this.repo.now(tx);
      const bundle = await this.repo.findBookingBundleById(bookingId, tx, true);

      if (!bundle || bundle.booking.customerId !== user.id) {
        throw new NotFoundException({
          code: "NOT_FOUND",
          message: "Không tìm thấy lượt giữ chỗ.",
        });
      }

      if (bundle.booking.status === "cancelled") {
        return;
      }

      if (bundle.booking.status !== "held") {
        throw new BadRequestException({
          code: "INVALID_STATUS_TRANSITION",
          message: "Chỉ có thể nhả chỗ khi đơn đang ở trạng thái held.",
        });
      }

      await this.repo.cancelBookingInTx(tx, {
        bundle,
        actorId: user.id,
        actorRole: user.role,
        reason: "Khách chủ động nhả giữ chỗ",
        now,
      });
    });
  }

  /**
   * Xác nhận từ `held` -> `confirmed` (`POST /bookings/:id/confirm`).
   */
  async confirmBooking(
    user: AuthenticatedUser,
    id: string,
  ): Promise<BookingDetail> {
    const bookingId = this.parseUuid(id, "Mã đặt sân");

    await this.repo.expireStaleHoldsForCustomer(user.id);

    return this.repo.transaction(async (tx) => {
      const now = await this.repo.now(tx);
      const bundle = await this.repo.findBookingBundleById(bookingId, tx, true);

      if (!bundle || bundle.booking.customerId !== user.id) {
        throw new NotFoundException({
          code: "NOT_FOUND",
          message: "Không tìm thấy đơn đặt sân.",
        });
      }

      if (bundle.booking.status === "confirmed") {
        return this.repo.toBookingDetail(bundle);
      }

      if (
        bundle.booking.status === "expired" ||
        (bundle.booking.status === "held" &&
          bundle.booking.expiresAt &&
          now >= bundle.booking.expiresAt)
      ) {
        if (bundle.booking.status === "held") {
          await this.repo.expireStaleHoldsForCourt(
            tx,
            bundle.booking.courtId,
            now,
          );
        }
        throw new UnprocessableEntityException({
          code: "HOLD_EXPIRED",
          message: "Lượt giữ chỗ đã hết hạn, vui lòng đặt lại.",
        });
      }

      if (bundle.booking.status !== "held") {
        throw new BadRequestException({
          code: "INVALID_STATUS_TRANSITION",
          message: `Không thể xác nhận đơn đang ở trạng thái ${bundle.booking.status}.`,
        });
      }

      return this.repo.confirmHeldBookingInTx(tx, bundle, user.id, now);
    });
  }

  /**
   * 7. `PATCH /bookings/:id/no-show` — Chủ sân đánh dấu khách không đến nhận sân (OWN-09).
   */
  async markNoShow(
    user: AuthenticatedUser,
    id: string,
  ): Promise<BookingDetail> {
    const bookingId = this.parseUuid(id, "Mã đặt sân");

    return this.repo.transaction(async (tx) => {
      const now = await this.repo.now(tx);
      const bundle = await this.repo.findBookingBundleById(bookingId, tx, true);

      if (!bundle) {
        throw new NotFoundException({
          code: "NOT_FOUND",
          message: "Không tìm thấy đơn đặt sân.",
        });
      }

      if (user.role === "owner" && bundle.venue.ownerId !== user.id) {
        throw new ForbiddenException({
          code: "NOT_VENUE_OWNER",
          message: "Bạn không phải chủ sở hữu cơ sở của đơn đặt sân này.",
        });
      }

      if (bundle.booking.status === "no_show") {
        return this.repo.toBookingDetail(bundle);
      }

      if (bundle.booking.status !== "confirmed") {
        throw new BadRequestException({
          code: "INVALID_STATUS_TRANSITION",
          message:
            "Chỉ có thể đánh dấu không đến (no_show) đối với đơn đã xác nhận (confirmed).",
        });
      }

      if (now.getTime() < bundle.start.getTime()) {
        throw new UnprocessableEntityException({
          code: "INVALID_TIME_RANGE",
          message:
            "Chỉ có thể đánh dấu không đến (no_show) sau khi đã qua thời điểm bắt đầu giờ đặt sân.",
        });
      }

      return this.repo.markNoShowInTx(tx, bundle, user.id, now);
    });
  }
}
