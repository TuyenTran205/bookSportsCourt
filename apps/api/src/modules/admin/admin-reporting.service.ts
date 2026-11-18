import {
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import {
  BOOKING_STATUSES,
  USER_ROLES,
  VENUE_STATUSES,
} from "../../../../../packages/shared/src/constants.js";
import {
  adminBookingQuerySchema,
  adminStatsQuerySchema,
} from "../../../../../packages/shared/src/phase4-schemas.js";
import {
  adminStatsSchema,
  bookingAdminSchema,
  type AdminStats,
} from "../../../../../packages/shared/src/phase4-responses.js";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe.js";
import { AuthService } from "../auth/auth.service.js";
import { AdminReportingRepository } from "./admin-reporting.repository.js";
import {
  reportRange,
  reportBuckets,
  safeReportInteger,
} from "./reporting.rules.js";
const zeros = <T extends string>(keys: readonly T[]) =>
  Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>;
const emptyRevenue = () => ({
  bookingCountsByStatus: zeros(BOOKING_STATUSES),
  grossRevenue: 0,
  refundedAmount: 0,
  netRevenue: 0,
});
@Injectable()
export class AdminReportingService {
  constructor(
    private readonly repo: AdminReportingRepository,
    private readonly auth: AuthService,
  ) {}
  private async admin(id: string) {
    const user = await this.auth.requireActiveUser(id);
    if (user.role !== "admin")
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Chỉ Admin được đọc báo cáo toàn hệ thống.",
      });
  }
  private async safe<T>(work: () => Promise<T>) {
    try {
      return await work();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException({
        code: "INTERNAL_ERROR",
        message: "Không thể đọc báo cáo.",
      });
    }
  }
  async bookings(actor: string, raw: unknown) {
    await this.admin(actor);
    const query = new ZodValidationPipe(adminBookingQuerySchema).transform(raw);
    return this.safe(() =>
      this.repo.snapshot(async (tx, now) => {
        const range = reportRange(query, now),
          total = safeReportInteger(
            await this.repo.bookingCount(tx, query, range),
          ),
          offset = (query.page - 1) * query.limit;
        const rows =
          !Number.isSafeInteger(offset) || offset >= total
            ? []
            : await this.repo.bookingRows(tx, query, range);
        const iso = (value: Date | string | null) =>
          value === null ? null : new Date(value).toISOString();
        const data = rows.map((row) =>
          bookingAdminSchema.parse({
            ...row,
            start: iso(row.start),
            end: iso(row.end),
            expiresAt: iso(row.expiresAt),
            cancelledAt: iso(row.cancelledAt),
            createdAt: iso(row.createdAt),
            updatedAt: iso(row.updatedAt),
            payment: row.payment
              ? {
                  ...row.payment,
                  paidAt: iso(row.payment.paidAt),
                  refundedAt: iso(row.payment.refundedAt),
                }
              : null,
          }),
        );
        return {
          data,
          meta: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit),
          },
        };
      }),
    );
  }
  async stats(actor: string, raw: unknown): Promise<AdminStats> {
    await this.admin(actor);
    const query = new ZodValidationPipe(adminStatsQuerySchema).transform(raw);
    return this.safe(() =>
      this.repo.snapshot(async (tx, now) => {
        const range = reportRange(query, now),
          group = query.groupBy;
        const bookings = await this.repo.bookingGroups(tx, range, group),
          flows = await this.repo.moneyFlows(tx, range, group),
          populations = await this.repo.populations(tx),
          userGrowth = await this.repo.userGrowth(tx, range, group),
          venueGrowth = await this.repo.venueGrowth(tx, range, group),
          excluded = await this.repo.dataQuality(tx);
        const series = reportBuckets(range, group).map((date) => ({
            date,
            ...emptyRevenue(),
          })),
          buckets = new Map(series.map((item) => [item.date, item]));
        const summary = {
          ...emptyRevenue(),
          userCountsByRole: zeros(USER_ROLES),
          venueCountsByStatus: zeros(VENUE_STATUSES),
        };
        for (const row of bookings) {
          const bucket = buckets.get(row.date);
          if (
            !bucket ||
            !BOOKING_STATUSES.includes(
              row.status as (typeof BOOKING_STATUSES)[number],
            )
          )
            throw new Error("Invalid booking bucket");
          bucket.bookingCountsByStatus[
            row.status as (typeof BOOKING_STATUSES)[number]
          ] = safeReportInteger(row.n);
        }
        for (const row of flows.gross)
          buckets.get(row.date)!.grossRevenue = safeReportInteger(row.amount);
        for (const row of flows.refunded)
          buckets.get(row.date)!.refundedAmount = safeReportInteger(row.amount);
        for (const bucket of series) {
          bucket.netRevenue = safeReportInteger(
            BigInt(bucket.grossRevenue) - BigInt(bucket.refundedAmount),
          );
          for (const status of BOOKING_STATUSES)
            summary.bookingCountsByStatus[status] = safeReportInteger(
              BigInt(summary.bookingCountsByStatus[status]) +
                BigInt(bucket.bookingCountsByStatus[status]),
            );
          summary.grossRevenue = safeReportInteger(
            BigInt(summary.grossRevenue) + BigInt(bucket.grossRevenue),
          );
          summary.refundedAmount = safeReportInteger(
            BigInt(summary.refundedAmount) + BigInt(bucket.refundedAmount),
          );
        }
        summary.netRevenue = safeReportInteger(
          BigInt(summary.grossRevenue) - BigInt(summary.refundedAmount),
        );
        for (const row of populations.users) {
          if (!USER_ROLES.includes(row.role as (typeof USER_ROLES)[number]))
            throw new Error("Invalid role");
          summary.userCountsByRole[row.role as (typeof USER_ROLES)[number]] =
            safeReportInteger(row.n);
        }
        for (const row of populations.venues) {
          if (
            !VENUE_STATUSES.includes(
              row.status as (typeof VENUE_STATUSES)[number],
            )
          )
            throw new Error("Invalid venue status");
          summary.venueCountsByStatus[
            row.status as (typeof VENUE_STATUSES)[number]
          ] = safeReportInteger(row.n);
        }
        let runningOwners = 0;
        let runningCustomers = 0;
        for (const row of userGrowth.baseline) {
          if (row.role === "owner") runningOwners = safeReportInteger(row.n);
          else if (row.role === "customer")
            runningCustomers = safeReportInteger(row.n);
        }
        const userInc = new Map<string, { owners: number; customers: number }>();
        for (const row of userGrowth.increments) {
          const entry = userInc.get(row.date) ?? { owners: 0, customers: 0 };
          if (row.role === "owner") entry.owners = safeReportInteger(row.n);
          else if (row.role === "customer")
            entry.customers = safeReportInteger(row.n);
          userInc.set(row.date, entry);
        }
        let runningVenues = safeReportInteger(venueGrowth.baseline);
        const venueInc = new Map<string, number>();
        for (const row of venueGrowth.increments) {
          venueInc.set(row.date, safeReportInteger(row.n));
        }
        const userGrowthSeries = series.map((bucket) => {
          const inc = userInc.get(bucket.date);
          if (inc) {
            runningOwners = safeReportInteger(
              BigInt(runningOwners) + BigInt(inc.owners),
            );
            runningCustomers = safeReportInteger(
              BigInt(runningCustomers) + BigInt(inc.customers),
            );
          }
          return {
            date: bucket.date,
            owners: runningOwners,
            customers: runningCustomers,
          };
        });
        const venueGrowthSeries = series.map((bucket) => {
          runningVenues = safeReportInteger(
            BigInt(runningVenues) + BigInt(venueInc.get(bucket.date) ?? 0),
          );
          return { date: bucket.date, venues: runningVenues };
        });
        return adminStatsSchema.parse({
          generatedAt: now.toISOString(),
          from: range.from,
          to: range.to,
          groupBy: group,
          summary,
          series,
          userGrowthSeries,
          venueGrowthSeries,
          dataQuality: { excludedPaymentCount: safeReportInteger(excluded) },
        });
      }),
    );
  }
}
