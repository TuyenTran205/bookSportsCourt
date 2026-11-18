import type { SchemaObject } from "@nestjs/swagger/dist/interfaces/open-api-spec.interface.js";
import {
  BOOKING_STATUSES,
  PAYMENT_PROVIDERS,
  PAYMENT_STATUSES,
} from "../../../../../packages/shared/src/constants.js";
const id: SchemaObject = { type: "string", format: "uuid" };
const nullableText: SchemaObject = { type: "string", nullable: true };
const date: SchemaObject = { type: "string", format: "date-time" };
const nullableDate: SchemaObject = { ...date, nullable: true };
const money: SchemaObject = {
  type: "integer",
  minimum: 0,
  maximum: Number.MAX_SAFE_INTEGER,
};
export const paymentViewOpenApi: SchemaObject = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "bookingId",
    "provider",
    "amount",
    "transferCode",
    "bankAccount",
    "status",
    "bookingStatus",
    "proofUrl",
    "proofUrlExpiresAt",
    "proofUploadedAt",
    "proofUpdatedAt",
    "reviewDeadline",
    "reviewedBy",
    "reviewedAt",
    "rejectReason",
    "paidAt",
    "refundAmount",
    "refundedAt",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    id,
    bookingId: id,
    provider: { type: "string", enum: [...PAYMENT_PROVIDERS] },
    amount: money,
    transferCode: nullableText,
    bankAccount: {
      oneOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["bankBin", "accountNo", "accountName"],
          properties: {
            bankBin: { type: "string", pattern: "^[0-9]{6}$" },
            accountNo: { type: "string", pattern: "^[0-9]{6,30}$" },
            accountName: { type: "string", minLength: 2, maxLength: 200 },
          },
        },
        { type: "object", nullable: true, enum: [null] },
      ],
    },
    status: { type: "string", enum: [...PAYMENT_STATUSES] },
    bookingStatus: { type: "string", enum: [...BOOKING_STATUSES] },
    proofUrl: { type: "string", format: "uri", nullable: true },
    proofUrlExpiresAt: nullableDate,
    proofUploadedAt: nullableDate,
    proofUpdatedAt: nullableDate,
    reviewDeadline: nullableDate,
    reviewedBy: { ...id, nullable: true },
    reviewedAt: nullableDate,
    rejectReason: nullableText,
    paidAt: nullableDate,
    refundAmount: { ...money, nullable: true },
    refundedAt: nullableDate,
    createdAt: date,
    updatedAt: date,
  },
};
export const paymentResponseOpenApi: SchemaObject = {
  type: "object",
  additionalProperties: false,
  required: ["data"],
  properties: { data: paymentViewOpenApi },
};
export const ownerPaymentsResponseOpenApi: SchemaObject = {
  type: "object",
  additionalProperties: false,
  required: ["data", "meta"],
  properties: {
    data: {
      type: "array",
      items: {
        ...paymentViewOpenApi,
        required: [
          ...paymentViewOpenApi.required!,
          "venueId",
          "courtId",
          "bookingStart",
          "bookingEnd",
          "customerId",
        ],
        properties: {
          ...paymentViewOpenApi.properties,
          venueId: id,
          venueName: { type: "string", nullable: true },
          courtId: id,
          courtName: { type: "string", nullable: true },
          bookingStart: date,
          bookingEnd: date,
          bookingTotalPrice: { type: "integer", minimum: 0 },
          customerId: { ...id, nullable: true },
          customerName: { type: "string", nullable: true },
          customerPhone: { type: "string", nullable: true },
        },
      },
    },
    meta: {
      type: "object",
      additionalProperties: false,
      required: ["page", "limit", "total", "totalPages"],
      properties: {
        page: { type: "integer", minimum: 1 },
        limit: { type: "integer", minimum: 1, maximum: 100 },
        total: { type: "integer", minimum: 0 },
        totalPages: { type: "integer", minimum: 0 },
      },
    },
  },
};
export const bankAccountOpenApi = (
  paymentViewOpenApi.properties!.bankAccount! as SchemaObject
).oneOf![0] as SchemaObject;
