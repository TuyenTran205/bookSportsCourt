import {
  BadRequestException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import type {
  BookingStatus,
  PaymentStatus,
  SlotStatus,
} from "../../../../../packages/shared/src/constants.js";
import type { Slot } from "../../../../../packages/shared/src/types.js";

export const SLOT_MINUTES = 30;
export const SLOT_MS = SLOT_MINUTES * 60 * 1000; // 1_800_000 ms
export const DEFAULT_HOLD_TTL_MINUTES = 10;
export const HOLD_LIMIT = 3;
export const HOLD_RATE_LIMIT_PER_HOUR = 5;
export const MAX_BLOCKS_PER_HOLD = 8; // Tối đa 4 giờ (8 block 30 phút)
export const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
export const VN_OFFSET_STR = "+07:00";

const TRANSFER_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const uuidSchema = z.string().uuid();
const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;

export interface NormalizedHoldInput {
  courtId: string;
  start: Date;
  end: Date;
  blocks: number;
  idempotencyKey: string | null;
  note: string | null;
}

export interface TimeBlock {
  start: Date;
  end: Date;
  dateStr: string;
  weekday: number;
  startMinutes: number;
  endMinutes: number;
}

export interface OpeningHourRule {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
}

export interface PricingRuleRow {
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

export interface CancellationPolicyRule {
  cancelBeforeHours: number;
  refundPercent: number;
  depositPercent: number;
}

export const DEFAULT_CANCELLATION_POLICY: CancellationPolicyRule = {
  cancelBeforeHours: 24,
  refundPercent: 100,
  depositPercent: 100,
};

/** Kiểm tra chuỗi ngày `YYYY-MM-DD` hợp lệ theo lịch thực tế. */
export function isValidDateString(dateStr: string): boolean {
  if (!dateOnlyRegex.test(dateStr)) return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/** Thứ trong tuần (0 = Chủ nhật .. 6 = Thứ bảy) của ngày `YYYY-MM-DD`. */
export function weekdayOfDateString(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}

/** Cộng thêm số ngày vào chuỗi `YYYY-MM-DD`. */
export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + days));
  return dt.toISOString().slice(0, 10);
}

/**
 * Chuyển ngày `YYYY-MM-DD` và số phút tính từ 00:00 sang ISO 8601 có offset `+07:00`.
 * Nếu `minutesFromMidnight === 1440` (24:00), trả về `00:00:00+07:00` của ngày kế tiếp.
 */
export function toVnIso(dateStr: string, minutesFromMidnight: number): string {
  const dayShift = Math.floor(minutesFromMidnight / 1440);
  const normalizedMinutes = ((minutesFromMidnight % 1440) + 1440) % 1440;
  const targetDate =
    dayShift === 0 ? dateStr : addDaysToDateString(dateStr, dayShift);
  const hours = Math.floor(normalizedMinutes / 60);
  const minutes = normalizedMinutes % 60;
  return `${targetDate}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00${VN_OFFSET_STR}`;
}

/** Định dạng `Date` bất kỳ sang chuỗi ISO 8601 múi giờ `+07:00`. */
export function formatDateToVnIso(date: Date): string {
  const vnTime = new Date(date.getTime() + VN_OFFSET_MS);
  const iso = vnTime.toISOString(); // YYYY-MM-DDTHH:mm:ss.sssZ
  return `${iso.slice(0, 19)}${VN_OFFSET_STR}`;
}

/** Tách thông tin ngày/thứ/phút theo múi giờ Việt Nam (`Asia/Ho_Chi_Minh`). */
export function toVnDateParts(date: Date): {
  dateStr: string;
  weekday: number;
  minutesOfDay: number;
  timeStr: string;
} {
  const vnTime = new Date(date.getTime() + VN_OFFSET_MS);
  const dateStr = vnTime.toISOString().slice(0, 10);
  const weekday = vnTime.getUTCDay();
  const hours = vnTime.getUTCHours();
  const minutes = vnTime.getUTCMinutes();
  const minutesOfDay = hours * 60 + minutes;
  const timeStr = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  return { dateStr, weekday, minutesOfDay, timeStr };
}

/** Chuyển `"HH:mm"` hoặc `"HH:mm:ss"` thành tổng số phút tính từ 00:00. */
export function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.trim().split(":");
  const h = Number(parts[0] ?? 0);
  const m = Number(parts[1] ?? 0);
  if (h === 24 && m === 0) return 1440;
  return h * 60 + m;
}

/** Kiểm tra một mốc `Date` có nằm đúng lưới 30 phút (`:00:00.000` hoặc `:30:00.000`) hay không. */
export function isAlignedTo30MinGrid(date: Date): boolean {
  const ms = date.getTime();
  return Number.isFinite(ms) && ms % SLOT_MS === 0;
}

/** Chuyển khoảng `[start, end)` sang chuỗi literal `tstzrange` của PostgreSQL. */
export function toPgTstzRange(start: Date, end: Date): string {
  return `[${start.toISOString()},${end.toISOString()})`;
}

/** Mask số điện thoại cho thông tin khách hàng (`0912***456`). */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (trimmed.length <= 6) return "***";
  return `${trimmed.slice(0, 4)}***${trimmed.slice(-3)}`;
}

/** Sinh mã nội dung chuyển khoản `BSC-XXXXXX`. */
export function generateTransferCode(): string {
  const bytes = randomBytes(6);
  let code = "BSC-";
  for (let i = 0; i < 6; i++) {
    code += TRANSFER_ALPHABET[bytes[i]! % TRANSFER_ALPHABET.length];
  }
  return code;
}

function parseIsoTimestamp(raw: unknown, fieldName: string): Date {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new BadRequestException({
      code: "VALIDATION_ERROR",
      message: `Trường ${fieldName} phải là chuỗi thời gian ISO 8601 hợp lệ.`,
    });
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException({
      code: "VALIDATION_ERROR",
      message: `Trường ${fieldName} không đúng định dạng ISO 8601.`,
    });
  }
  return parsed;
}

/**
 * Chuẩn hóa và kiểm tra đầu vào cho `POST /bookings/hold`.
 * Hỗ trợ 3 dạng payload:
 * 1. Contract chuẩn: `{ courtId, start, end, note?, idempotencyKey? }`
 * 2. Frontend hiện tại: `{ courtId, slots: [{ start, end }, ...], idempotencyKey?, note? }`
 * 3. Dạng theo số block: `{ courtId, startAt, blocks, note?, idempotencyKey? }`
 */
export function parseHoldInput(
  body: unknown,
  headerIdempotencyKey?: string,
): NormalizedHoldInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new BadRequestException({
      code: "VALIDATION_ERROR",
      message: "Dữ liệu yêu cầu giữ chỗ không hợp lệ.",
    });
  }

  const record = body as Record<string, unknown>;
  const courtIdResult = uuidSchema.safeParse(record.courtId);
  if (!courtIdResult.success) {
    throw new BadRequestException({
      code: "VALIDATION_ERROR",
      message: "Mã sân con (courtId) không hợp lệ.",
    });
  }
  const courtId = courtIdResult.data;

  let start: Date;
  let end: Date;

  if (Array.isArray(record.slots)) {
    if (record.slots.length === 0) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Danh sách khung giờ (slots) không được để trống.",
      });
    }
    const parsedSlots = record.slots.map((item, idx) => {
      if (!item || typeof item !== "object") {
        throw new BadRequestException({
          code: "VALIDATION_ERROR",
          message: `Phần tử slot thứ ${idx + 1} không hợp lệ.`,
        });
      }
      const slotObj = item as Record<string, unknown>;
      const s = parseIsoTimestamp(slotObj.start, `slots[${idx}].start`);
      const e = parseIsoTimestamp(slotObj.end, `slots[${idx}].end`);
      if (!isAlignedTo30MinGrid(s) || !isAlignedTo30MinGrid(e) || s >= e) {
        throw new BadRequestException({
          code: "INVALID_TIME_RANGE",
          message:
            "Mỗi khung giờ phải bắt đầu và kết thúc ở mốc bội số 30 phút (:00 hoặc :30).",
        });
      }
      return { start: s, end: e };
    });

    parsedSlots.sort((a, b) => a.start.getTime() - b.start.getTime());
    for (let i = 1; i < parsedSlots.length; i++) {
      if (parsedSlots[i]!.start.getTime() !== parsedSlots[i - 1]!.end.getTime()) {
        throw new BadRequestException({
          code: "INVALID_TIME_RANGE",
          message:
            "Các khung giờ được chọn trong một lượt giữ chỗ phải liên tiếp nhau.",
        });
      }
    }

    start = parsedSlots[0]!.start;
    end = parsedSlots[parsedSlots.length - 1]!.end;
  } else if (record.startAt !== undefined && record.blocks !== undefined) {
    start = parseIsoTimestamp(record.startAt, "startAt");
    const blocksNum = Number(record.blocks);
    if (
      !Number.isInteger(blocksNum) ||
      blocksNum < 1 ||
      blocksNum > MAX_BLOCKS_PER_HOLD
    ) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: `Số lượng block (blocks) phải là số nguyên từ 1 đến ${MAX_BLOCKS_PER_HOLD}.`,
      });
    }
    end = new Date(start.getTime() + blocksNum * SLOT_MS);
  } else if (record.start !== undefined && record.end !== undefined) {
    start = parseIsoTimestamp(record.start, "start");
    end = parseIsoTimestamp(record.end, "end");
  } else {
    throw new BadRequestException({
      code: "VALIDATION_ERROR",
      message:
        "Thiếu thông tin thời gian đặt sân (cần truyền start/end, slots, hoặc startAt/blocks).",
    });
  }

  if (!isAlignedTo30MinGrid(start) || !isAlignedTo30MinGrid(end)) {
    throw new BadRequestException({
      code: "INVALID_TIME_RANGE",
      message:
        "Thời gian bắt đầu và kết thúc phải chia hết cho 30 phút (:00 hoặc :30).",
    });
  }

  const durationMs = end.getTime() - start.getTime();
  if (durationMs <= 0 || durationMs % SLOT_MS !== 0) {
    throw new BadRequestException({
      code: "INVALID_TIME_RANGE",
      message:
        "Thời lượng đặt sân phải lớn hơn 0 và là bội số của 30 phút.",
    });
  }

  const blocks = durationMs / SLOT_MS;
  if (blocks < 1 || blocks > MAX_BLOCKS_PER_HOLD) {
    throw new BadRequestException({
      code: "INVALID_TIME_RANGE",
      message: `Mỗi lượt giữ chỗ chỉ được chọn từ 1 đến ${MAX_BLOCKS_PER_HOLD} block 30 phút.`,
    });
  }

  const rawIdem =
    typeof headerIdempotencyKey === "string" && headerIdempotencyKey.trim()
      ? headerIdempotencyKey.trim()
      : typeof record.idempotencyKey === "string" &&
          record.idempotencyKey.trim()
        ? record.idempotencyKey.trim()
        : null;

  if (rawIdem && rawIdem.length > 128) {
    throw new BadRequestException({
      code: "VALIDATION_ERROR",
      message: "Idempotency-Key không được vượt quá 128 ký tự.",
    });
  }

  let note: string | null = null;
  if (record.note !== undefined && record.note !== null) {
    if (typeof record.note !== "string") {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Ghi chú (note) phải là chuỗi ký tự.",
      });
    }
    const trimmedNote = record.note.trim();
    if (trimmedNote.length > 500) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Ghi chú (note) không được vượt quá 500 ký tự.",
      });
    }
    note = trimmedNote || null;
  }

  return {
    courtId,
    start,
    end,
    blocks,
    idempotencyKey: rawIdem,
    note,
  };
}

/** Chia khoảng `[start, end)` thành danh sách các block 30 phút theo giờ Việt Nam. */
export function splitRangeIntoBlocks(start: Date, end: Date): TimeBlock[] {
  const blocks: TimeBlock[] = [];
  for (let ms = start.getTime(); ms < end.getTime(); ms += SLOT_MS) {
    const blockStart = new Date(ms);
    const blockEnd = new Date(ms + SLOT_MS);
    const startParts = toVnDateParts(blockStart);
    blocks.push({
      start: blockStart,
      end: blockEnd,
      dateStr: startParts.dateStr,
      weekday: startParts.weekday,
      startMinutes: startParts.minutesOfDay,
      endMinutes: startParts.minutesOfDay + SLOT_MINUTES,
    });
  }
  return blocks;
}

/** Kiểm tra tất cả các block 30 phút có nằm trong giờ mở cửa của sân hay không. */
export function assertBlocksWithinOpeningHours(
  blocks: TimeBlock[],
  openingHours: OpeningHourRule[],
): void {
  for (const block of blocks) {
    const rule = openingHours.find((oh) => oh.dayOfWeek === block.weekday);
    if (!rule) {
      throw new BadRequestException({
        code: "INVALID_TIME_RANGE",
        message: "Sân không mở cửa vào ngày đã chọn.",
      });
    }
    const openMin = parseTimeToMinutes(rule.openTime);
    const closeMin = parseTimeToMinutes(rule.closeTime);
    if (
      openMin >= closeMin ||
      block.startMinutes < openMin ||
      block.endMinutes > closeMin
    ) {
      throw new BadRequestException({
        code: "INVALID_TIME_RANGE",
        message: `Khung giờ chọn nằm ngoài giờ mở cửa của sân (${rule.openTime.slice(0, 5)}–${rule.closeTime.slice(0, 5)}).`,
      });
    }
  }
}

/**
 * Độ cụ thể của quy tắc giá (theo `docs/05-booking-and-realtime.md` mục 5):
 * - 3: `dateOverride` (ngày lễ / ngày cụ thể) — ưu tiên cao nhất
 * - 2: `dayOfWeek` có chỉ định thứ cụ thể
 * - 1: Rule chung (`dayOfWeek` là `null` hoặc mảng rỗng)
 */
export function pricingRuleSpecificity(rule: PricingRuleRow): number {
  if (rule.dateOverride) return 3;
  if (Array.isArray(rule.dayOfWeek) && rule.dayOfWeek.length > 0) return 2;
  return 1;
}

/** Kiểm tra một `PricingRuleRow` có phủ một block 30 phút cụ thể hay không. */
export function matchesPricingRule(
  rule: PricingRuleRow,
  block: Pick<TimeBlock, "dateStr" | "weekday" | "startMinutes" | "endMinutes">,
): boolean {
  if (rule.dateOverride) {
    if (rule.dateOverride !== block.dateStr) return false;
  } else if (Array.isArray(rule.dayOfWeek) && rule.dayOfWeek.length > 0) {
    if (!rule.dayOfWeek.includes(block.weekday)) return false;
  }

  const ruleStart = parseTimeToMinutes(rule.startTime);
  const ruleEnd = parseTimeToMinutes(rule.endTime);
  return block.startMinutes >= ruleStart && block.endMinutes <= ruleEnd;
}

/**
 * Tìm quy tắc giá khớp cho một block 30 phút.
 * Sắp xếp theo `(specificity DESC, priority DESC)` rồi lấy rule đầu tiên.
 */
export function findMatchingPricingRule(
  rules: PricingRuleRow[],
  block: Pick<TimeBlock, "dateStr" | "weekday" | "startMinutes" | "endMinutes">,
): PricingRuleRow | undefined {
  return rules
    .filter((rule) => matchesPricingRule(rule, block))
    .sort(
      (a, b) =>
        pricingRuleSpecificity(b) - pricingRuleSpecificity(a) ||
        b.priority - a.priority,
    )[0];
}

/**
 * Tính tổng giá cho danh sách các block 30 phút.
 * Nếu bất kỳ block nào không khớp quy tắc giá -> ném lỗi 422 `PRICING_RULE_NOT_FOUND`
 * (TUYỆT ĐỐI không trả giá 0 đồng).
 */
export function calculateBlocksPrice(
  rules: PricingRuleRow[],
  blocks: TimeBlock[],
): { totalPrice: number; blockPrices: number[] } {
  const blockPrices: number[] = [];
  let totalPrice = 0;

  for (const block of blocks) {
    const matched = findMatchingPricingRule(rules, block);
    if (!matched) {
      throw new UnprocessableEntityException({
        code: "PRICING_RULE_NOT_FOUND",
        message: `Sân chưa cấu hình bảng giá cho khung giờ ${toVnIso(block.dateStr, block.startMinutes)}.`,
      });
    }
    blockPrices.push(matched.pricePerSlot);
    totalPrice += matched.pricePerSlot;
  }

  return { totalPrice, blockPrices };
}

/** Tính số tiền đặt cọc theo phần trăm cọc của cơ sở (làm tròn số nguyên VND). */
export function calculateDepositAmount(
  totalPrice: number,
  depositPercent: number,
): number {
  return Math.round((totalPrice * depositPercent) / 100);
}

/** Dựng ma trận các ô 30 phút cho 1 sân con trong ngày `dateStr` (`YYYY-MM-DD`). */
export function buildCourtSlotsForDate(params: {
  dateStr: string;
  openingHours: OpeningHourRule[];
  pricingRules: PricingRuleRow[];
  bookings: Array<{
    id: string;
    customerId: string | null;
    status: string;
    start: Date;
    end: Date;
    expiresAt: Date | null;
  }>;
  blackouts: Array<{
    start: Date;
    end: Date;
  }>;
  currentUserId?: string | null;
  now: Date;
  fallbackPricePerSlot?: number;
}): Slot[] {
  const {
    dateStr,
    openingHours,
    pricingRules,
    bookings,
    blackouts,
    currentUserId,
    now,
    fallbackPricePerSlot = 0,
  } = params;

  const weekday = weekdayOfDateString(dateStr);
  const hourRule = openingHours.find((oh) => oh.dayOfWeek === weekday);
  if (!hourRule) return [];

  const openMin = parseTimeToMinutes(hourRule.openTime);
  const closeMin = parseTimeToMinutes(hourRule.closeTime);
  if (openMin >= closeMin) return [];

  const nowMs = now.getTime();
  const slots: Slot[] = [];

  for (
    let min = openMin;
    min + SLOT_MINUTES <= closeMin;
    min += SLOT_MINUTES
  ) {
    const startIso = toVnIso(dateStr, min);
    const endIso = toVnIso(dateStr, min + SLOT_MINUTES);
    const startMs = new Date(startIso).getTime();
    const endMs = new Date(endIso).getTime();

    const matchedRule = findMatchingPricingRule(pricingRules, {
      dateStr,
      weekday,
      startMinutes: min,
      endMinutes: min + SLOT_MINUTES,
    });
    const price =
      matchedRule?.pricePerSlot ??
      pricingRules[0]?.pricePerSlot ??
      fallbackPricePerSlot;

    let status: SlotStatus = "available";
    let mine: boolean | undefined;

    // 1. Kiểm tra booking đang chiếm chỗ (held còn hạn, pending_payment, confirmed)
    const activeBooking = bookings.find((b) => {
      if (!["held", "pending_payment", "confirmed"].includes(b.status)) {
        return false;
      }
      if (b.status === "held" && b.expiresAt && b.expiresAt.getTime() <= nowMs) {
        return false;
      }
      return b.start.getTime() < endMs && b.end.getTime() > startMs;
    });

    if (activeBooking) {
      status = activeBooking.status === "held" ? "held" : "booked";
      if (currentUserId && activeBooking.customerId === currentUserId) {
        mine = true;
      }
    } else {
      // 2. Kiểm tra khoá sân bảo trì (blackout_periods)
      const isBlocked = blackouts.some(
        (bo) => bo.start.getTime() < endMs && bo.end.getTime() > startMs,
      );
      if (isBlocked) {
        status = "blocked";
      } else if (startMs <= nowMs) {
        // 3. Khung giờ đã bắt đầu hoặc đã qua trong quá khứ
        status = "past";
      } else {
        // 4. Còn trống
        status = "available";
      }
    }

    slots.push({
      start: startIso,
      end: endIso,
      status,
      price,
      ...(mine ? { mine: true } : {}),
    });
  }

  return slots;
}

/** Tính toán điều kiện huỷ và hoàn tiền theo `cancellation_policies`. */
export function evaluateCancellationPreview(params: {
  bookingStatus: BookingStatus | string;
  bookingStart: Date;
  bookingExpiresAt: Date | null;
  depositAmount: number;
  paymentStatus: PaymentStatus | string | null;
  paymentAmount: number | null;
  policy: CancellationPolicyRule;
  now: Date;
}): {
  canCancel: boolean;
  refundPercent: number;
  refundAmount: number;
  cancelBeforeHours: number;
  deadline: string;
} {
  const {
    bookingStatus,
    bookingStart,
    bookingExpiresAt,
    depositAmount,
    paymentStatus,
    paymentAmount,
    policy,
    now,
  } = params;

  const deadlineDate = new Date(
    bookingStart.getTime() - policy.cancelBeforeHours * 3_600_000,
  );
  const deadline = deadlineDate.toISOString();

  if (["completed", "cancelled", "expired", "no_show"].includes(bookingStatus)) {
    return {
      canCancel: false,
      refundPercent: 0,
      refundAmount: 0,
      cancelBeforeHours: policy.cancelBeforeHours,
      deadline,
    };
  }

  if (bookingStatus === "held") {
    const isExpired =
      bookingExpiresAt !== null && now.getTime() >= bookingExpiresAt.getTime();
    return {
      canCancel: !isExpired,
      refundPercent: 0,
      refundAmount: 0,
      cancelBeforeHours: policy.cancelBeforeHours,
      deadline,
    };
  }

  const canCancel =
    now.getTime() < bookingStart.getTime() &&
    now.getTime() <= deadlineDate.getTime();
  const refundPercent = canCancel ? policy.refundPercent : 0;
  const basePaid =
    paymentStatus === "completed" ? (paymentAmount ?? depositAmount) : 0;
  const refundAmount = canCancel
    ? Math.round((basePaid * refundPercent) / 100)
    : 0;

  return {
    canCancel,
    refundPercent,
    refundAmount,
    cancelBeforeHours: policy.cancelBeforeHours,
    deadline,
  };
}
