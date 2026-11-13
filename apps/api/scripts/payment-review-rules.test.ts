import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { HttpException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { AuthService } from "../src/modules/auth/auth.service.js";
import type { ProofStorage } from "../src/modules/uploads/proof-storage.js";
import type { PaymentsService } from "../src/modules/payments/payments.service.js";
import type { PaymentsRepository } from "../src/modules/payments/payments.repository.js";
import { PaymentReviewService } from "../src/modules/payments/payment-review.service.js";
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

test("PaymentReviewService.list forwards status='all' without forcing 'submitted' while preserving omitted default", async () => {
  const seenQueries: Array<{ status: string; page: number; limit: number }> = [];
  const repo = {
    ownerList: async (_ownerId: string, query: { status: string; page: number; limit: number }) => {
      seenQueries.push(query);
      return { total: 0, rows: [] };
    },
  } as unknown as PaymentsRepository;
  const auth = {
    requireActiveUser: async (id: string) => ({ id, role: "owner", status: "active" }),
  } as unknown as AuthService;
  const service = new PaymentReviewService(
    repo,
    auth,
    {} as PaymentsService,
    {} as ProofStorage,
    { get: (_k: string, fallback: number) => fallback } as unknown as ConfigService,
  );

  await service.list("01964a4f-0000-7000-8000-000000000001", {});
  await service.list("01964a4f-0000-7000-8000-000000000001", { status: "all" });

  assert.equal(seenQueries[0]?.status, "submitted");
  assert.equal(seenQueries[1]?.status, "all");
});
