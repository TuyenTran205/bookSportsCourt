import assert from "node:assert/strict";
import { test } from "node:test";
import { UnprocessableEntityException } from "@nestjs/common";
import { assertReviewAllowed } from "../src/modules/reviews/review.rules.js";
import { BOOKING_STATUSES } from "../../../packages/shared/src/constants.js";

test("review eligibility covers every shared booking status and Customer ownership", () => {
  for (const status of BOOKING_STATUSES) {
    if (status === "completed")
      assert.doesNotThrow(() =>
        assertReviewAllowed({ customerId: "actor", status }, "actor"),
      );
    else
      assert.throws(
        () => assertReviewAllowed({ customerId: "actor", status }, "actor"),
        UnprocessableEntityException,
      );
  }
  for (const row of [
    null,
    { customerId: null, status: "completed" },
    { customerId: "other", status: "completed" },
  ]) {
    assert.throws(
      () => assertReviewAllowed(row, "actor"),
      UnprocessableEntityException,
    );
  }
});
