import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException } from "@nestjs/common";
import { VENUE_STATUSES } from "../../../packages/shared/src/constants.js";
import { moderateVenue } from "../src/modules/venues/venue-moderation.js";

test("all sixteen moderation transitions follow the agreed state machine", () => {
  const allowed = new Set([
    "pending:approved",
    "pending:rejected",
    "approved:suspended",
    "suspended:pending",
  ]);
  for (const from of VENUE_STATUSES)
    for (const to of VENUE_STATUSES) {
      const input = {
        status: to,
        ...(to === "rejected" ? { reason: "Reason" } : {}),
      };
      if (from === to || allowed.has(`${from}:${to}`)) {
        const result = moderateVenue(
          from,
          from === "rejected" ? "Reason" : null,
          input,
        );
        assert.equal(result.changed, from !== to);
        assert.equal(result.status, to);
      } else
        assert.throws(
          () =>
            moderateVenue(from, from === "rejected" ? "Reason" : null, input),
          BadRequestException,
        );
    }
});
