import { BadRequestException, ConflictException } from "@nestjs/common";
import type { bookings, payments } from "../../database/schema/index.js";

/** API business rule only. Caller must hold booking/payment locks and supply DB time. */
export function reviewDecision(
  booking: typeof bookings.$inferSelect,
  payment: typeof payments.$inferSelect,
  action: "approve" | "reject" | "expire",
  reason: string | undefined,
  now: Date,
  timeout: number,
): "write" | "noop" {
  const invalid = () =>
    new BadRequestException({
      code: "INVALID_STATUS_TRANSITION",
      message: "Invalid payment transition.",
    });
  const conflict = (code = "PAYMENT_STATE_CONFLICT") =>
    new ConflictException({
      code,
      message: "Payment cannot be reviewed in its current state.",
    });
  if (payment.provider !== "bank_transfer") throw invalid();
  if (action === "approve" && payment.status === "completed") {
    if (
      !["confirmed", "completed", "no_show", "cancelled"].includes(
        booking.status,
      )
    )
      throw conflict();
    if (!payment.reviewedBy || !payment.reviewedAt || !payment.paidAt)
      throw conflict("PAYMENT_DATA_INCOMPLETE");
    return "noop";
  }
  if (action === "reject" && payment.status === "rejected") {
    if (booking.status !== "cancelled") throw conflict();
    if (
      !payment.reviewedBy ||
      !payment.reviewedAt ||
      !booking.cancelledAt ||
      !booking.cancelledBy ||
      booking.cancelReason !== payment.rejectReason
    )
      throw conflict("PAYMENT_DATA_INCOMPLETE");
    if (payment.rejectReason !== reason) throw invalid();
    return "noop";
  }
  if (action === "expire" && payment.status !== "submitted") return "noop";
  if (payment.status !== "submitted" || booking.status !== "pending_payment") {
    if (payment.status === "submitted" || booking.status === "pending_payment")
      throw conflict();
    throw invalid();
  }
  if (!payment.proofUploadedAt) throw conflict("PAYMENT_DATA_INCOMPLETE");
  const expired = now.getTime() >= payment.proofUploadedAt.getTime() + timeout;
  if (action === "expire") return expired ? "write" : "noop";
  if (expired) throw conflict("PAYMENT_REVIEW_EXPIRED");
  return "write";
}
