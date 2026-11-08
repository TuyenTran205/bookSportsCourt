import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  reportRange,
  reportBuckets,
  safeReportInteger,
} from "../src/modules/admin/reporting.rules.js";
test("report periods use Vietnam midnight/month, Monday buckets and exact safe integers", () => {
  const range = reportRange({}, new Date("2035-01-31T17:00:00Z"));
  assert.equal(range.from, "2035-02-01");
  assert.equal(range.to, "2035-02-28");
  const partial = reportRange(
    { from: "2035-01-31", to: "2035-02-06" },
    new Date(),
  );
  assert.deepEqual(reportBuckets(partial, "week"), [
    "2035-01-29",
    "2035-02-05",
  ]);
  assert.deepEqual(reportBuckets(partial, "month"), [
    "2035-01-01",
    "2035-02-01",
  ]);
  assert.equal(safeReportInteger("9007199254740991"), Number.MAX_SAFE_INTEGER);
  assert.equal(
    safeReportInteger("-9007199254740991"),
    -Number.MAX_SAFE_INTEGER,
  );
  assert.throws(() => safeReportInteger("9007199254740992"));
  assert.throws(() => safeReportInteger("-9007199254740992"));
});
