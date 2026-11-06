import type {
  Blackout,
  Booking,
  BookingDetail,
  OpeningHour,
  Payment,
  PricingRule,
  Slot,
} from '@bsc/shared';
import { SLOT_MINUTES } from '@bsc/shared';

/**
 * Sinh lưới slot từ giờ mở cửa + bảng giá + booking + khoá sân.
 *
 * Đây là "backend giả" quan trọng nhất: `SlotGrid` chỉ hiển thị đúng những gì
 * hàm này trả về, nên logic ở đây phải khớp docs/05-booking-and-realtime.md.
 *
 * Thứ tự ưu tiên khi xác định trạng thái một ô:
 *   1. `past`      – mốc thời gian đã trôi qua
 *   2. `blocked`   – khoá sân (bảo trì)
 *   3. `booked`    – booking đã xác nhận / hoàn tất
 *   4. `held`      – booking đang giữ chỗ (kèm `mine` nếu là của mình)
 *   5. `available` – còn trống
 */

const VN_OFFSET = '+07:00';

/** "2026-10-15" + 480 phút → "2026-10-15T08:00:00+07:00" */
export function toIso(date: string, minutesFromMidnight: number): string {
  const h = Math.floor(minutesFromMidnight / 60);
  const m = minutesFromMidnight % 60;
  return `${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00${VN_OFFSET}`;
}

/** "08:30" → 510 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Bỏ phần giờ, chỉ giữ ngày theo giờ Việt Nam. */
export function toDateOnly(d: Date): string {
  const vn = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return vn.toISOString().slice(0, 10);
}

/** Thứ trong tuần của một ngày "YYYY-MM-DD" (0 = Chủ nhật). */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y!, m! - 1, d!).getDay();
}

/** Hai khoảng [aStart,aEnd) và [bStart,bEnd) có giao nhau không. */
function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

interface BuildSlotsArgs {
  date: string;
  courtId: string;
  venueId: string;
  openingHours: OpeningHour[];
  pricingRules: PricingRule[];
  blackouts: Blackout[];
  bookings: Booking[];
  /** id người dùng đang đăng nhập – để đánh dấu `mine`. */
  currentUserId: string | null;
  /** Mốc "hiện tại" để tính `past`; truyền vào để test tất định được. */
  now?: Date;
}

export function buildSlots({
  date,
  courtId,
  venueId,
  openingHours,
  pricingRules,
  blackouts,
  bookings,
  currentUserId,
  now = new Date(),
}: BuildSlotsArgs): Slot[] {
  const weekday = weekdayOf(date);

  // 1. Khung giờ mở cửa của ngày này (ưu tiên cấu hình riêng cho sân).
  const hours = openingHours.filter(
    (o) => o.weekday === weekday && o.venueId === venueId && (o.courtId === null || o.courtId === courtId),
  );
  const hour = hours.find((o) => o.courtId === courtId) ?? hours[0];
  if (!hour || hour.isClosed) return [];

  const openMin = timeToMinutes(hour.openTime);
  const closeMin = timeToMinutes(hour.closeTime);

  // 2. Giá cho từng khung giờ (rule khớp thứ + khung giờ; ưu tiên rule riêng sân).
  const todaysRules = pricingRules
    .filter((r) => r.venueId === venueId && r.weekdays.includes(weekday))
    .filter((r) => r.courtId === null || r.courtId === courtId)
    .sort((a, b) => (a.courtId === null ? 1 : 0) - (b.courtId === null ? 1 : 0));

  const priceAt = (startMin: number): number => {
    const rule = todaysRules.find((r) =>
      overlaps(startMin, startMin + SLOT_MINUTES, timeToMinutes(r.startTime), timeToMinutes(r.endTime)),
    );
    return rule?.pricePerSlot ?? todaysRules[0]?.pricePerSlot ?? 0;
  };

  // 3. Booking chiếm chỗ của sân này (bỏ booking đã huỷ / hết hạn).
  const activeBookings = bookings.filter(
    (b) =>
      b.courtId === courtId &&
      !['cancelled', 'expired'].includes(b.status) &&
      b.during.start.slice(0, 10) === date,
  );

  // 4. Khoá sân trong ngày.
  const todaysBlackouts = blackouts.filter(
    (bo) => bo.courtId === courtId && bo.start.slice(0, 10) === date,
  );

  const nowMs = now.getTime();
  const slots: Slot[] = [];

  for (let min = openMin; min + SLOT_MINUTES <= closeMin; min += SLOT_MINUTES) {
    const start = toIso(date, min);
    const end = toIso(date, min + SLOT_MINUTES);
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();

    let status: Slot['status'] = 'available';
    let mine: boolean | undefined;

    // Ưu tiên 1: đã qua
    if (endMs <= nowMs) {
      status = 'past';
    } else {
      // Ưu tiên 2: khoá sân
      const isBlocked = todaysBlackouts.some((bo) =>
        overlaps(startMs, endMs, new Date(bo.start).getTime(), new Date(bo.end).getTime()),
      );

      if (isBlocked) {
        status = 'blocked';
      } else {
        // Ưu tiên 3–4: booking
        const hit = activeBookings.find((b) =>
          overlaps(startMs, endMs, new Date(b.during.start).getTime(), new Date(b.during.end).getTime()),
        );

        if (hit) {
          if (hit.status === 'held') {
            status = 'held';
            mine = currentUserId !== null && hit.customerId === currentUserId;
          } else {
            // pending_payment / confirmed / completed / no_show đều coi là đã đặt.
            status = 'booked';
          }
        }
      }
    }

    slots.push({ start, end, status, price: priceAt(min), ...(mine !== undefined ? { mine } : {}) });
  }

  return slots;
}

/** Gộp các slot rời rạc thành danh sách khoảng liền kề (dùng để hiển thị tóm tắt). */
export function mergeAdjacentSlots(slots: Slot[]): Array<{ start: string; end: string; price: number }> {
  const sorted = [...slots].sort((a, b) => a.start.localeCompare(b.start));
  const merged: Array<{ start: string; end: string; price: number }> = [];

  for (const s of sorted) {
    const last = merged[merged.length - 1];
    if (last && last.end === s.start) {
      last.end = s.end;
      last.price += s.price;
    } else {
      merged.push({ start: s.start, end: s.end, price: s.price });
    }
  }

  return merged;
}

/** Tính tiền cọc từ chính sách của cơ sở. */
export function computeDeposit(totalPrice: number, depositPercent: number): number {
  return Math.round((totalPrice * depositPercent) / 100);
}

/** Rút gọn booking thành shape lồng nhau cho `BookingDetail`. */
export function toBookingDetail(
  booking: Booking,
  court: { id: string; name: string; venue: BookingDetail['court']['venue'] },
  customer: BookingDetail['customer'],
  payment: Payment | null,
  review: BookingDetail['review'],
): BookingDetail {
  return { ...booking, court, customer, payment, review };
}
