import type { SchemaObject } from "@nestjs/swagger/dist/interfaces/open-api-spec.interface.js";
import {
  USER_ROLES,
  USER_STATUSES,
} from "../../../../../packages/shared/src/constants.js";
const date: SchemaObject = { type: "string", format: "date-time" };
export const userListItem: SchemaObject = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "fullName",
    "email",
    "phoneMasked",
    "avatarUrl",
    "role",
    "status",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    id: { type: "string", format: "uuid" },
    fullName: { type: "string" },
    email: { type: "string", format: "email" },
    phoneMasked: { type: "string", nullable: true },
    avatarUrl: { type: "string", nullable: true },
    role: { type: "string", enum: [...USER_ROLES] },
    status: { type: "string", enum: [...USER_STATUSES] },
    createdAt: date,
    updatedAt: date,
  },
};
export const userDetail: SchemaObject = {
  ...userListItem,
  required: [...userListItem.required!, "phone", "emailVerifiedAt"],
  properties: {
    ...userListItem.properties,
    phone: { type: "string", nullable: true },
    emailVerifiedAt: { ...date, nullable: true },
  },
};
export const userDetailResponse: SchemaObject = {
  type: "object",
  additionalProperties: false,
  required: ["data"],
  properties: { data: userDetail },
};
export const userListResponse: SchemaObject = {
  type: "object",
  additionalProperties: false,
  required: ["data", "meta"],
  properties: {
    data: { type: "array", items: userListItem },
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
