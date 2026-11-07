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
import { BookingsRepository } from "./bookings.repository.js";
import {
  formatTsTzRange,
  formatVnIsoString,
  generateTransferCode,
  getVnDateTimeParts,
  isMultipleOf30Minutes,
  maskPhoneNumber,
  parseTsTzRange,
  parseVnDateTime,
  splitInto30MinBlocks,
} from "../../common/utils/time-range.js";
import type {
  AuthenticatedUser,
  BookingDetail,
  HoldBookingResponse,
  Slot,
  SlotGridResponse,
} from "../../../../../packages/shared/src/types.js";
import type {
  CancelBookingInput,
  CreateHoldInput,
  CreateManualBookingInput,
} from "../../../../../packages/shared/src/schemas.js";
import type { BookingStatus } from "../../../../../packages/shared/src/constants.js";

interface PricingRuleEntity {
  id: string;
  courtId: string;
  name: string;
  pricePerSlot: number;
  startTime: string;
  endTime: string;
  dayOfWeek: number[] | null;
  dateOverride: string | null;
  priority: number;
}

@Injectable()
export class BookingsService {
  constructor(private readonly repo: BookingsRepository) {}

  /**
   * Tính ma trận slots theo ngày cho một cơ sở thể thao (GET /venues/:id/slots?date=YYYY-MM-DD).
   */
  async getSlots(
    venueId: string,
    date: string,
    currentUserId?: string,
  ): Promise<SlotGridResponse> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Ngày phải theo định dạng YYYY-MM-DD.",
      });
    }

    const data = await this.repo.findVenueWithCourts(venueId);
    if (!data) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Cơ sở thể thao không tồn tại.",
      });
    }

    const { courts } = data;
    if (courts.length === 0) {
      return { date, courts: [] };
    }

    const courtIds = courts.map((c) => c.id);
    const dayStart = parseVnDateTime(date, "00:00:00");
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const weekday = getVnDateTimeParts(dayStart).dayOfWeek;
    const now = new Date();

    const [allOpeningHours, allPricingRules, allBlackouts, allBookings] =
      await Promise.all([
        this.repo.getOpeningHoursByVenueAndDay(courtIds, weekday),
        this.repo.getPricingRulesByCourts(courtIds),
        this.repo.getBlackoutsByCourtsAndRange(courtIds, dayStart, dayEnd),
        this.repo.getActiveBookingsByCourtsAndRange(courtIds, dayStart, dayEnd),
      ]);

    const courtSlots = courts.map((court) => {
      const hours = allOpeningHours.find((h) => h.courtId === court.id);
      if (!hours || hours.openTime >= hours.closeTime) {
        return {
          courtId: court.id,
          slots: [],
        };
      }

      const courtRules = allPricingRules.filter((r) => r.courtId === court.id);
      const courtBlackouts = allBlackouts
        .filter((b) => b.courtId === court.id)
        .map((b) => parseTsTzRange(b.during));
      const courtBookings = allBookings
        .filter((b) => b.courtId === court.id)
        .map((b) => ({
          ...b,
          range: parseTsTzRange(b.during),
        }));

      const courtStart = parseVnDateTime(date, hours.openTime);
      const courtEnd = parseVnDateTime(date, hours.closeTime);

      let blocks: Array<{ start: Date; end: Date }> = [];
      try {
        blocks = splitInto30MinBlocks(courtStart, courtEnd);
      } catch {
        blocks = [];
      }

      const slots: Slot[] = blocks.map((block) => {
        // Tìm matching pricing rule
        const matchedRule = this.findMatchingPricingRule(
          courtRules,
          block.start,
          block.end,
        );
        const price = matchedRule ? matchedRule.pricePerSlot : 0;

        let status: Slot["status"] = "available";
        let mine: boolean | undefined = undefined;

        if (block.end.getTime() <= now.getTime()) {
          status = "past";
        } else {
          // Kiểm tra blackout (bảo trì / khoá sân)
          const isBlocked = courtBlackouts.some(
            (bo) =>
              block.start.getTime() < bo.end.getTime() &&
              block.end.getTime() > bo.start.getTime(),
          );

          if (isBlocked) {
            status = "blocked";
          } else {
            // Kiểm tra bookings
            const overlapping = courtBookings.find(
              (b) =>
                block.start.getTime() < b.range.end.getTime() &&
                block.end.getTime() > b.range.start.getTime(),
            );

            if (overlapping) {
              if (
                overlapping.status === "confirmed" ||
                overlapping.status === "pending_payment"
              ) {
                status = "booked";
              } else if (overlapping.status === "held") {
                status = "held";
                const isMine =
                  Boolean(currentUserId) &&
                  overlapping.customerId === currentUserId;
                mine = isMine;
              }
            }
          }
        }

        return {
          start: formatVnIsoString(block.start),
          end: formatVnIsoString(block.end),
          status,
          price,
          ...(mine !== undefined ? { mine } : {}),
        };
      });

      return {
        courtId: court.id,
        slots,
      };
    });

    return {
      date,
      courts: courtSlots,
    };
  }

  /**
   * So khớp rule giá theo độ ưu tiên:
   * 1. date_override (ngày lễ cụ thể) - độ cụ thể 3
   * 2. day_of_week + khung giờ - độ cụ thể 2
   * 3. Rule chung - độ cụ thể 1
   * Trong cùng mức độ cụ thể, priority cao hơn thắng.
   */
  findMatchingPricingRule(
    rules: PricingRuleEntity[],
    blockStart: Date,
    blockEnd: Date,
  ): PricingRuleEntity | null {
    const startParts = getVnDateTimeParts(blockStart);
    const endParts = getVnDateTimeParts(blockEnd);
    const dateStr = startParts.dateStr;
    const weekday = startParts.dayOfWeek;
    const startSlotTime = startParts.timeStr;
    const endSlotTime = endParts.timeStr;

    const normalizeTime = (t: string) => (t.length === 5 ? `${t}:00` : t);

    const candidates = rules.filter((rule) => {
      const ruleStart = normalizeTime(rule.startTime);
      const ruleEnd = normalizeTime(rule.endTime);
      // Khung giờ slot phải nằm trong khung của rule
      if (startSlotTime < ruleStart || endSlotTime > ruleEnd) {
        return false;
      }

      // 1. date_override
      if (rule.dateOverride) {
        return rule.dateOverride === dateStr;
      }

      // 2. day_of_week
      if (rule.dayOfWeek && rule.dayOfWeek.length > 0) {
        return rule.dayOfWeek.includes(weekday);
      }

      // 3. Rule chung
      return true;
    });

    if (candidates.length === 0) return null;

    const specificity = (r: PricingRuleEntity) => {
      if (r.dateOverride) return 3;
      if (r.dayOfWeek && r.dayOfWeek.length > 0) return 2;
      return 1;
    };

    candidates.sort((a, b) => {
      const specDiff = specificity(b) - specificity(a);
      if (specDiff !== 0) return specDiff;
      return b.priority - a.priority;
    });

    return candidates[0] ?? null;
  }

  /**
   * Tính tổng giá cho danh sách các block 30 phút. Ném lỗi PRICING_RULE_NOT_FOUND nếu thiếu rule.
   */
  calculateBlocksPrice(
    courtId: string,
    blocks: Array<{ start: Date; end: Date }>,
    rules: PricingRuleEntity[],
  ): number {
    let total = 0;
    for (const block of blocks) {
      const rule = this.findMatchingPricingRule(rules, block.start, block.end);
      if (!rule) {
        throw new BadRequestException({
          code: "PRICING_RULE_NOT_FOUND",
          message: `Sân chưa có quy tắc giá cho khung giờ ${formatVnIsoString(block.start)}.`,
        });
      }
      total += rule.pricePerSlot;
    }
    return total;
  }

  /**
   * Tạo hold slot (POST /api/v1/bookings/hold).
   */
  async createHold(
    customerId: string,
    input: CreateHoldInput,
  ): Promise<HoldBookingResponse> {
    if (!input.slots || input.slots.length === 0) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Vui lòng chọn ít nhất một khung giờ.",
      });
    }

    // 1. Chuẩn hoá và sắp xếp các slot
    const sortedSlots = [...input.slots].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
    );

    const blocks: Array<{ start: Date; end: Date }> = [];
    for (let i = 0; i < sortedSlots.length; i++) {
      const slot = sortedSlots[i];
      if (!slot) continue;
      const s = new Date(slot.start);
      const e = new Date(slot.end);
      if (isNaN(s.getTime()) || isNaN(e.getTime())) {
        throw new BadRequestException({
          code: "VALIDATION_ERROR",
          message: "Thời gian slot không hợp lệ.",
        });
      }
      if (!isMultipleOf30Minutes(s) || !isMultipleOf30Minutes(e)) {
        throw new BadRequestException({
          code: "INVALID_TIME_RANGE",
          message: "Khung giờ phải là bội số của 30 phút (:00 hoặc :30).",
        });
      }
      if (e.getTime() - s.getTime() !== 30 * 60 * 1000) {
        throw new BadRequestException({
          code: "INVALID_TIME_RANGE",
          message: "Mỗi block phải có độ dài đúng 30 phút.",
        });
      }
      if (i > 0) {
        const prev = blocks[i - 1];
        if (!prev || s.getTime() !== prev.end.getTime()) {
          throw new BadRequestException({
            code: "VALIDATION_ERROR",
            message: "Các khung giờ đặt phải liên tiếp nhau.",
          });
        }
      }
      blocks.push({ start: s, end: e });
    }

    const firstBlock = blocks[0];
    const lastBlock = blocks[blocks.length - 1];
    if (!firstBlock || !lastBlock) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Vui lòng chọn ít nhất một khung giờ.",
      });
    }

    const overallStart = firstBlock.start;
    const overallEnd = lastBlock.end;
    const now = new Date();

    if (overallStart.getTime() <= now.getTime()) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Không thể đặt sân trong quá khứ.",
      });
    }

    // 2. Kiểm tra sân và cơ sở
    const courtData = await this.repo.findCourtWithVenue(input.courtId);
    if (!courtData || courtData.court.status !== "active") {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Sân con không tồn tại hoặc đã ngừng hoạt động.",
      });
    }

    if (courtData.venue.status !== "approved") {
      throw new BadRequestException({
        code: "FORBIDDEN",
        message: "Cơ sở thể thao chưa được duyệt hoặc đã ngừng hoạt động.",
      });
    }

    // 3. Khung giờ đặt phải nằm trong giờ mở cửa của sân
    await this.assertWithinOpeningHours(input.courtId, blocks);

    // 4. Kiểm tra tài khoản nhận tiền của Venue (PAYMENT_ACCOUNT_MISSING - 422)
    const bankAccount = await this.repo.getVenuePaymentAccount(
      courtData.venue.id,
    );
    if (!bankAccount) {
      throw new UnprocessableEntityException({
        code: "PAYMENT_ACCOUNT_MISSING",
        message:
          "Cơ sở chưa cấu hình tài khoản nhận tiền nên chưa thể đặt sân.",
      });
    }

    // 5. Chống lạm dụng giữ chỗ (Hold Abuse - docs/06)
    const holdLimit = parseInt(process.env.HOLD_LIMIT || "3", 10);
    const activeHolds = await this.repo.countActiveHolds(customerId);
    if (activeHolds >= holdLimit) {
      throw new UnprocessableEntityException({
        code: "HOLD_LIMIT_EXCEEDED",
        message: `Bạn đang có tối đa ${holdLimit} lượt giữ chỗ chưa thanh toán. Vui lòng hoàn tất hoặc chờ hết hạn.`,
      });
    }

    const holdRateLimitPerHour = parseInt(
      process.env.HOLD_RATE_LIMIT_PER_HOUR || "5",
      10,
    );
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentHoldsOnCourt = await this.repo.countRecentHoldsOnCourt(
      customerId,
      input.courtId,
      oneHourAgo,
    );
    if (recentHoldsOnCourt >= holdRateLimitPerHour) {
      throw new HttpException(
        {
          code: "HOLD_RATE_LIMITED",
          message: `Bạn đã thao tác giữ chỗ sân này quá ${holdRateLimitPerHour} lần trong 1 giờ. Vui lòng thử lại sau.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const buildResponse = (
      booking: any,
      payment: { id: string; amount: number; transferCode?: string | null },
    ): HoldBookingResponse => ({
      booking: this.mapBooking(booking),
      payment: {
        id: payment.id,
        amount: payment.amount,
        transferCode: payment.transferCode || "",
        bankAccount: {
          bankBin: bankAccount.bankBin,
          accountNo: bankAccount.accountNo,
          accountName: bankAccount.accountName,
        },
      },
    });

    const writeHold = async (db?: any) => {
      // 5 + 6 + 9 chạy cùng một transaction và cùng một khoá theo sân.
      await this.repo.expireCourtHolds(input.courtId, db);

      const existingHold = await this.repo.findActiveHoldByIdempotency(
        customerId,
        input.courtId,
        overallStart,
        overallEnd,
        input.idempotencyKey,
        db,
      );

      if (existingHold) {
        return { existing: true as const, ...existingHold };
      }

      const courtRules = await this.repo.getPricingRulesByCourts(
        [input.courtId],
        db,
      );
      const totalPrice = this.calculateBlocksPrice(
        input.courtId,
        blocks,
        courtRules,
      );

      const policy = await this.repo.getCancellationPolicy(
        courtData.venue.id,
        db,
      );
      const depositPercent = policy?.depositPercent ?? 100;
      const depositAmount = Math.round((totalPrice * depositPercent) / 100);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      const transferCode = generateTransferCode();

      const created = await this.repo.createHoldBooking(
        {
          courtId: input.courtId,
          customerId,
          start: overallStart,
          end: overallEnd,
          totalPrice,
          depositAmount,
          expiresAt,
          note: input.note,
          transferCode,
          idempotencyKey: input.idempotencyKey,
        },
        db,
      );

      return { existing: false as const, ...created };
    };

    try {
      const result = this.repo.runInTransaction
        ? await this.repo.runInTransaction(async (tx) => {
            if (this.repo.lockCourtForBooking) {
              await this.repo.lockCourtForBooking(input.courtId, tx);
            }
            return writeHold(tx);
          })
        : await writeHold();

      return buildResponse(result.booking, result.payment);
    } catch (err: any) {
      // Bắt lỗi vi phạm EXCLUDE constraint hoặc trigger blackout (mã lỗi 23P01)
      if (
        err?.code === "23P01" ||
        err?.message?.includes("excl_bookings_overlap") ||
        err?.message?.includes("COURT_BLACKED_OUT")
      ) {
        throw new ConflictException({
          code: "BOOKING_CONFLICT",
          message:
            "Khung giờ này vừa được giữ hoặc đặt bởi người khác. Vui lòng chọn khung giờ khác.",
        });
      }
      throw err;
    }
  }

  /**
   * Danh sách lịch sử booking của khách hàng (GET /api/v1/bookings).
   */
  async getCustomerBookings(
    customerId: string,
    query: { status?: BookingStatus; page: number; limit: number },
  ) {
    const result = await this.repo.findBookingsByCustomer(customerId, query);
    return {
      data: result.items.map((row) => ({
        ...this.mapBooking(row.booking),
        court: {
          id: row.court.id,
          name: row.court.name,
          venue: {
            id: row.venue.id,
            name: row.venue.name,
            slug: row.venue.slug,
            address: row.venue.address,
          },
        },
        payment: row.payment
          ? {
              id: row.payment.id,
              amount: row.payment.amount,
              provider: row.payment.provider,
              status: row.payment.status,
              transferCode: row.payment.transferCode,
              paidAt: row.payment.paidAt?.toISOString() ?? null,
            }
          : null,
      })),
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  /**
   * Xem chi tiết booking (GET /api/v1/bookings/:id).
   */
  async getBookingDetails(
    id: string,
    user: AuthenticatedUser,
  ): Promise<BookingDetail> {
    const row = await this.repo.findBookingById(id);
    if (!row) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Không tìm thấy thông tin đơn đặt sân.",
      });
    }

    // Phân quyền xem:
    // - Customer chỉ xem được booking của mình
    // - Owner chỉ xem được booking tại venue mình sở hữu
    // - Admin xem được tất cả
    if (user.role === "customer" && row.booking.customerId !== user.id) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Bạn không có quyền xem đơn đặt sân này.",
      });
    }

    if (user.role === "owner" && row.venue.ownerId !== user.id) {
      throw new ForbiddenException({
        code: "NOT_VENUE_OWNER",
        message: "Bạn không phải chủ cơ sở của đơn đặt sân này.",
      });
    }

    const { start, end } = parseTsTzRange(row.booking.during);

    return {
      ...this.mapBooking(row.booking),
      court: {
        id: row.court.id,
        name: row.court.name,
        venue: {
          id: row.venue.id,
          name: row.venue.name,
          slug: row.venue.slug,
          address: row.venue.address,
        },
      },
      customer: row.customer
        ? {
            id: row.customer.id,
            fullName: row.customer.fullName,
            phone: maskPhoneNumber(row.customer.phone),
            email: row.customer.email,
          }
        : null,
      payment: row.payment
        ? {
            id: row.payment.id,
            amount: row.payment.amount,
            provider: row.payment.provider as any,
            transferCode: row.payment.transferCode,
            proofUrl: row.payment.proofUrl,
            proofUploadedAt:
              row.payment.proofUploadedAt?.toISOString() ?? null,
            status: row.payment.status as any,
            paidAt: row.payment.paidAt?.toISOString() ?? null,
            reviewedBy: row.payment.reviewedBy,
            rejectReason: row.payment.rejectReason,
            refundAmount: row.payment.refundAmount,
          }
        : null,
      review: null,
    };
  }

  /**
   * Xem trước điều kiện huỷ và số tiền hoàn (GET /api/v1/bookings/:id/cancellation-preview).
   */
  async previewCancellation(id: string, user: AuthenticatedUser) {
    const row = await this.repo.findBookingById(id);
    if (!row) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Không tìm thấy đơn đặt sân.",
      });
    }

    if (user.role === "customer" && row.booking.customerId !== user.id) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Bạn không có quyền thao tác trên đơn này.",
      });
    }

    if (user.role === "owner" && row.venue.ownerId !== user.id) {
      throw new ForbiddenException({
        code: "NOT_VENUE_OWNER",
        message: "Bạn không phải chủ cơ sở của đơn đặt sân này.",
      });
    }

    const status = row.booking.status;
    if (["completed", "cancelled", "expired", "no_show"].includes(status)) {
      return {
        canCancel: false,
        reason: `Booking ở trạng thái ${status} không thể huỷ.`,
        refundPercent: 0,
        refundAmount: 0,
        cancelBeforeHours: 0,
        hoursUntilStart: 0,
      };
    }

    // Nếu đang held hoặc pending_payment -> chưa thanh toán thành công, huỷ không hoàn tiền
    if (status === "held" || status === "pending_payment") {
      return {
        canCancel: true,
        reason: "Đơn chưa thanh toán hoặc đang chờ duyệt, có thể huỷ miễn phí.",
        refundPercent: 0,
        refundAmount: 0,
        cancelBeforeHours: 0,
        hoursUntilStart: 0,
      };
    }

    // Trường hợp confirmed: xét chính sách huỷ
    const policy = await this.repo.getCancellationPolicy(row.venue.id);
    const cancelBeforeHours = policy?.cancelBeforeHours ?? 24;
    const refundPercent = policy?.refundPercent ?? 100;

    const { start } = parseTsTzRange(row.booking.during);
    const now = Date.now();
    const hoursUntilStart = (start.getTime() - now) / (1000 * 60 * 60);

    const canCancel = hoursUntilStart >= cancelBeforeHours;
    const refundAmount = canCancel
      ? Math.round((row.booking.depositAmount * refundPercent) / 100)
      : 0;

    return {
      canCancel,
      cancelBeforeHours,
      hoursUntilStart: Math.max(0, Math.round(hoursUntilStart * 10) / 10),
      refundPercent: canCancel ? refundPercent : 0,
      refundAmount,
      policyNotice: canCancel
        ? `Được hoàn ${refundPercent}% số tiền cọc khi huỷ trước ${cancelBeforeHours} giờ.`
        : `Không được hoàn tiền do thời gian đến giờ chơi còn ít hơn ${cancelBeforeHours} giờ.`,
    };
  }

  /**
   * Huỷ booking (PATCH /api/v1/bookings/:id/cancel).
   */
  async cancelBooking(
    id: string,
    user: AuthenticatedUser,
    input: CancelBookingInput,
  ) {
    const row = await this.repo.findBookingById(id);
    if (!row) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Không tìm thấy đơn đặt sân.",
      });
    }

    const isCustomer = user.role === "customer";
    const isOwner = user.role === "owner";

    if (isCustomer && row.booking.customerId !== user.id) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Bạn không có quyền huỷ đơn này.",
      });
    }

    if (isOwner && row.venue.ownerId !== user.id) {
      throw new ForbiddenException({
        code: "NOT_VENUE_OWNER",
        message: "Bạn không phải chủ cơ sở của đơn đặt sân này.",
      });
    }

    const status = row.booking.status;

    if (["completed", "cancelled", "expired", "no_show"].includes(status)) {
      throw new BadRequestException({
        code: "INVALID_STATUS_TRANSITION",
        message: `Không thể huỷ đơn đặt sân ở trạng thái hiện tại (${status}).`,
      });
    }

    // Huỷ đơn khi đang held hoặc pending_payment
    if (status === "held" || status === "pending_payment") {
      const result = await this.repo.cancelBookingTx(
        id,
        user.id,
        input.reason ?? "Người dùng huỷ giữ chỗ",
        "cancelled",
        null,
        status,
      );
      if (!result.booking || (result as { conflict?: boolean }).conflict) {
        throw new ConflictException({
          code: "INVALID_STATUS_TRANSITION",
          message: "Đơn đặt sân vừa đổi trạng thái. Vui lòng tải lại.",
        });
      }
      return this.mapBooking(result.booking);
    }

    // Huỷ đơn khi đã confirmed
    if (status === "confirmed") {
      const policy = await this.repo.getCancellationPolicy(row.venue.id);
      const cancelBeforeHours = policy?.cancelBeforeHours ?? 24;
      const refundPercent = policy?.refundPercent ?? 100;

      const { start } = parseTsTzRange(row.booking.during);
      const hoursUntilStart = (start.getTime() - Date.now()) / (1000 * 60 * 60);
      const withinPolicy = hoursUntilStart >= cancelBeforeHours;

      // Khách huỷ sát giờ -> từ chối. Chủ sân vẫn huỷ được nhưng không hoàn tiền
      // nếu đã quá mốc chính sách (không tự hoàn 100% ngoài chính sách).
      if (isCustomer && !withinPolicy) {
        throw new UnprocessableEntityException({
          code: "CANCELLATION_NOT_ALLOWED",
          message: `Booking không còn được huỷ theo chính sách huỷ của cơ sở (phải huỷ trước ít nhất ${cancelBeforeHours} giờ).`,
        });
      }

      const refundAmount = withinPolicy
        ? Math.round((row.booking.depositAmount * refundPercent) / 100)
        : 0;
      const result = await this.repo.cancelBookingTx(
        id,
        user.id,
        input.reason ?? "Huỷ booking đã xác nhận",
        refundAmount > 0 ? "refunded" : "cancelled",
        refundAmount > 0 ? refundAmount : null,
        "confirmed",
      );

      if (!result.booking || (result as { conflict?: boolean }).conflict) {
        throw new ConflictException({
          code: "INVALID_STATUS_TRANSITION",
          message: "Đơn đặt sân vừa đổi trạng thái. Vui lòng tải lại.",
        });
      }

      return this.mapBooking(result.booking);
    }

    throw new BadRequestException({
      code: "INVALID_STATUS_TRANSITION",
      message: "Chuyển trạng thái không hợp lệ.",
    });
  }

  /**
   * Danh sách booking dành cho Owner (GET /api/v1/owner/bookings).
   */
  async getOwnerBookings(
    ownerId: string,
    query: {
      venueId?: string;
      courtId?: string;
      status?: BookingStatus;
      from?: string;
      to?: string;
      page: number;
      limit: number;
    },
  ) {
    const result = await this.repo.findBookingsByOwner(ownerId, query);
    return {
      data: result.items.map((row) => ({
        ...this.mapBooking(row.booking),
        court: {
          id: row.court.id,
          name: row.court.name,
          venue: {
            id: row.venue.id,
            name: row.venue.name,
            slug: row.venue.slug,
          },
        },
        customer: row.customer
          ? {
              id: row.customer.id,
              fullName: row.customer.fullName,
              phone: maskPhoneNumber(row.customer.phone),
            }
          : null,
        payment: row.payment
          ? {
              id: row.payment.id,
              amount: row.payment.amount,
              provider: row.payment.provider,
              status: row.payment.status,
            }
          : null,
      })),
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  /**
   * Đặt sân thủ công tại quầy cho Owner (POST /api/v1/owner/bookings/manual).
   */
  async createManualBooking(
    ownerId: string,
    input: CreateManualBookingInput,
  ) {
    const courtData = await this.repo.findCourtWithVenue(input.courtId);
    if (!courtData || courtData.court.status !== "active") {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Sân con không tồn tại.",
      });
    }

    if (courtData.venue.ownerId !== ownerId) {
      throw new ForbiddenException({
        code: "NOT_VENUE_OWNER",
        message: "Bạn không phải chủ cơ sở của sân này.",
      });
    }

    if (!input.slots || input.slots.length === 0) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Vui lòng chọn ít nhất một khung giờ.",
      });
    }

    const sortedSlots = [...input.slots].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
    );

    const blocks: Array<{ start: Date; end: Date }> = [];
    for (let i = 0; i < sortedSlots.length; i++) {
      const slot = sortedSlots[i];
      if (!slot) continue;
      const s = new Date(slot.start);
      const e = new Date(slot.end);
      if (!isMultipleOf30Minutes(s) || !isMultipleOf30Minutes(e)) {
        throw new BadRequestException({
          code: "INVALID_TIME_RANGE",
          message: "Khung giờ phải là bội số của 30 phút.",
        });
      }
      if (e.getTime() - s.getTime() !== 30 * 60 * 1000) {
        throw new BadRequestException({
          code: "INVALID_TIME_RANGE",
          message: "Mỗi block phải có độ dài đúng 30 phút.",
        });
      }
      if (i > 0) {
        const prev = blocks[i - 1];
        if (!prev || s.getTime() !== prev.end.getTime()) {
          throw new BadRequestException({
            code: "VALIDATION_ERROR",
            message: "Các khung giờ đặt phải liên tiếp nhau.",
          });
        }
      }
      blocks.push({ start: s, end: e });
    }

    const firstBlock = blocks[0];
    const lastBlock = blocks[blocks.length - 1];
    if (!firstBlock || !lastBlock) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Vui lòng chọn ít nhất một khung giờ.",
      });
    }

    const overallStart = firstBlock.start;
    const overallEnd = lastBlock.end;

    await this.assertWithinOpeningHours(input.courtId, blocks);

    // Tính giá
    const courtRules = await this.repo.getPricingRulesByCourts([input.courtId]);
    const totalPrice = this.calculateBlocksPrice(
      input.courtId,
      blocks,
      courtRules,
    );

    try {
      const { booking, payment } = await this.repo.createManualBooking({
        courtId: input.courtId,
        start: overallStart,
        end: overallEnd,
        totalPrice,
        guestName: input.guestName,
        guestPhone: input.guestPhone,
        createdBy: ownerId,
        note: input.note,
      });

      return {
        booking: this.mapBooking(booking),
        payment: {
          id: payment.id,
          amount: payment.amount,
          provider: payment.provider,
          status: payment.status,
        },
      };
    } catch (err: any) {
      if (
        err?.code === "23P01" ||
        err?.message?.includes("excl_bookings_overlap") ||
        err?.message?.includes("COURT_BLACKED_OUT")
      ) {
        throw new ConflictException({
          code: "BOOKING_CONFLICT",
          message: "Khung giờ này đã có người đặt hoặc đang bị khoá.",
        });
      }
      throw err;
    }
  }

  /**
   * Đánh dấu khách không đến (PATCH /api/v1/bookings/:id/no-show).
   */
  async markNoShow(id: string, ownerId: string) {
    const row = await this.repo.findBookingById(id);
    if (!row) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Không tìm thấy đơn đặt sân.",
      });
    }

    if (row.venue.ownerId !== ownerId) {
      throw new ForbiddenException({
        code: "NOT_VENUE_OWNER",
        message: "Bạn không phải chủ cơ sở của đơn đặt sân này.",
      });
    }

    if (row.booking.status !== "confirmed") {
      throw new BadRequestException({
        code: "INVALID_STATUS_TRANSITION",
        message: "Chỉ có thể đánh dấu vắng mặt cho booking đã xác nhận (confirmed).",
      });
    }

    const { start } = parseTsTzRange(row.booking.during);
    if (Date.now() < start.getTime()) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Chưa tới giờ thi đấu, không thể đánh dấu vắng mặt.",
      });
    }

    const updated = await this.repo.markNoShow(id);
    return this.mapBooking(updated!);
  }

  /**
   * Kiểm tra các block đặt sân nằm trong giờ mở cửa của sân.
   * - Không có dòng `opening_hours` cho thứ đó ⇒ sân đóng cửa ngày hôm đó.
   * - Chỉ gọi sau khi đã xác thực sân tồn tại và đang hoạt động.
   * - Giờ mở cửa được nạp 1 lần cho mỗi thứ (tránh N+1 query theo từng block).
   */
  private async assertWithinOpeningHours(
    courtId: string,
    blocks: Array<{ start: Date; end: Date }>,
  ): Promise<void> {
    if (blocks.length === 0) return;

    const normalizeTime = (t: string) => (t.length === 5 ? `${t}:00` : t);

    // Gom block theo thứ trong tuần để giảm số lần truy vấn.
    const blocksByDay = new Map<number, Array<{ start: Date; end: Date }>>();
    for (const block of blocks) {
      const dayOfWeek = getVnDateTimeParts(block.start).dayOfWeek;
      const group = blocksByDay.get(dayOfWeek);
      if (group) group.push(block);
      else blocksByDay.set(dayOfWeek, [block]);
    }

    for (const [dayOfWeek, dayBlocks] of blocksByDay) {
      const hoursList = await this.repo.getOpeningHoursByVenueAndDay(
        [courtId],
        dayOfWeek,
      );
      const hours = hoursList.find((h) => h.courtId === courtId);
      const openTime = hours ? normalizeTime(hours.openTime) : "";
      const closeTime = hours ? normalizeTime(hours.closeTime) : "";

      if (!hours || openTime >= closeTime) {
        const dateStr = getVnDateTimeParts(dayBlocks[0]!.start).dateStr;
        throw new BadRequestException({
          code: "VALIDATION_ERROR",
          message: `Sân không mở cửa vào ngày ${dateStr}.`,
        });
      }

      for (const block of dayBlocks) {
        const startParts = getVnDateTimeParts(block.start);
        const endParts = getVnDateTimeParts(block.end);
        // Block kết thúc ở ngày kế tiếp ⇒ coi mốc kết thúc là cuối ngày.
        const endTimeStr =
          endParts.dateStr === startParts.dateStr ? endParts.timeStr : "24:00:00";

        if (startParts.timeStr < openTime || endTimeStr > closeTime) {
          throw new BadRequestException({
            code: "VALIDATION_ERROR",
            message: `Khung giờ đặt ${startParts.timeStr.slice(0, 5)} - ${endParts.timeStr.slice(0, 5)} nằm ngoài giờ mở cửa của sân (${openTime.slice(0, 5)} - ${closeTime.slice(0, 5)}).`,
          });
        }
      }
    }
  }

  /**
   * Map entity booking sang kiểu Booking chuẩn hoá.
   */
  private mapBooking(b: any) {
    const { start, end } = parseTsTzRange(b.during);
    return {
      id: b.id,
      courtId: b.courtId,
      customerId: b.customerId,
      source: b.source,
      guestName: b.guestName,
      guestPhone: b.guestPhone,
      during: {
        start: formatVnIsoString(start),
        end: formatVnIsoString(end),
      },
      status: b.status,
      totalPrice: b.totalPrice,
      depositAmount: b.depositAmount,
      note: b.note,
      expiresAt: b.expiresAt ? b.expiresAt.toISOString() : null,
      cancelledAt: b.cancelledAt ? b.cancelledAt.toISOString() : null,
      cancelReason: b.cancelReason,
      createdAt: b.createdAt.toISOString(),
    };
  }
}
