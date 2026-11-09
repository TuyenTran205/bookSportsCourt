import assert from "node:assert/strict";
import { test } from "node:test";
import { inspectPhase4Contract } from "./phase4-contract.js";

test("Phase 4 implemented operations match runtime metadata; missing routes remain explicit blockers", async () => {
  const report = await inspectPhase4Contract();
  assert.equal(report.operations, 25);
  assert.equal(report.paths, 24);
  assert.deepEqual(report.discrepancies, []);
  assert.deepEqual(report.pending, [
    "Missing runtime path /api/v1/owner/payments/{id}/refund",
  ]);
  assert.ok(report.designRefs > 0);
});
