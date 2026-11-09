import type { SchemaObject } from "@nestjs/swagger/dist/interfaces/open-api-spec.interface.js";
import { OWNER_APPLICATION_STATUSES } from "../../../../../packages/shared/src/constants.js";
const id: SchemaObject = { type: "string", format: "uuid" };
const text: SchemaObject = { type: "string", nullable: true };
const date: SchemaObject = { type: "string", format: "date-time" };
export const applicationViewOpenApi: SchemaObject = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "userId",
    "businessName",
    "phone",
    "address",
    "note",
    "taxCode",
    "status",
    "reviewNote",
    "reviewedBy",
    "reviewedAt",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    id,
    userId: id,
    businessName: { type: "string" },
    phone: { type: "string" },
    address: { type: "string" },
    note: text,
    taxCode: text,
    status: { type: "string", enum: [...OWNER_APPLICATION_STATUSES] },
    reviewNote: text,
    reviewedBy: { ...id, nullable: true },
    reviewedAt: { ...date, nullable: true },
    createdAt: date,
    updatedAt: date,
  },
};
export const applicationResponseOpenApi: SchemaObject = {
  type: "object",
  additionalProperties: false,
  required: ["data"],
  properties: { data: applicationViewOpenApi },
};
export const applicationListOpenApi: SchemaObject = {
  type: "object",
  additionalProperties: false,
  required: ["data", "meta"],
  properties: {
    data: { type: "array", items: applicationViewOpenApi },
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
export const applicationInputOpenApi: SchemaObject = {
  type: "object",
  additionalProperties: false,
  required: ["businessName", "phone", "address"],
  properties: {
    businessName: { type: "string", minLength: 2, maxLength: 200 },
    phone: {
      type: "string",
      description: "Vietnamese phone normalized to 10 digits",
    },
    address: { type: "string", minLength: 5, maxLength: 500 },
    note: { type: "string", maxLength: 1000 },
    taxCode: { type: "string", pattern: "^([0-9]{10}|[0-9]{13})$" },
  },
};
export const applicationDecisionOpenApi: SchemaObject = {
  type: "object",
  additionalProperties: false,
  required: ["status"],
  properties: {
    status: { type: "string", enum: ["approved", "rejected"] },
    reviewNote: { type: "string", minLength: 1, maxLength: 500 },
  },
  oneOf: [
    { properties: { status: { type: "string", enum: ["approved"] } } },
    {
      required: ["reviewNote"],
      properties: { status: { type: "string", enum: ["rejected"] } },
    },
  ],
};
