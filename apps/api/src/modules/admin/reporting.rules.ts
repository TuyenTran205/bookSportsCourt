import { ServiceUnavailableException } from "@nestjs/common";
import type {
  AdminBookingQueryInput,
  AdminStatsQueryInput,
} from "../../../../../packages/shared/src/phase4-schemas.js";

const DAY = 86400000;
export type ReportRange = { from: string; to: string };
export function reportRange(
  query: Pick<AdminBookingQueryInput, "from" | "to">,
  now: Date,
): ReportRange {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const month = `${parts.find((part) => part.type === "year")!.value.padStart(4, "0")}-${parts.find((part) => part.type === "month")!.value}`;
  const from = query.from ?? `${month}-01`;
  const last = new Date(`${month}-01T00:00:00Z`);
  last.setUTCMonth(last.getUTCMonth() + 1);
  last.setUTCDate(0);
  const to = query.to ?? last.toISOString().slice(0, 10);
  return {
    from,
    to,
  };
}
export function reportBuckets(
  range: ReportRange,
  group: AdminStatsQueryInput["groupBy"],
): string[] {
  const cursor = new Date(`${range.from}T00:00:00Z`),
    end = Date.parse(`${range.to}T00:00:00Z`) + DAY;
  if (group === "week")
    cursor.setUTCDate(cursor.getUTCDate() - ((cursor.getUTCDay() + 6) % 7));
  if (group === "month") cursor.setUTCDate(1);
  const dates: string[] = [];
  while (cursor.getTime() < end) {
    dates.push(cursor.toISOString().slice(0, 10));
    if (group === "month") cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    else cursor.setUTCDate(cursor.getUTCDate() + (group === "week" ? 7 : 1));
  }
  return dates;
}
export function safeReportInteger(raw: string | bigint | number): number {
  const value = BigInt(raw),
    max = BigInt(Number.MAX_SAFE_INTEGER);
  if (value > max || value < -max)
    throw new ServiceUnavailableException({
      code: "SERVICE_UNAVAILABLE",
      message: "Số liệu vượt miền số nguyên an toàn.",
    });
  return Number(value);
}
