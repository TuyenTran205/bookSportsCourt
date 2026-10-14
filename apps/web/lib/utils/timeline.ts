import type { Blackout, Court, OpeningHour, OwnerTimelineBooking } from '@bsc/shared';

import { SLOT_MINUTES } from '@bsc/shared';

/**
 * Logic dựng trục thời gian cho OwnerTimeline — thuần, test được.
 *
 * Yêu cầu cốt lõi (docs/07 mục 10): trục KHÔNG được hard-code 8:00–22:00.
 * Phải suy ra từ `opening_hours` của TỪNG court: lấy min(open) và max(close)
 * trên các court đang hiển thị, rồi vẽ từ mốc sớm nhất tới mốc muộn nhất.
 * Mỗi hàng court chỉ tô block trong giờ của chính sân đó.
 */

/** Múi giờ Việt Nam — mọi mốc ISO trong hệ thống đều kèm offset này. */
const VN_OFFSET = '+07:00';

export interface CourtWindow {
  openMinute: number;
  closeMinute: number;
}

export interface TimelineAxis {
  /** Phút kể từ 00:00 của mốc sớm nhất. */
  startMinute: number;
  /** Phút kể từ 00:00 của mốc muộn nhất. */
  endMinute: number;
  /** Mọi mốc bắt đầu block, tăng dần, cách nhau `SLOT_MINUTES`. */
  slots: number[];
}

/** "06:30" → 390. Trả `null` nếu chuỗi không hợp lệ. */
export function minutesFromHHmm(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** 390 → "06:30" */
export function hhmmFromMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Ghép ngày + phút thành mốc ISO kèm offset +07:00. */
export function isoFromMinutes(date: string, minute: number): string {
  return `${date}T${hhmmFromMinutes(minute)}:00${VN_OFFSET}`;
}

/**
 * Khung mở cửa của một court trong ngày.
 *
 * Ưu tiên cấu hình riêng của court (`courtId` khớp); nếu không có thì rơi về
 * cấu hình chung của venue (`courtId === null`) — OWN-04 cho phép đặt riêng
 * từng sân, nhưng phần lớn sân dùng chung giờ của cơ sở.
 *
 * Trả `null` khi sân đóng cửa cả ngày hoặc không có cấu hình nào.
 */
export function courtWindow(
  courtId: string,
  weekday: number,
  hours: readonly OpeningHour[],
): CourtWindow | null {
  const forDay = hours.filter((h) => h.weekday === weekday);
  const own = forDay.find((h) => h.courtId === courtId);
  const shared = forDay.find((h) => h.courtId === null);
  const rule = own ?? shared;

  if (!rule || rule.isClosed) return null;

  const open = minutesFromHHmm(rule.openTime);
  const close = minutesFromHHmm(rule.closeTime);
  // Giờ mở cửa hỏng thì coi như đóng — thà thiếu còn hơn vẽ trục sai.
  if (open === null || close === null || close <= open) return null;

  return { openMinute: open, closeMinute: close };
}

/**
 * Dựng trục từ danh sách court.
 *
 * Trả `null` khi không court nào mở cửa — component hiện EmptyState thay vì
 * vẽ một trục rỗng vô nghĩa.
 */
export function buildTimelineAxis(
  courts: readonly Court[],
  weekday: number,
  hours: readonly OpeningHour[],
): TimelineAxis | null {
  const windows = courts
    .map((c) => courtWindow(c.id, weekday, hours))
    .filter((w): w is CourtWindow => w !== null);

  if (windows.length === 0) return null;

  const startMinute = Math.min(...windows.map((w) => w.openMinute));
  const endMinute = Math.max(...windows.map((w) => w.closeMinute));

  const slots: number[] = [];
  for (let m = startMinute; m < endMinute; m += SLOT_MINUTES) slots.push(m);

  return { startMinute, endMinute, slots };
}

/** Trạng thái một ô trên lưới. */
export type CellState = 'closed' | 'booked' | 'blocked' | 'past' | 'free';

export interface CellInfo {
  state: CellState;
  booking?: OwnerTimelineBooking;
  blackout?: Blackout;
}

/** Hai khoảng [aStart,aEnd) và [bStart,bEnd) có giao nhau không. */
function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Xác định trạng thái ô tại `minute` của một court.
 *
 * Thứ tự xét quan trọng:
 * 1. Ngoài giờ mở cửa → `closed` (gạch chéo, không kéo được, KHÔNG phải
 *    blackout — đây là hai khái niệm khác nhau theo docs/01).
 * 2. Có booking phủ ô → `booked`.
 * 3. Có blackout phủ ô → `blocked`.
 * 4. Ô trống nhưng đã trôi qua → `past` (API từ chối đặt giờ quá khứ, nên
 *    không cho kéo; ô đã có booking vẫn là `booked` để xem chi tiết).
 * 5. Còn lại → `free`.
 *
 * `pastCutoff` là mốc phút-trong-ngày mà ô kết thúc không muộn hơn thì coi là
 * đã qua (xem `pastCutoffMinute`); `null` nghĩa là không ô nào đã qua.
 *
 * `date` (YYYY-MM-DD) dùng để so khớp chính xác ngày của booking và blackout,
 * tránh trường hợp khoá sân 1 ngày bị tính lặp lại cho mọi ngày.
 */
export function cellState(
  courtId: string,
  minute: number,
  window: CourtWindow | null,
  bookings: readonly OwnerTimelineBooking[],
  blackouts: readonly Blackout[],
  pastCutoff: number | null = null,
  date?: string,
): CellInfo {
  const end = minute + SLOT_MINUTES;

  if (!window || minute < window.openMinute || end > window.closeMinute) {
    return { state: 'closed' };
  }

  for (const booking of bookings) {
    if (booking.courtId !== courtId) continue;
    if (date) {
      const slotStart = new Date(isoFromMinutes(date, minute)).getTime();
      const slotEnd = new Date(isoFromMinutes(date, end)).getTime();
      const bStart = new Date(booking.during.start).getTime();
      const bEnd = new Date(booking.during.end).getTime();
      if (overlaps(slotStart, slotEnd, bStart, bEnd)) return { state: 'booked', booking };
    } else {
      // Tương thích ngược khi không truyền date
      const start = minuteOfDay(booking.during.start);
      const finish = minuteOfDay(booking.during.end);
      if (start === null || finish === null) continue;
      if (overlaps(minute, end, start, finish)) return { state: 'booked', booking };
    }
  }

  for (const blackout of blackouts) {
    if (blackout.courtId !== courtId) continue;
    if (date) {
      const slotStart = new Date(isoFromMinutes(date, minute)).getTime();
      const slotEnd = new Date(isoFromMinutes(date, end)).getTime();
      const bStart = new Date(blackout.start).getTime();
      const bEnd = new Date(blackout.end).getTime();
      if (overlaps(slotStart, slotEnd, bStart, bEnd)) return { state: 'blocked', blackout };
    } else {
      // Tương thích ngược khi không truyền date
      const start = minuteOfDay(blackout.start);
      const finish = minuteOfDay(blackout.end);
      if (start === null || finish === null) continue;
      if (overlaps(minute, end, start, finish)) return { state: 'blocked', blackout };
    }
  }

  if (pastCutoff !== null && end <= pastCutoff) return { state: 'past' };

  return { state: 'free' };
}

/**
 * Mốc phút-trong-ngày để xác định ô đã qua của ngày `date` (YYYY-MM-DD, giờ VN).
 * Ngày quá khứ → cả ngày đã qua; ngày tương lai → `null`; hôm nay → phút hiện tại.
 */
export function pastCutoffMinute(date: string, now: Date = new Date()): number | null {
  const vn = new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString();
  const today = vn.slice(0, 10);
  if (date < today) return 24 * 60;
  if (date > today) return null;
  return minuteOfDay(vn);
}

/**
 * Phút trong ngày của một mốc ISO, theo giờ Việt Nam.
 *
 * Đọc trực tiếp phần "HH:mm" trong chuỗi thay vì dựng `Date`: mốc đã kèm offset
 * +07:00 và ta luôn hiển thị theo giờ VN, nên chuyển qua `Date` chỉ tổ thêm phụ
 * thuộc vào múi giờ của máy chạy.
 */
export function minuteOfDay(iso: string): number | null {
  const match = /T(\d{2}):(\d{2})/.exec(iso);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}
