import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { HttpException } from "@nestjs/common";
import { reviewDecision } from "../src/modules/payments/payment-review.rules.js";
import type { bookings, payments } from "../src/database/schema/index.js";

test("review deadline boundary, invalid pairs and terminal retry business rules", () => {
  const first = new Date("2026-01-01T00:00:00Z"),
    timeout = 7200000;
  const booking = { status: "pending_payment" } as typeof bookings.$inferSelect;
  const payment = {
    status: "submitted",
    provider: "bank_transfer",
    proofUploadedAt: first,
  } as typeof payments.$inferSelect;
  const decide = (action: "approve" | "reject" | "expire", offset: number) =>
    reviewDecision(
      booking,
      payment,
      action,
      "reason",
      new Date(first.getTime() + offset),
      timeout,
    );
  assert.equal(decide("approve", timeout - 1), "write");
  assert.equal(decide("expire", timeout - 1), "noop");
  assert.equal(decide("expire", timeout), "write");
  assert.throws(
    () => decide("approve", timeout),
    (error: unknown) =>
      error instanceof HttpException &&
      error.getStatus() === 409 &&
      (error.getResponse() as { code: string }).code ===
        "PAYMENT_REVIEW_EXPIRED",
  );
  payment.proofUploadedAt = null;
  assert.throws(() => decide("expire", 0), /current state/);
  payment.proofUploadedAt = first;
  payment.status = "completed";
  booking.status = "confirmed";
  assert.throws(() => decide("approve", timeout + 1)); // No fabricated legacy review metadata.
  payment.reviewedBy = "reviewer";
  payment.reviewedAt = first;
  payment.paidAt = first;
  for (const status of [
    "confirmed",
    "completed",
    "no_show",
    "cancelled",
  ] as const) {
    booking.status = status;
    assert.equal(decide("approve", timeout + 1), "noop");
  }
  booking.status = "held";
  assert.throws(() => decide("approve", 0));
  booking.status = "pending_payment";
  payment.status = "submitted";
  payment.provider = "cash";
  assert.throws(
    () => decide("approve", 0),
    (error) => error instanceof HttpException && error.getStatus() === 400,
  );
});
