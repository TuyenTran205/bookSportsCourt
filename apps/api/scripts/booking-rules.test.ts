import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BadRequestException,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  assertBlocksWithinOpeningHours,
  buildCourtSlotsForDate,
  calculateBlocksPrice,
  calculateDepositAmount,
  evaluateCancellationPreview,
  findMatchingPricingRule,
  isAlignedTo30MinGrid,
  parseHoldInput,
  splitRangeIntoBlocks,
  type OpeningHourRule,
  type PricingRuleRow,
} from "../src/modules/bookings/bookings.rules.js";

const COURT_ID = "019a0000-0004-7000-8000-000000000010";

test("Booking domain rules: 30-min grid validation, input normalization, pricing specificity, slot grid & cancellation policy", async (t) => {
  await t.test("isAlignedTo30MinGrid & parseHoldInput support all 3 input shapes and reject invalid ranges", () => {
    assert.equal(isAlignedTo30MinGrid(new Date("2035-03-05T08:00:00+07:00")), true);
    assert.equal(isAlignedTo30MinGrid(new Date("2035-03-05T08:30:00+07:00")), true);
    assert.equal(isAlignedTo30MinGrid(new Date("2035-03-05T08:15:00+07:00")), false);
    assert.equal(isAlignedTo30MinGrid(new Date("2035-03-05T08:00:01+07:00")), false);

    // Shape 1: Contract { courtId, start, end }
    const s1 = parseHoldInput(
      {
        courtId: COURT_ID,
        start: "2035-03-05T08:00:00+07:00",
        end: "2035-03-05T09:30:00+07:00",
        note: "  Đặt sân tập luyện  ",
      },
      "idem-header-001",
    );
    assert.equal(s1.courtId, COURT_ID);
    assert.equal(s1.blocks, 3);
    assert.equal(s1.idempotencyKey, "idem-header-001");
    assert.equal(s1.note, "Đặt sân tập luyện");

    // Shape 2: Frontend { courtId, slots, idempotencyKey }
    const s2 = parseHoldInput({
      courtId: COURT_ID,
      slots: [
        { start: "2035-03-05T08:30:00+07:00", end: "2035-03-05T09:00:00+07:00" },
        { start: "2035-03-05T08:00:00+07:00", end: "2035-03-05T08:30:00+07:00" },
      ],
      idempotencyKey: "idem-body-002",
    });
    assert.equal(s2.blocks, 2);
    assert.equal(s2.idempotencyKey, "idem-body-002");
    assert.equal(s2.start.toISOString(), new Date("2035-03-05T08:00:00+07:00").toISOString());
    assert.equal(s2.end.toISOString(), new Date("2035-03-05T09:00:00+07:00").toISOString());

    // Shape 3: Prompt { courtId, startAt, blocks }
    const s3 = parseHoldInput(
      {
        courtId: COURT_ID,
        startAt: "2035-03-05T18:00:00+07:00",
        blocks: 4,
      },
      "idem-header-003",
    );
    assert.equal(s3.blocks, 4);
    assert.equal(s3.end.toISOString(), new Date("2035-03-05T20:00:00+07:00").toISOString());

    // Reject non-contiguous slots
    assert.throws(
      () =>
        parseHoldInput({
          courtId: COURT_ID,
          slots: [
            { start: "2035-03-05T08:00:00+07:00", end: "2035-03-05T08:30:00+07:00" },
            { start: "2035-03-05T09:00:00+07:00", end: "2035-03-05T09:30:00+07:00" },
          ],
        }),
      BadRequestException,
    );

    // Reject off-grid timestamps (:15)
    assert.throws(
      () =>
        parseHoldInput({
          courtId: COURT_ID,
          start: "2035-03-05T08:15:00+07:00",
          end: "2035-03-05T09:00:00+07:00",
        }),
      BadRequestException,
    );
  });

  await t.test("Pricing specificity: dateOverride > dayOfWeek > general rule regardless of priority, and throws when missing", () => {
    const rules: PricingRuleRow[] = [
      {
        id: "r-general",
        courtId: COURT_ID,
        name: "Giá chung",
        pricePerSlot: 60000,
        startTime: "06:00",
        endTime: "22:00",
        dayOfWeek: null,
        dateOverride: null,
        priority: 100, // Priority rất cao nhưng là rule chung (specificity = 1)
      },
      {
        id: "r-weekday-evening",
        courtId: COURT_ID,
        name: "Tối thứ Hai",
        pricePerSlot: 90000,
        startTime: "17:00",
        endTime: "22:00",
        dayOfWeek: [1], // Thứ Hai (specificity = 2)
        dateOverride: null,
        priority: 5,
      },
      {
        id: "r-holiday",
        courtId: COURT_ID,
        name: "Ngày lễ đặc biệt",
        pricePerSlot: 150000,
        startTime: "06:00",
        endTime: "22:00",
        dayOfWeek: null,
        dateOverride: "2035-03-05", // Specificity = 3
        priority: 1,
      },
    ];

    // 2035-03-05 là Thứ Hai: dateOverride phải thắng cả dayOfWeek và general rule
    const holidayBlocks = splitRangeIntoBlocks(
      new Date("2035-03-05T18:00:00+07:00"),
      new Date("2035-03-05T19:00:00+07:00"),
    );
    const holidayPrice = calculateBlocksPrice(rules, holidayBlocks);
    assert.equal(holidayPrice.totalPrice, 300000);

    // 2035-03-12 là Thứ Hai thường: dayOfWeek thắng general rule (18:00-19:00 = 2 * 90k = 180k)
    const mondayBlocks = splitRangeIntoBlocks(
      new Date("2035-03-12T18:00:00+07:00"),
      new Date("2035-03-12T19:00:00+07:00"),
    );
    const mondayPrice = calculateBlocksPrice(rules, mondayBlocks);
    assert.equal(mondayPrice.totalPrice, 180000);
    assert.equal(calculateDepositAmount(mondayPrice.totalPrice, 50), 90000);

    // Khung giờ ngoài 06:00-22:00 không có rule giá -> bắt buộc ném 422 PRICING_RULE_NOT_FOUND
    const uncoveredBlocks = splitRangeIntoBlocks(
      new Date("2035-03-12T22:00:00+07:00"),
      new Date("2035-03-12T23:00:00+07:00"),
    );
    assert.throws(
      () => calculateBlocksPrice(rules, uncoveredBlocks),
      UnprocessableEntityException,
    );
  });

  await t.test("Opening hours validation & slot grid status transitions", () => {
    const openingHours: OpeningHourRule[] = [
      { dayOfWeek: 1, openTime: "06:00", closeTime: "08:00" },
    ];
    const validBlocks = splitRangeIntoBlocks(
      new Date("2035-03-12T06:00:00+07:00"),
      new Date("2035-03-12T08:00:00+07:00"),
    );
    assert.doesNotThrow(() =>
      assertBlocksWithinOpeningHours(validBlocks, openingHours),
    );

    const outOfHoursBlocks = splitRangeIntoBlocks(
      new Date("2035-03-12T07:30:00+07:00"),
      new Date("2035-03-12T08:30:00+07:00"),
    );
    assert.throws(
      () => assertBlocksWithinOpeningHours(outOfHoursBlocks, openingHours),
      BadRequestException,
    );

    const now = new Date("2035-03-12T06:15:00+07:00");
    const slots = buildCourtSlotsForDate({
      dateStr: "2035-03-12",
      openingHours,
      pricingRules: [
        {
          id: "r1",
          courtId: COURT_ID,
          name: "Sáng",
          pricePerSlot: 70000,
          startTime: "06:00",
          endTime: "08:00",
          dayOfWeek: [1],
          dateOverride: null,
          priority: 1,
        },
      ],
      bookings: [
        {
          id: "b-held-mine",
          customerId: "user-1",
          status: "held",
          start: new Date("2035-03-12T06:30:00+07:00"),
          end: new Date("2035-03-12T07:00:00+07:00"),
          expiresAt: new Date("2035-03-12T06:25:00+07:00"),
        },
      ],
      blackouts: [
        {
          start: new Date("2035-03-12T07:00:00+07:00"),
          end: new Date("2035-03-12T07:30:00+07:00"),
        },
      ],
      currentUserId: "user-1",
      now,
    });

    assert.equal(slots.length, 4);
    assert.equal(slots[0]!.status, "past"); // 06:00-06:30 (start <= 06:15)
    assert.equal(slots[1]!.status, "held"); // 06:30-07:00
    assert.equal(slots[1]!.mine, true);
    assert.equal(slots[2]!.status, "blocked"); // 07:00-07:30
    assert.equal(slots[3]!.status, "available"); // 07:30-08:00
  });

  await t.test("Cancellation policy preview enforces 24h rule and computes refund", () => {
    const start = new Date("2035-03-15T10:00:00+07:00");
    const policy = { cancelBeforeHours: 24, refundPercent: 80, depositPercent: 50 };

    // 25 hours before start -> allowed, 80% refund
    const early = evaluateCancellationPreview({
      bookingStatus: "confirmed",
      bookingStart: start,
      bookingExpiresAt: null,
      depositAmount: 100000,
      paymentStatus: "completed",
      paymentAmount: 100000,
      policy,
      now: new Date("2035-03-14T09:00:00+07:00"),
    });
    assert.equal(early.canCancel, true);
    assert.equal(early.refundAmount, 80000);

    // 12 hours before start -> not allowed for customer
    const late = evaluateCancellationPreview({
      bookingStatus: "confirmed",
      bookingStart: start,
      bookingExpiresAt: null,
      depositAmount: 100000,
      paymentStatus: "completed",
      paymentAmount: 100000,
      policy,
      now: new Date("2035-03-14T22:00:00+07:00"),
    });
    assert.equal(late.canCancel, false);
    assert.equal(late.refundAmount, 0);
  });
});
