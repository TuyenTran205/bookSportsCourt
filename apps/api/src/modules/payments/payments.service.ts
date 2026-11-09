import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpException, InternalServerErrorException } from "@nestjs/common";
import { v7 } from "uuid";
import {
  phase4IdSchema,
  paymentAccountInputSchema,
} from "../../../../../packages/shared/src/phase4-schemas.js";
import type { PaymentView } from "../../../../../packages/shared/src/phase4-responses.js";
import { paymentViewSchema } from "../../../../../packages/shared/src/phase4-responses.js";
import { AuthService } from "../auth/auth.service.js";
import { PaymentsRepository } from "./payments.repository.js";
import { ProofStorage } from "../uploads/proof-storage.js";
import { ProofCleanupService } from "../uploads/proof-cleanup.service.js";
import { decodeProof, type ProofFile } from "../uploads/proof-image.js";
type Bundle = NonNullable<Awaited<ReturnType<PaymentsRepository["lookup"]>>>;
type Payment = NonNullable<Awaited<ReturnType<PaymentsRepository["payment"]>>>;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly repo: PaymentsRepository,
    private readonly auth: AuthService,
    private readonly storage: ProofStorage,
    private readonly cleanup: ProofCleanupService,
    private readonly config: ConfigService,
  ) {}
  private id(raw: unknown) {
    const result = phase4IdSchema.safeParse(raw);
    if (!result.success)
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "ID booking không hợp lệ.",
      });
    return result.data;
  }
  private authorize(
    user: { id: string; role: string },
    row: Bundle | undefined,
    proof: boolean,
  ): asserts row is Bundle {
    if (!(proof ? ["customer"] : ["customer", "owner"]).includes(user.role))
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Không có quyền thanh toán.",
      });
    if (
      !row ||
      (user.role === "customer" && row.booking.customerId !== user.id)
    )
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Không tìm thấy thanh toán.",
      });
    if (user.role === "owner" && row.venue.ownerId !== user.id)
      throw new ForbiddenException({
        code: "NOT_VENUE_OWNER",
        message: "Không phải chủ cơ sở.",
      });
  }
  private timeout() {
    return this.config.get<number>("OWNER_REVIEW_TIMEOUT_HOURS", 2) * 3600000;
  }
  private eligible(row: Bundle, payment: Payment, now: Date) {
    const fail = () =>
      new BadRequestException({
        code: "INVALID_STATUS_TRANSITION",
        message: "Không thể gửi chứng từ ở trạng thái hiện tại.",
      });
    if (payment.provider !== "bank_transfer") throw fail();
    if (
      (row.booking.status === "expired" && payment.status === "expired") ||
      (row.booking.status === "held" &&
        payment.status === "pending" &&
        row.booking.expiresAt &&
        now >= row.booking.expiresAt)
    )
      throw new UnprocessableEntityException({
        code: "HOLD_EXPIRED",
        message: "Giữ chỗ đã hết hạn.",
      });
    if (row.booking.status === "held" && payment.status === "pending") {
      if (
        !row.booking.expiresAt ||
        !payment.bankAccountSnapshot ||
        !paymentAccountInputSchema.safeParse(payment.bankAccountSnapshot)
          .success
      )
        throw new ConflictException({
          code: "PAYMENT_DATA_INCOMPLETE",
          message: "Thiếu dữ liệu thanh toán.",
        });
      return;
    }
    if (
      row.booking.status === "pending_payment" &&
      payment.status === "submitted"
    ) {
      if (!payment.proofUploadedAt)
        throw new ConflictException({
          code: "PAYMENT_DATA_INCOMPLETE",
          message: "Thiếu thời điểm gửi đầu.",
        });
      if (now.getTime() >= payment.proofUploadedAt.getTime() + this.timeout())
        throw new ConflictException({
          code: "PAYMENT_REVIEW_EXPIRED",
          message: "Đã hết hạn duyệt thanh toán.",
        });
      return;
    }
    if (
      ["held", "pending_payment"].includes(row.booking.status) ||
      ["pending", "submitted"].includes(payment.status)
    )
      throw new ConflictException({
        code: "PAYMENT_STATE_CONFLICT",
        message: "Trạng thái thanh toán không nhất quán.",
      });
    throw fail();
  }
  async preflight(userId: string, raw: unknown) {
    const user = await this.auth.requireActiveUser(userId);
    if (user.role !== "customer")
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Chỉ khách đặt được gửi chứng từ.",
      });
    const id = this.id(raw),
      row = await this.repo.lookup(id);
    this.authorize(user, row, true);
    const payment = await this.repo.payment(id);
    if (!payment)
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Không tìm thấy thanh toán.",
      });
    return id;
  }
  view(
    row: Bundle,
    payment: Payment,
    signed: { url: string; expiresAt: string } | null,
  ): PaymentView {
    const iso = (date: Date | null) => date?.toISOString() ?? null;
    return paymentViewSchema.parse({
      id: payment.id,
      bookingId: payment.bookingId,
      provider: payment.provider,
      amount: payment.amount,
      transferCode: payment.transferCode,
      bankAccount: payment.bankAccountSnapshot,
      status: payment.status,
      bookingStatus: row.booking.status,
      proofUrl: signed?.url ?? null,
      proofUrlExpiresAt: signed?.expiresAt ?? null,
      proofUploadedAt: iso(payment.proofUploadedAt),
      proofUpdatedAt: iso(payment.proofUpdatedAt),
      reviewDeadline: payment.proofUploadedAt
        ? new Date(
            payment.proofUploadedAt.getTime() + this.timeout(),
          ).toISOString()
        : null,
      reviewedBy: payment.reviewedBy,
      reviewedAt: iso(payment.reviewedAt),
      rejectReason: payment.rejectReason,
      paidAt: iso(payment.paidAt),
      refundAmount: payment.refundAmount,
      refundedAt: iso(payment.refundedAt),
      createdAt: iso(payment.createdAt),
      updatedAt: iso(payment.updatedAt),
    });
  }
  async detail(userId: string, raw: unknown) {
    const user = await this.auth.requireActiveUser(userId);
    if (!["customer", "owner"].includes(user.role))
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Không có quyền xem thanh toán.",
      });
    const row = await this.repo.lookup(this.id(raw));
    this.authorize(user, row, false);
    const payment = await this.repo.payment(row.booking.id);
    if (!payment)
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Không tìm thấy thanh toán.",
      });
    return this.view(
      row,
      payment,
      payment.proofObjectKey
        ? await this.storage.signedGet(payment.proofObjectKey)
        : null,
    );
  }
  async proof(userId: string, raw: unknown, file: ProofFile | undefined) {
    const id = await this.preflight(userId, raw),
      buffer = await decodeProof(file),
      key = `proofs/${id}/${v7()}.png`;
    try {
      await this.cleanup.register(key);
    } catch {
      throw new ServiceUnavailableException({
        code: "SERVICE_UNAVAILABLE",
        message: "Chưa thể chuẩn bị upload chứng từ.",
      });
    }
    try {
      await this.storage.put(key, buffer);
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const result = await this.repo.transaction(async (tx) => {
            const lookup = await this.repo.lookup(id, tx);
            if (!lookup)
              throw new NotFoundException({
                code: "NOT_FOUND",
                message: "Không tìm thấy thanh toán.",
              });
            // Owner is a target user too: outbox/notification FK checks acquire user locks.
            // Lock all users in UUID order before Venue, including the current actor.
            await this.repo.lockUsers(tx, [userId, lookup.venue.ownerId]);
            const user = await this.auth.requireActiveUser(userId, tx);
            this.authorize(user, lookup, true);
            const row = await this.repo.lockParents(tx, lookup);
            if (row.venue.ownerId !== lookup.venue.ownerId)
              throw Object.assign(new Error("Payment parent changed"), {
                code: "40001",
              });
            this.authorize(user, row, true);
            const payment = await this.repo.payment(id, tx, true);
            if (!payment)
              throw new NotFoundException({
                code: "NOT_FOUND",
                message: "Không tìm thấy thanh toán.",
              });
            const now = await this.repo.now(tx);
            this.eligible(row, payment, now);
            const updated = await this.repo.attach(
              tx,
              row,
              payment,
              key,
              now,
              row.booking.status === "held",
            );
            return {
              row: {
                ...row,
                booking: {
                  ...row.booking,
                  status: "pending_payment",
                  expiresAt: null,
                },
              },
              payment: updated,
            };
          });
          // Sign after waiting/committing, so the client receives a fresh 5-minute URL.
          return this.view(
            result.row,
            result.payment,
            await this.storage.signedGet(key),
          );
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
          if (!retry) throw error;
          if (attempt === 2)
            throw new ServiceUnavailableException({
              code: "SERVICE_UNAVAILABLE",
              message: "Thanh toán đang bận; vui lòng thử lại.",
            });
        }
      }
      throw new ServiceUnavailableException({
        code: "SERVICE_UNAVAILABLE",
        message: "Không thể lưu thanh toán.",
      });
    } catch (error) {
      try {
        await this.cleanup.clean(key);
      } catch {
        /* Intent persisted before PUT; worker will retry. */
      }
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException({
        code: "INTERNAL_ERROR",
        message: "Không thể cập nhật chứng từ thanh toán.",
      });
    }
  }
}
