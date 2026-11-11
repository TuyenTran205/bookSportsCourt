/**
 * Tiện ích xử lý thời gian, múi giờ Việt Nam (Asia/Ho_Chi_Minh - UTC+7),
 * chia block 30 phút và PostgreSQL TSTZRANGE.
 */

const VN_OFFSET_HOURS = 7;
const VN_OFFSET_MS = VN_OFFSET_HOURS * 60 * 60 * 1000;
export const BLOCK_MINUTES = 30;
export const BLOCK_MS = BLOCK_MINUTES * 60 * 1000;

export interface DateTimePartsVN {
  year: number;
  month: number;
  date: number;
  dayOfWeek: number; // 0 = CN, 1 = T2, ..., 6 = T7
  hours: number;
  minutes: number;
  timeStr: string; // HH:mm:ss
  dateStr: string; // YYYY-MM-DD
}

/** Lấy các thành phần ngày giờ theo múi giờ Việt Nam (UTC+7). */
export function getVnDateTimeParts(date: Date): DateTimePartsVN {
  const vnTime = new Date(date.getTime() + VN_OFFSET_MS);
  const year = vnTime.getUTCFullYear();
  const month = vnTime.getUTCMonth() + 1;
  const day = vnTime.getUTCDate();
  const hours = vnTime.getUTCHours();
  const minutes = vnTime.getUTCMinutes();
  const seconds = vnTime.getUTCSeconds();

  const pad = (n: number) => String(n).padStart(2, "0");

  return {
    year,
    month,
    date: day,
    dayOfWeek: vnTime.getUTCDay(),
    hours,
    minutes,
    timeStr: `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`,
    dateStr: `${year}-${pad(month)}-${pad(day)}`,
  };
}

/** Định dạng một Date UTC thành chuỗi ISO 8601 offset +07:00. Ví dụ: 2026-10-15T08:00:00+07:00 */
export function formatVnIsoString(date: Date): string {
  const p = getVnDateTimeParts(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.dateStr}T${pad(p.hours)}:${pad(p.minutes)}:00+07:00`;
}

/** Chuyển YYYY-MM-DD và HH:mm (hoặc HH:mm:ss) theo giờ VN thành UTC Date. */
export function parseVnDateTime(dateStr: string, timeStr: string): Date {
  const normalizedTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  return new Date(`${dateStr}T${normalizedTime}+07:00`);
}

/** Kiểm tra thời điểm có phải là mốc 30 phút chuẩn (:00 hoặc :30, giây = 0, ms = 0). */
export function isMultipleOf30Minutes(date: Date): boolean {
  if (isNaN(date.getTime())) return false;
  if (date.getUTCSeconds() !== 0 || date.getUTCMilliseconds() !== 0) return false;
  const minutes = date.getUTCMinutes();
  return minutes === 0 || minutes === 30;
}

/** Kiểm tra và chia khoảng thời gian [start, end) thành các block 30 phút liên tiếp. */
export function splitInto30MinBlocks(
  start: Date,
  end: Date,
): Array<{ start: Date; end: Date }> {
  if (start.getTime() >= end.getTime()) {
    throw new Error("Thời gian bắt đầu phải trước thời gian kết thúc.");
  }
  if (!isMultipleOf30Minutes(start) || !isMultipleOf30Minutes(end)) {
    throw new Error("Thời gian bắt đầu và kết thúc phải là bội số của 30 phút.");
  }
  const diffMs = end.getTime() - start.getTime();
  if (diffMs % BLOCK_MS !== 0) {
    throw new Error("Khoảng thời gian phải là bội số của 30 phút.");
  }

  const blocks: Array<{ start: Date; end: Date }> = [];
  let curr = start.getTime();
  const endMs = end.getTime();

  while (curr < endMs) {
    const next = curr + BLOCK_MS;
    blocks.push({
      start: new Date(curr),
      end: new Date(next),
    });
    curr = next;
  }

  return blocks;
}

/** Format thành chuỗi TSTZRANGE của PostgreSQL: [start, end) */
export function formatTsTzRange(start: Date, end: Date): string {
  return `[${start.toISOString()},${end.toISOString()})`;
}

/** Parse chuỗi TSTZRANGE từ PostgreSQL thành Date start và end. */
export function parseTsTzRange(rangeStr: string): { start: Date; end: Date } {
  if (!rangeStr) {
    throw new Error("Chuỗi range rỗng.");
  }
  const inner = rangeStr.replace(/^[\[\(]/, "").replace(/[\]\)]$/, "");
  const parts = inner.split(",").map((s) => s.replace(/^"/, "").replace(/"$/, "").trim());
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    throw new Error(`Định dạng TSTZRANGE không hợp lệ: ${rangeStr}`);
  }
  const start = new Date(parts[0]);
  const end = new Date(parts[1]);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error(`Thời gian trong range không hợp lệ: ${rangeStr}`);
  }
  return { start, end };
}

/** Sinh mã chuyển khoản BSC-XXXXXX (6 ký tự ngẫu nhiên tránh gây nhầm). */
export function generateTransferCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "BSC-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/** Che số điện thoại bảo vệ PII (ví dụ 0912345678 -> 0912***678 hoặc 0912***456). */
export function maskPhoneNumber(phone?: string | null): string | null {
  if (!phone) return null;
  const clean = phone.replace(/[\s.-]/g, "");
  if (clean.length < 7) return phone;
  return clean.slice(0, 4) + "***" + clean.slice(-3);
}
