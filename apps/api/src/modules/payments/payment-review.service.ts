import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ownerPaymentQuerySchema,
  paymentApproveSchema,
  paymentRejectSchema,
  phase4IdSchema,
  noQuerySchema,
} from "../../../../../packages/shared/src/phase4-schemas.js";
import { ownerPaymentItemSchema } from "../../../../../packages/shared/src/phase4-responses.js";
import { AuthService } from "../auth/auth.service.js";
import { ProofStorage } from "../uploads/proof-storage.js";
import { PaymentsService } from "./payments.service.js";
import { PaymentsRepository } from "./payments.repository.js";
import { reviewDecision } from "./payment-review.rules.js";
import { RealtimePublisher } from "../realtime/realtime.publisher.js";
import { BookingsService } from "../bookings/bookings.service.js";

@Injectable()
export class PaymentReviewService {
  private scanAfter: string | undefined;
  constructor(
    private readonly repo: PaymentsRepository,
    private readonly auth: AuthService,
    private readonly views: PaymentsService,
    private readonly storage: ProofStorage,
    private readonly config: ConfigService,
    @Optional() private readonly realtime?: RealtimePublisher,
    @Optional() private readonly bookings?: BookingsService,
  ) {}
  private timeout() {
    return this.config.get<number>("OWNER_REVIEW_TIMEOUT_HOURS", 2) * 3600000;
  }
  private async owner(
    userId: string,
    tx?: Parameters<AuthService["requireActiveUser"]>[1],
  ) {
    const user = await this.auth.requireActiveUser(userId, tx);
    if (user.role !== "owner")
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Owner role required.",
      });
    return user;
  }
  private parse<T>(
    schema: {
      safeParse(
        value: unknown,
      ): { success: true; data: T } | { success: false };
    },
    raw: unknown,
  ): T {
    const result = schema.safeParse(raw);
    if (!result.success)
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Invalid request.",
      });
    return result.data;
  }
  private async retry<T>(work: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await work();
      } catch (error) {
        let cause: unknown = error;
        const seen = new Set<unknown>();
        let retry = false;
        while (cause && typeof cause === "object" && !seen.has(cause)) {
          seen.add(cause);
          if (
            "code" in cause &&
            ["40001", "40P01"].includes(String(cause.code))
          )
            retry = true;
          cause = "cause" in cause ? cause.cause : null;
        }
        if (retry && attempt < 2) continue;
        if (error instanceof HttpException) throw error;
        if (retry)
          throw new ServiceUnavailableException({
            code: "SERVICE_UNAVAILABLE",
            message: "Payment busy; retry later.",
          });
        // Never expose SQL parameters (proof/bank/reason) to the exception logger.
        throw new InternalServerErrorException({
          code: "INTERNAL_ERROR",
          message: "Payment operation failed.",
        });
      }
    }
    throw new Error("Unreachable");
  }
  async list(userId: string, raw: unknown) {
    await this.owner(userId);
    const query = this.parse(ownerPaymentQuerySchema, raw);
    const result = await this.retry(() => this.repo.ownerList(userId, query));
    const data = await Promise.all(
      result.rows.map(async (row) =>
        ownerPaymentItemSchema.parse({
          ...this.views.view(
            row,
            row.payment,
            row.payment.proofObjectKey
              ? await this.storage.signedGet(row.payment.proofObjectKey)
              : null,
          ),
          venueId: row.venue.id,
          courtId: row.court.id,
          bookingStart: row.start.toISOString(),
          bookingEnd: row.end.toISOString(),
          customerId: row.booking.customerId,
        }),
      ),
    );
    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / query.limit),
      },
    };
  }
  async mutate(
    userId: string,
    rawId: unknown,
    action: "approve" | "reject",
    body: unknown,
    query: unknown,
  ) {
    await this.owner(userId);
    const id = this.parse(phase4IdSchema, rawId);
    const result = await this.locked(id, userId, action, body, query);
    if (result.changed) {
      await this.publishReviewRealtime(action, result);
    }
    return this.views.view(
      result.row,
      result.payment,
      result.payment.proofObjectKey
        ? await this.storage.signedGet(result.payment.proofObjectKey)
        : null,
    );
  }
  private async publishReviewRealtime(
    action: "approve" | "reject" | "expire",
    result: Awaited<ReturnType<PaymentReviewService["locked"]>>,
  ) {
    const customerId = result.row.booking.customerId;
    const ownerId = result.row.venue.ownerId;
    if (customerId) {
      if (action === "approve") {
        this.realtime?.emitBookingConfirmed(
          customerId,
          { paymentId: result.payment.id, bookingId: result.row.booking.id },
          ownerId,
        );
        this.realtime?.emitNotificationCreated(customerId, {
          id: result.payment.id,
          type: "booking_confirmed",
          title: "Đặt sân đã được xác nhận",
        });
      } else if (action === "reject") {
        this.realtime?.emitPaymentRejected(customerId, {
          paymentId: result.payment.id,
          bookingId: result.row.booking.id,
          reason: result.payment.rejectReason ?? "",
        });
        this.realtime?.emitNotificationCreated(customerId, {
          id: result.payment.id,
          type: "payment_rejected",
          title: "Đặt sân đã bị huỷ",
        });
      } else {
        this.realtime?.emitBookingCancelled(
          customerId,
          {
            bookingId: result.row.booking.id,
            reason: "OWNER_REVIEW_TIMEOUT",
          },
          ownerId,
        );
        this.realtime?.emitNotificationCreated(customerId, {
          id: result.payment.id,
          type: "booking_cancelled",
          title: "Đơn đặt sân đã bị huỷ",
        });
      }
    }
    await this.bookings?.publishSlotUpdate(
      result.row.venue.id,
      result.row.booking.courtId,
      result.row.start,
    );
  }
  private locked(
    id: string,
    actorId: string | null,
    action: "approve" | "reject" | "expire",
    body?: unknown,
    query?: unknown,
  ) {
    return this.retry(() =>
      this.repo.transaction(async (tx) => {
        const found = await this.repo.byId(id, tx);
        const lookup = found
          ? await this.repo.lookup(found.bookingId, tx)
          : undefined;
        if (!lookup || !found)
          throw new NotFoundException({
            code: "NOT_FOUND",
            message: "Payment not found.",
          });
        // FK recipients must be locked before parents, including in actorless cron.
        await this.repo.lockUsers(
          tx,
          [actorId, lookup.venue.ownerId, lookup.booking.customerId].filter(
            (id): id is string => id !== null,
          ),
        );
        if (actorId) {
          await this.owner(actorId, tx);
          if (lookup.venue.ownerId !== actorId)
            throw new ForbiddenException({
              code: "NOT_VENUE_OWNER",
              message: "Payment belongs to another owner.",
            });
        }
        const row = await this.repo.lockParents(tx, lookup);
        if (
          row.venue.ownerId !== lookup.venue.ownerId ||
          row.booking.customerId !== lookup.booking.customerId
        )
          throw Object.assign(new Error("Payment parent changed"), {
            code: "40001",
          });
        const payment = await this.repo.byId(id, tx, true);
        if (!payment || payment.bookingId !== row.booking.id)
          throw Object.assign(new Error("Payment parent changed"), {
            code: "40001",
          });
        let reason: string | undefined;
        if (action !== "expire") {
          this.parse(noQuerySchema, query ?? {});
          if (action === "reject")
            reason = this.parse(paymentRejectSchema, body).reason;
          else this.parse(paymentApproveSchema, body ?? {});
        }
        const now = await this.repo.now(tx);
        if (
          reviewDecision(
            row.booking,
            payment,
            action,
            reason,
            now,
            this.timeout(),
          ) === "noop"
        )
          return { row, payment, changed: false };
        return {
          ...(await this.repo.review(
            tx,
            row,
            payment,
            actorId,
            action,
            reason,
            now,
          )),
          changed: true,
        };
      }),
    );
  }
  async expireBatch(batchSize = 100, maxBatches = 10) {
    let after: string | undefined = this.scanAfter;
    const stats = {
      scanned: 0,
      cancelled: 0,
      errors: 0,
      problemPaymentIds: [] as string[],
    };
    for (let page = 0; page < maxBatches; page++) {
      let candidates = await this.repo.reviewCandidates(after, batchSize);
      if (page === 0 && candidates.length === 0 && after) {
        after = undefined;
        candidates = await this.repo.reviewCandidates(after, batchSize);
      }
      for (const candidate of candidates) {
        stats.scanned++;
        after = candidate.id;
        try {
          const result = await this.locked(candidate.id, null, "expire");
          if (result.changed) {
            stats.cancelled++;
            await this.publishReviewRealtime("expire", result);
          }
        } catch {
          stats.errors++;
          if (stats.problemPaymentIds.length < 10)
            stats.problemPaymentIds.push(candidate.id);
        } // Log only bounded resource IDs, never raw SQL, bank data or reasons.
      }
      if (candidates.length < batchSize) {
        after = undefined;
        break;
      }
    }
    this.scanAfter = after;
    return stats;
  }
}
