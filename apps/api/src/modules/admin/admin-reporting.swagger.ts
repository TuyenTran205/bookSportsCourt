import type { SchemaObject } from "@nestjs/swagger/dist/interfaces/open-api-spec.interface.js";
import {
  BOOKING_STATUSES,
  BOOKING_SOURCES,
  USER_ROLES,
  VENUE_STATUSES,
} from "../../../../../packages/shared/src/constants.js";
import { paymentViewOpenApi } from "../payments/payments.swagger.js";
const id: SchemaObject = { type: "string", format: "uuid" },
  date: SchemaObject = { type: "string", format: "date-time" },
  nullableDate: SchemaObject = { ...date, nullable: true },
  nullableText: SchemaObject = { type: "string", nullable: true },
  money: SchemaObject = {
    type: "integer",
    minimum: 0,
    maximum: Number.MAX_SAFE_INTEGER,
  };
const paymentKeys = [
  "id",
  "provider",
  "amount",
  "status",
  "paidAt",
  "refundAmount",
  "refundedAt",
];
const booking: SchemaObject = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "courtId",
    "venueId",
    "customerId",
    "source",
    "guestName",
    "guestPhoneMasked",
    "start",
    "end",
    "status",
    "totalPrice",
    "depositAmount",
    "expiresAt",
    "cancelReason",
    "cancelledAt",
    "createdAt",
    "updatedAt",
    "payment",
  ],
  properties: {
    id,
    courtId: id,
    venueId: id,
    customerId: { ...id, nullable: true },
    source: { type: "string", enum: [...BOOKING_SOURCES] },
    guestName: nullableText,
    guestPhoneMasked: nullableText,
    start: date,
    end: date,
    status: { type: "string", enum: [...BOOKING_STATUSES] },
    totalPrice: money,
    depositAmount: money,
    expiresAt: nullableDate,
    cancelReason: nullableText,
    cancelledAt: nullableDate,
    createdAt: date,
    updatedAt: date,
    payment: {
      type: "object",
      nullable: true,
      additionalProperties: false,
      required: paymentKeys,
      properties: Object.fromEntries(
        paymentKeys.map((key) => [key, paymentViewOpenApi.properties![key]!]),
      ),
    },
  },
};
export const bookingListResponse: SchemaObject = {
  type: "object",
  additionalProperties: false,
  required: ["data", "meta"],
  properties: {
    data: { type: "array", items: booking },
    meta: {
      type: "object",
      additionalProperties: false,
      required: ["page", "limit", "total", "totalPages"],
      properties: {
        page: { type: "integer", minimum: 1 },
        limit: { type: "integer", minimum: 1, maximum: 100 },
        total: money,
        totalPages: money,
      },
    },
  },
};
const counts = (values: readonly string[]): SchemaObject => ({
  type: "object",
  additionalProperties: false,
  required: [...values],
  properties: Object.fromEntries(values.map((value) => [value, money])),
});
const revenue = {
  bookingCountsByStatus: counts(BOOKING_STATUSES),
  grossRevenue: money,
  refundedAmount: money,
  netRevenue: {
    type: "integer",
    minimum: -Number.MAX_SAFE_INTEGER,
    maximum: Number.MAX_SAFE_INTEGER,
  } as SchemaObject,
};
const stats: SchemaObject = {
  type: "object",
  additionalProperties: false,
  required: [
    "generatedAt",
    "from",
    "to",
    "groupBy",
    "summary",
    "series",
    "dataQuality",
  ],
  properties: {
    generatedAt: date,
    from: { type: "string", format: "date" },
    to: { type: "string", format: "date" },
    groupBy: { type: "string", enum: ["day", "week", "month"] },
    summary: {
      type: "object",
      additionalProperties: false,
      required: [
        ...Object.keys(revenue),
        "userCountsByRole",
        "venueCountsByStatus",
      ],
      properties: {
        ...revenue,
        userCountsByRole: counts(USER_ROLES),
        venueCountsByStatus: counts(VENUE_STATUSES),
      },
    },
    series: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", ...Object.keys(revenue)],
        properties: { date: { type: "string", format: "date" }, ...revenue },
      },
    },
    dataQuality: {
      type: "object",
      additionalProperties: false,
      required: ["excludedPaymentCount"],
      properties: { excludedPaymentCount: money },
    },
  },
};
export const statsResponse: SchemaObject = {
  type: "object",
  additionalProperties: false,
  required: ["data"],
  properties: { data: stats },
};
