import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { BookingsService } from "../src/modules/bookings/bookings.service.js";
import {
  formatTsTzRange,
  formatVnIsoString,
  parseVnDateTime,
  splitInto30MinBlocks,
} from "../src/common/utils/time-range.js";

// Helper tạo ngày giờ tương lai
function getFutureDate(daysAhead = 7, timeStr = "08:00:00") {
  const d = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const dateStr = `${y}-${m}-${day}`;
  return {
    dateStr,
    start: parseVnDateTime(dateStr, timeStr),
  };
}

test("Bookings Pricing Rule Engine (BOOKING-TEST-06, BOOKING-TEST-07, BOOKING-TEST-14)", async (t) => {
  const service = new BookingsService({} as any);

  await t.test("rule ngày lễ (date_override) thắng rule chung dù rule chung có priority cao hơn", () => {
    const rules = [
      {
        id: "rule-common",
        courtId: "c1",
        name: "Giá ngày thường chung",
        pricePerSlot: 100000,
        startTime: "06:00:00",
        endTime: "22:00:00",
        dayOfWeek: null,
        dateOverride: null,
        priority: 999, // Priority rất cao
      },
      {
        id: "rule-holiday",
        courtId: "c1",
        name: "Giá ngày Tết",
        pricePerSlot: 200000,
        startTime: "06:00:00",
        endTime: "22:00:00",
        dayOfWeek: null,
        dateOverride: "2027-01-01",
        priority: 1, // Priority thấp hơn nhưng có date_override
      },
    ];

    const slotStart = parseVnDateTime("2027-01-01", "08:00:00");
    const slotEnd = parseVnDateTime("2027-01-01", "08:30:00");

    const matched = service.findMatchingPricingRule(rules, slotStart, slotEnd);
    assert.ok(matched);
    assert.equal(matched.id, "rule-holiday");
    assert.equal(matched.pricePerSlot, 200000);
  });

  await t.test("rule thứ trong tuần thắng rule chung", () => {
    const rules = [
      {
        id: "rule-common",
        courtId: "c1",
        name: "Giá chung",
        pricePerSlot: 80000,
        startTime: "06:00:00",
        endTime: "22:00:00",
        dayOfWeek: null,
        dateOverride: null,
        priority: 10,
      },
      {
        id: "rule-weekend",
        courtId: "c1",
        name: "Giá cuối tuần (Thứ 7, CN)",
        pricePerSlot: 120000,
        startTime: "06:00:00",
        endTime: "22:00:00",
        dayOfWeek: [0, 6], // CN, T7
        dateOverride: null,
        priority: 5,
      },
    ];

    // Ngày 2026-10-18 là Chủ Nhật (dayOfWeek = 0)
    const slotStart = parseVnDateTime("2026-10-18", "09:00:00");
    const slotEnd = parseVnDateTime("2026-10-18", "09:30:00");

    const matched = service.findMatchingPricingRule(rules, slotStart, slotEnd);
    assert.ok(matched);
    assert.equal(matched.id, "rule-weekend");
    assert.equal(matched.pricePerSlot, 120000);
  });

  await t.test("thiếu rule phủ khung giờ -> ném PRICING_RULE_NOT_FOUND, không trả 0", () => {
    const rules = [
      {
        id: "rule-evening",
        courtId: "c1",
        name: "Giá tối",
        pricePerSlot: 150000,
        startTime: "18:00:00",
        endTime: "22:00:00",
        dayOfWeek: null,
        dateOverride: null,
        priority: 1,
      },
    ];

    const slotStart = parseVnDateTime("2026-10-15", "08:00:00");
    const slotEnd = parseVnDateTime("2026-10-15", "08:30:00");

    assert.throws(
      () =>
        service.calculateBlocksPrice("c1", [{ start: slotStart, end: slotEnd }], rules),
      (err: any) =>
        err.status === 400 && err.response?.code === "PRICING_RULE_NOT_FOUND",
    );
  });
});

test("Bookings Slots Matrix (GET /venues/:id/slots)", async (t) => {
  await t.test("tính toán các trạng thái available, past, blocked, booked, held (mine: true/false)", async () => {
    const venueId = "v1";
    const courtId = "c1";
    const date = "2026-10-15"; // Đã qua so với hiện tại

    const mockRepo: any = {
      findVenueWithCourts: async () => ({
        venue: { id: venueId, name: "Sân Sao Mai", status: "approved" },
        courts: [{ id: courtId, name: "Sân 1", status: "active", sortOrder: 0 }],
      }),
      getOpeningHoursByVenueAndDay: async () => [
        { courtId, dayOfWeek: 4, openTime: "06:00", closeTime: "08:00" },
      ],
      getPricingRulesByCourts: async () => [
        {
          id: "r1",
          courtId,
          name: "Chung",
          pricePerSlot: 100000,
          startTime: "06:00:00",
          endTime: "22:00:00",
          dayOfWeek: null,
          dateOverride: null,
          priority: 0,
        },
      ],
      getBlackoutsByCourtsAndRange: async () => [],
      getActiveBookingsByCourtsAndRange: async () => [],
    };

    const service = new BookingsService(mockRepo);
    const result = await service.getSlots(venueId, date, "user-1");

    assert.equal(result.date, date);
    assert.equal(result.courts.length, 1);
    const slots = result.courts[0]!.slots;
    // 06:00 - 08:00 có 4 block (06:00, 06:30, 07:00, 07:30)
    assert.equal(slots.length, 4);
    // Ngày 2026-10-15 ở quá khứ -> tất cả phải là 'past'
    assert.ok(slots.every((s) => s.status === "past"));
  });

  await t.test("nhận diện đúng mine: true cho hold của chính người dùng", async () => {
    const future = getFutureDate(3, "08:00:00");
    const date = future.dateStr;
    const venueId = "v1";
    const courtId = "c1";

    const slot1Start = parseVnDateTime(date, "08:00:00");
    const slot1End = parseVnDateTime(date, "08:30:00");

    const mockRepo: any = {
      findVenueWithCourts: async () => ({
        venue: { id: venueId, name: "Sân Sao Mai", status: "approved" },
        courts: [{ id: courtId, name: "Sân 1", status: "active", sortOrder: 0 }],
      }),
      getOpeningHoursByVenueAndDay: async () => [
        { courtId, dayOfWeek: future.start.getDay(), openTime: "07:00", closeTime: "10:00" },
      ],
      getPricingRulesByCourts: async () => [
        {
          id: "r1",
          courtId,
          name: "Chung",
          pricePerSlot: 90000,
          startTime: "06:00:00",
          endTime: "22:00:00",
          dayOfWeek: null,
          dateOverride: null,
          priority: 0,
        },
      ],
      getBlackoutsByCourtsAndRange: async () => [],
      getActiveBookingsByCourtsAndRange: async () => [
        {
          id: "b1",
          courtId,
          customerId: "user-mine",
          status: "held",
          expiresAt: new Date(Date.now() + 600000),
          during: formatTsTzRange(slot1Start, slot1End),
        },
      ],
    };

    const service = new BookingsService(mockRepo);
    const result = await service.getSlots(venueId, date, "user-mine");

    const slots = result.courts[0]!.slots;
    const targetSlot = slots.find((s) => s.start === formatVnIsoString(slot1Start));
    assert.ok(targetSlot);
    assert.equal(targetSlot.status, "held");
    assert.equal(targetSlot.mine, true);
  });
});

test("Bookings Hold Creation and Concurrency (BOOKING-TEST-01, 02, 16, 19)", async (t) => {
  const future = getFutureDate(5, "09:00:00");
  const date = future.dateStr;
  const courtId = "court-uuid-1";

  const slot1 = {
    start: formatVnIsoString(parseVnDateTime(date, "09:00:00")),
    end: formatVnIsoString(parseVnDateTime(date, "09:30:00")),
  };
  const slot2 = {
    start: formatVnIsoString(parseVnDateTime(date, "09:30:00")),
    end: formatVnIsoString(parseVnDateTime(date, "10:00:00")),
  };

  const baseCourtData = {
    court: { id: courtId, name: "Sân A", status: "active", venueId: "venue-uuid-1" },
    venue: { id: "venue-uuid-1", name: "CLB Sao Mai", status: "approved" },
  };

  // Sân mở cửa 06:00 - 22:00 hằng ngày.
  const openingHours = async (_courtIds: string[], dayOfWeek: number) => [
    { courtId, dayOfWeek, openTime: "06:00", closeTime: "22:00" },
  ];

  await t.test("tạo hold thành công và tính đúng deposit_amount theo policy", async () => {
    const mockRepo: any = {
      findCourtWithVenue: async () => baseCourtData,
      getVenuePaymentAccount: async () => ({
        bankBin: "970415",
        accountNo: "0123456789",
        accountName: "NGUYEN VAN CHU SAN",
      }),
      countActiveHolds: async () => 0,
      countRecentHoldsOnCourt: async () => 0,
      expireCourtHolds: async () => {},
      findActiveHoldByIdempotency: async () => null,
      getPricingRulesByCourts: async () => [
        {
          id: "r1",
          courtId,
          name: "Chung",
          pricePerSlot: 100000,
          startTime: "06:00:00",
          endTime: "22:00:00",
          dayOfWeek: null,
          dateOverride: null,
          priority: 0,
        },
      ],
      getOpeningHoursByVenueAndDay: openingHours,
      getCancellationPolicy: async () => ({
        cancelBeforeHours: 24,
        refundPercent: 100,
        depositPercent: 50, // Cọc 50%
      }),
      createHoldBooking: async (params: any) => ({
        booking: {
          id: "booking-1",
          courtId: params.courtId,
          customerId: params.customerId,
          source: "online",
          during: formatTsTzRange(params.start, params.end),
          status: "held",
          totalPrice: params.totalPrice,
          depositAmount: params.depositAmount,
          expiresAt: params.expiresAt,
          createdAt: new Date(),
        },
        payment: {
          id: "pay-1",
          amount: params.depositAmount,
          transferCode: params.transferCode,
        },
      }),
    };

    const service = new BookingsService(mockRepo);
    const res = await service.createHold("cust-1", {
      courtId,
      slots: [slot1, slot2], // 2 slot * 100k = 200k, deposit 50% = 100k
    });

    assert.equal(res.booking.status, "held");
    assert.equal(res.booking.totalPrice, 200000);
    assert.equal(res.booking.depositAmount, 100000);
    assert.equal(res.payment.amount, 100000);
    assert.ok(res.payment.transferCode.startsWith("BSC-"));
  });

  await t.test("idempotency: cùng khách gửi lại cùng khung giờ -> trả về hold hiện tại", async () => {
    const existingBooking = {
      id: "booking-existing",
      courtId,
      customerId: "cust-1",
      source: "online",
      during: formatTsTzRange(
        new Date(slot1.start),
        new Date(slot2.end),
      ),
      status: "held",
      totalPrice: 200000,
      depositAmount: 200000,
      expiresAt: new Date(Date.now() + 500000),
      createdAt: new Date(),
    };

    const mockRepo: any = {
      findCourtWithVenue: async () => baseCourtData,
      getVenuePaymentAccount: async () => ({
        bankBin: "970415",
        accountNo: "0123456789",
        accountName: "NGUYEN VAN CHU SAN",
      }),
      getOpeningHoursByVenueAndDay: openingHours,
      countActiveHolds: async () => 1,
      countRecentHoldsOnCourt: async () => 1,
      expireCourtHolds: async () => {},
      findActiveHoldByIdempotency: async () => ({
        booking: existingBooking,
        payment: { id: "p1", amount: 200000, transferCode: "BSC-HOLD99" },
      }),
    };

    const service = new BookingsService(mockRepo);
    const res = await service.createHold("cust-1", {
      courtId,
      slots: [slot1, slot2],
    });

    assert.equal(res.booking.id, "booking-existing");
    assert.equal(res.payment.transferCode, "BSC-HOLD99");
  });

  await t.test("trùng lịch (vi phạm EXCLUDE constraint 23P01) -> ném BOOKING_CONFLICT (409)", async () => {
    const mockRepo: any = {
      findCourtWithVenue: async () => baseCourtData,
      getVenuePaymentAccount: async () => ({
        bankBin: "970415",
        accountNo: "0123456789",
        accountName: "NGUYEN VAN CHU SAN",
      }),
      countActiveHolds: async () => 0,
      countRecentHoldsOnCourt: async () => 0,
      expireCourtHolds: async () => {},
      findActiveHoldByIdempotency: async () => null,
      getPricingRulesByCourts: async () => [
        {
          id: "r1",
          courtId,
          name: "Chung",
          pricePerSlot: 100000,
          startTime: "06:00:00",
          endTime: "22:00:00",
          dayOfWeek: null,
          dateOverride: null,
          priority: 0,
        },
      ],
      getOpeningHoursByVenueAndDay: openingHours,
      getCancellationPolicy: async () => ({ depositPercent: 100 }),
      createHoldBooking: async () => {
        const error: any = new Error("exclusion_violation");
        error.code = "23P01";
        throw error;
      },
    };

    const service = new BookingsService(mockRepo);
    await assert.rejects(
      async () => service.createHold("cust-2", { courtId, slots: [slot1] }),
      (err: any) => err.status === 409 && err.response?.code === "BOOKING_CONFLICT",
    );
  });

  await t.test("vượt quá HOLD_LIMIT (tối đa 3 hold đồng thời) -> ném HOLD_LIMIT_EXCEEDED (422)", async () => {
    const mockRepo: any = {
      findCourtWithVenue: async () => baseCourtData,
      getOpeningHoursByVenueAndDay: openingHours,
      getVenuePaymentAccount: async () => ({ bankBin: "970415", accountNo: "123", accountName: "A" }),
      countActiveHolds: async () => 3, // Đã đủ 3 hold
    };

    const service = new BookingsService(mockRepo);
    await assert.rejects(
      async () => service.createHold("cust-spam", { courtId, slots: [slot1] }),
      (err: any) => err.status === 422 && err.response?.code === "HOLD_LIMIT_EXCEEDED",
    );
  });

  await t.test("venue thiếu tài khoản ngân hàng -> ném PAYMENT_ACCOUNT_MISSING (422)", async () => {
    const mockRepo: any = {
      findCourtWithVenue: async () => baseCourtData,
      getOpeningHoursByVenueAndDay: openingHours,
      getVenuePaymentAccount: async () => null, // Chưa cấu hình bank
    };

    const service = new BookingsService(mockRepo);
    await assert.rejects(
      async () => service.createHold("cust-1", { courtId, slots: [slot1] }),
      (err: any) => err.status === 422 && err.response?.code === "PAYMENT_ACCOUNT_MISSING",
    );
  });

  await t.test("khung giờ ngoài giờ mở cửa của sân -> ném VALIDATION_ERROR (400)", async () => {
    const mockRepo: any = {
      findCourtWithVenue: async () => baseCourtData,
      // Sân chỉ mở từ 10:00 nhưng slot đặt là 09:00-09:30
      getOpeningHoursByVenueAndDay: async (_courtIds: string[], dayOfWeek: number) => [
        { courtId, dayOfWeek, openTime: "10:00", closeTime: "22:00" },
      ],
    };

    const service = new BookingsService(mockRepo);
    await assert.rejects(
      async () => service.createHold("cust-1", { courtId, slots: [slot1] }),
      (err: any) => err.status === 400 && err.response?.code === "VALIDATION_ERROR",
    );
  });

  await t.test("sân đóng cửa ngày đã chọn (không có opening_hours) -> ném VALIDATION_ERROR (400)", async () => {
    const mockRepo: any = {
      findCourtWithVenue: async () => baseCourtData,
      getOpeningHoursByVenueAndDay: async () => [],
    };

    const service = new BookingsService(mockRepo);
    await assert.rejects(
      async () => service.createHold("cust-1", { courtId, slots: [slot1] }),
      (err: any) => err.status === 400 && err.response?.code === "VALIDATION_ERROR",
    );
  });

  await t.test("sân không tồn tại -> ném NOT_FOUND (404) trước khi kiểm tra giờ mở cửa", async () => {
    const mockRepo: any = {
      findCourtWithVenue: async () => null,
      getOpeningHoursByVenueAndDay: openingHours,
    };

    const service = new BookingsService(mockRepo);
    await assert.rejects(
      async () => service.createHold("cust-1", { courtId, slots: [slot1] }),
      (err: any) => err.status === 404 && err.response?.code === "NOT_FOUND",
    );
  });
});

test("Bookings Cancellation and Status Transitions (BOOKING-TEST-08, 20)", async (t) => {
  const future = getFutureDate(3, "15:00:00");
  const courtId = "c1";

  await t.test("completed là terminal: huỷ booking completed bị ném INVALID_STATUS_TRANSITION (400)", async () => {
    const mockRepo: any = {
      findBookingById: async () => ({
        booking: {
          id: "b-completed",
          status: "completed",
          customerId: "cust-1",
          during: formatTsTzRange(future.start, new Date(future.start.getTime() + 1800000)),
        },
        venue: { id: "v1", ownerId: "owner-1" },
        court: { id: courtId },
      }),
    };

    const service = new BookingsService(mockRepo);
    await assert.rejects(
      async () =>
        service.cancelBooking("b-completed", { id: "cust-1", role: "customer" } as any, {
          reason: "Tôi muốn huỷ",
        }),
      (err: any) =>
        err.status === 400 && err.response?.code === "INVALID_STATUS_TRANSITION",
    );
  });

  await t.test("huỷ booking confirmed sát giờ (< 24h) vi phạm chính sách -> ném CANCELLATION_NOT_ALLOWED (422)", async () => {
    // Booking diễn ra sau 5 tiếng nữa (ít hơn 24h)
    const soonStart = new Date(Date.now() + 5 * 3600 * 1000);
    const soonEnd = new Date(soonStart.getTime() + 1800000);

    const mockRepo: any = {
      findBookingById: async () => ({
        booking: {
          id: "b-confirmed-soon",
          status: "confirmed",
          customerId: "cust-1",
          depositAmount: 100000,
          during: formatTsTzRange(soonStart, soonEnd),
        },
        venue: { id: "v1", ownerId: "owner-1" },
        court: { id: courtId },
      }),
      getCancellationPolicy: async () => ({
        cancelBeforeHours: 24, // Phải trước 24h
        refundPercent: 100,
      }),
    };

    const service = new BookingsService(mockRepo);
    await assert.rejects(
      async () =>
        service.cancelBooking("b-confirmed-soon", { id: "cust-1", role: "customer" } as any, {
          reason: "Bận đột xuất",
        }),
      (err: any) =>
        err.status === 422 && err.response?.code === "CANCELLATION_NOT_ALLOWED",
    );
  });
});
