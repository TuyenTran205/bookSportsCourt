import type {
  OccupancyPoint,
  PeakHour,
  RevenuePoint,
} from "../../../../../packages/shared/src/types.js";
import { getVnDateTimeParts } from "../../common/utils/time-range.js";

export type ReportGroupBy = "day" | "week" | "month";

export interface DailyBookingStat {
  date: string;
  revenue: number;
  bookings: number;
}

export interface MinuteRange {
  start: number;
  end: number;
}

const DAY_MS = 86_400_000;

function parseDateOnly(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Liệt kê toàn bộ ngày trong khoảng [from, to] theo lịch (date-only). */
export function eachDate(from: string, to: string): string[] {
  const start = parseDateOnly(from).getTime();
  const end = parseDateOnly(to).getTime();
  const dates: string[] = [];

  for (let current = start; current <= end; current += DAY_MS) {
    dates.push(formatDateOnly(new Date(current)));
  }
  return dates;
}

/** Khoá nhóm của một ngày: tuần bắt đầu từ thứ Hai, tháng bắt đầu ngày 01. */
export function bucketKey(date: string, groupBy: ReportGroupBy): string {
  if (groupBy === "month") return `${date.slice(0, 7)}-01`;
  if (groupBy === "day") return date;

  const value = parseDateOnly(date);
  const weekday = value.getUTCDay(); // 0 = Chủ nhật
  const offset = weekday === 0 ? 6 : weekday - 1;
  value.setUTCDate(value.getUTCDate() - offset);
  return formatDateOnly(value);
}

/** Gộp doanh thu/đơn theo ngày, tuần hoặc tháng và trả về series đã sắp xếp. */
export function aggregateRevenue(
  rows: DailyBookingStat[],
  groupBy: ReportGroupBy,
): RevenuePoint[] {
  const buckets = new Map<string, RevenuePoint>();

  for (const row of rows) {
    const key = bucketKey(row.date, groupBy);
    const current = buckets.get(key) ?? {
      date: key,
      revenue: 0,
      bookings: 0,
    };
    current.revenue += row.revenue;
    current.bookings += row.bookings;
    buckets.set(key, current);
  }

  return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function occupancyRate(bookedSlots: number, availableSlots: number) {
  if (availableSlots <= 0) return 0;
  return Math.min(100, Math.round((bookedSlots / availableSlots) * 100));
}

export function toOccupancyPoint(
  date: string,
  bookedSlots: number,
  availableSlots: number,
): OccupancyPoint {
  return {
    date,
    bookedSlots,
    availableSlots,
    occupancyRate: occupancyRate(bookedSlots, availableSlots),
  };
}

/** Top khung giờ được đặt nhiều nhất; mỗi phần tử là một block 30 phút. */
export function topPeakHours(
  slotStarts: Date[],
  limit = 5,
): PeakHour[] {
  const counts = new Map<string, { start: string; end: string; count: number }>();

  for (const start of slotStarts) {
    const parts = getVnDateTimeParts(start);
    const startMinutes = parts.hours * 60 + parts.minutes;
    const pad = (minutes: number) =>
      `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    const startTime = pad(startMinutes);
    const endTime = pad(startMinutes + 30);
    const current = counts.get(startTime) ?? {
      start: startTime,
      end: endTime,
      count: 0,
    };
    current.count += 1;
    counts.set(startTime, current);
  }

  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.start.localeCompare(b.start))
    .slice(0, limit)
    .map((item) => ({
      startTime: item.start,
      endTime: item.end,
      bookedSlots: item.count,
    }));
}

/** "HH:mm" hoặc "HH:mm:ss" → số phút tính từ 00:00. */
export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

/** Chia khung mở cửa thành các block 30 phút. */
export function splitOpenBlocks(
  openTime: string,
  closeTime: string,
): MinuteRange[] {
  const start = timeToMinutes(openTime);
  const end = timeToMinutes(closeTime);
  const blocks: MinuteRange[] = [];
  for (let current = start; current + 30 <= end; current += 30) {
    blocks.push({ start: current, end: current + 30 });
  }
  return blocks;
}

export function isRangeOverlapping(a: MinuteRange, b: MinuteRange): boolean {
  return a.start < b.end && b.start < a.end;
}