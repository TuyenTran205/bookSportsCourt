import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  aggregateRevenue,
  bucketKey,
  eachDate,
  isRangeOverlapping,
  splitOpenBlocks,
  timeToMinutes,
  topPeakHours,
} from "../src/modules/owner/reporting.rules.js";

test("owner reporting rules (OWN-09/OWN-10)", async (t) => {
  await t.test("eachDate bao gồm cả hai đầu và xử lý năm nhuận", () => {
    assert.deepEqual(eachDate("2028-02-28", "2028-03-01"), [
      "2028-02-28",
      "2028-02-29",
      "2028-03-01",
    ]);
  });

  await t.test("bucket tuần bắt đầu thứ Hai, tháng bắt đầu ngày 01", () => {
    assert.equal(bucketKey("2026-11-10", "day"), "2026-11-10");
    assert.equal(bucketKey("2026-11-10", "week"), "2026-11-09");
    assert.equal(bucketKey("2026-11-10", "month"), "2026-11-01");
    // Chủ nhật thuộc tuần bắt đầu từ thứ Hai trước đó.
    assert.equal(bucketKey("2026-11-15", "week"), "2026-11-09");
  });

  await t.test("aggregateRevenue gộp đúng và bỏ ngày không có dữ liệu", () => {
    const result = aggregateRevenue(
      [
        { date: "2026-11-01", revenue: 100_000, bookings: 1 },
        { date: "2026-11-02", revenue: 250_000, bookings: 2 },
        { date: "2026-11-09", revenue: 50_000, bookings: 1 },
      ],
      "week",
    );
    assert.deepEqual(result, [
      { date: "2026-10-26", revenue: 100_000, bookings: 1 },
      { date: "2026-11-02", revenue: 250_000, bookings: 2 },
      { date: "2026-11-09", revenue: 50_000, bookings: 1 },
    ]);
  });

  await t.test("topPeakHours tính theo giờ Việt Nam", () => {
    // 01:00Z = 08:00 Asia/Ho_Chi_Minh.
    const peak = topPeakHours([
      new Date("2026-11-10T01:00:00.000Z"),
      new Date("2026-11-10T01:00:00.000Z"),
      new Date("2026-11-10T02:00:00.000Z"),
    ]);
    assert.equal(peak[0]?.startTime, "08:00");
    assert.equal(peak[0]?.endTime, "08:30");
    assert.equal(peak[0]?.bookedSlots, 2);
  });

  await t.test("block 30 phút và kiểm tra giao khoảng", () => {
    const blocks = splitOpenBlocks("06:00:00", "07:30:00");
    assert.equal(blocks.length, 3);
    assert.equal(timeToMinutes("06:30:00"), 390);
    assert.equal(
      isRangeOverlapping({ start: 360, end: 390 }, { start: 390, end: 420 }),
      false,
    );
    assert.equal(
      isRangeOverlapping({ start: 360, end: 420 }, { start: 390, end: 450 }),
      true,
    );
  });
});