import type { SchemaObject } from "@nestjs/swagger/dist/interfaces/open-api-spec.interface.js";
import { REVIEW_REPORT_STATUSES } from "../../../../../packages/shared/src/constants.js";

const id: SchemaObject = { type: "string", format: "uuid" };
const timestamp: SchemaObject = { type: "string", format: "date-time" };
export const reviewPublicOpenApi: SchemaObject = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "venueId",
    "rating",
    "comment",
    "ownerReply",
    "ownerRepliedAt",
    "createdAt",
  ],
  properties: {
    id,
    venueId: id,
    rating: { type: "integer", minimum: 1, maximum: 5 },
    comment: { type: "string", nullable: true },
    ownerReply: { type: "string", nullable: true },
    ownerRepliedAt: { ...timestamp, nullable: true },
    createdAt: timestamp,
  },
};
export const reviewAdminOpenApi: SchemaObject = {
  ...reviewPublicOpenApi,
  required: [
    ...reviewPublicOpenApi.required!,
    "bookingId",
    "customerId",
    "isVisible",
    "updatedAt",
  ],
  properties: {
    ...reviewPublicOpenApi.properties,
    bookingId: id,
    customerId: id,
    isVisible: { type: "boolean" },
    updatedAt: timestamp,
    venueName: { type: "string", nullable: true },
    customerName: { type: "string", nullable: true },
    reportStatus: { type: "string", enum: [...REVIEW_REPORT_STATUSES] },
    reportReason: { type: "string", nullable: true },
    reportImageUrl: { type: "string", nullable: true },
    reportedAt: { ...timestamp, nullable: true },
  },
};
export const reviewResponse: SchemaObject = {
  type: "object",
  additionalProperties: false,
  required: ["data"],
  properties: { data: reviewAdminOpenApi },
};
export const reviewPageResponse = (admin: boolean): SchemaObject => ({
  type: "object",
  additionalProperties: false,
  required: ["data", "meta"],
  properties: {
    data: {
      type: "array",
      items: admin ? reviewAdminOpenApi : reviewPublicOpenApi,
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
});
