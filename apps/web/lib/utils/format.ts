/**
 * Định dạng hiển thị — docs/07-design-system.md mục 4.
 *
 * Quy ước bắt buộc:
 * - Ngày giờ: `date-fns` + locale `vi` (KHÔNG tự nối chuỗi).
 * - Tiền: `Intl.NumberFormat('vi-VN')` → "250.000 ₫".
 */

import { addDays as dateFnsAddDays, format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';

const vnd = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const decimal = new Intl.NumberFormat('vi-VN');

/** Chuỗi ISO (hoặc Date) → Date hợp lệ, hoặc `null` nếu không phân tích được. */
function toDate(value: string | Date): Date | null {
  const d = typeof value === 'string' ? parseISO(value) : value;
  return isValid(d) ? d : null;
}

/** 250000 → "250.000 ₫" */
export function formatCurrency(value: number): string {
  return vnd.format(value);
}

/** 1234 → "1.234" */
export function formatNumber(value: number): string {
  return decimal.format(value);
}

/** → "15/10/2026" */
export function formatDate(value: string | Date): string {
  const d = toDate(value);
  return d ? format(d, 'dd/MM/yyyy', { locale: vi }) : '—';
}

/** → "Thứ Tư, 15/10/2026" */
export function formatDateLong(value: string | Date): string {
  const d = toDate(value);
  return d ? format(d, 'EEEE, dd/MM/yyyy', { locale: vi }) : '—';
}

/** → "15/10/2026 19:30" */
export function formatDateTime(value: string | Date): string {
  const d = toDate(value);
  return d ? format(d, 'dd/MM/yyyy HH:mm', { locale: vi }) : '—';
}

/** → "16/10/2026, 19:30" theo múi giờ nghiệp vụ. */
export function formatDateTimeInVietnam(value: string | Date): string {
  const d = toDate(value);
  if (!d) return '—';

  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(d);
}

/** Khoảng ngày giờ theo múi giờ nghiệp vụ, không phụ thuộc múi giờ thiết bị. */
export function formatDateTimeRangeInVietnam(start: string, end: string): string {
  const startDate = toDate(start);
  const endDate = toDate(end);
  if (!startDate || !endDate) return '—';

  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  };
  const fullFormatter = new Intl.DateTimeFormat('vi-VN', options);
  const timeFormatter = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const endText =
    dateFormatter.format(startDate) === dateFormatter.format(endDate)
      ? timeFormatter.format(endDate)
      : fullFormatter.format(endDate);

  return `${fullFormatter.format(startDate)} – ${endText}`;
}

/** → "19:30" */
export function formatTime(value: string | Date): string {
  const d = toDate(value);
  return d ? format(d, 'HH:mm', { locale: vi }) : '—';
}

/** → "19:00 – 20:30" */
export function formatTimeRange(start: string | Date, end: string | Date): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

/** Thứ trong tuần, viết tắt: "T4, 15/10" */
export function formatDateWithWeekday(value: string | Date): string {
  const d = toDate(value);
  return d ? format(d, 'EEEEEE, dd/MM', { locale: vi }) : '—';
}

/** "2026-10-15" cho `<input type="date">` và query param. */
export function toDateInputValue(value: string | Date): string {
  const d = toDate(value) ?? new Date();
  return format(d, 'yyyy-MM-dd');
}

/** Cộng/trừ ngày và trả về chuỗi "yyyy-MM-dd" cho input date. */
export function addDays(value: string | Date, amount: number): string {
  const d = toDate(value) ?? new Date();
  return toDateInputValue(dateFnsAddDays(d, amount));
}

/** Ngày mai — mặc định cho lưới slot. */
export function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toDateInputValue(d);
}

/** "3 giờ trước" */
export function timeAgo(value: string | Date): string {
  const d = toDate(value);
  if (!d) return '—';
  return formatDistanceToNowStrict(d, { locale: vi, addSuffix: true });
}

/** Tỷ lệ 0..1 → "72%" */
export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/** Ngày bắt đầu/kết thúc theo múi giờ nghiệp vụ Asia/Ho_Chi_Minh. */
export function getVietnamDateRange(days: number): { from: string; to: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const to = `${values.year}-${values.month}-${values.day}`;
  const fromDate = new Date(`${to}T00:00:00.000Z`);
  fromDate.setUTCDate(fromDate.getUTCDate() - Math.max(0, Math.floor(days) - 1));

  return { from: fromDate.toISOString().slice(0, 10), to };
}

/** Ngày-only từ API → nhãn ngắn dd/MM, không bị lệch ngày theo múi giờ thiết bị. */
export function formatShortDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
  }).formatToParts(date);
  const day = parts.find((part) => part.type === 'day')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  return day && month ? `${day}/${month}` : '—';
}

/** Số điện thoại đã che: "0912***456" */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  if (phone.length < 7) return phone;
  return `${phone.slice(0, 4)}***${phone.slice(-3)}`;
}

/** Đồng hồ đếm ngược mm:ss từ số mili-giây còn lại. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
