import { applyDecorators } from "@nestjs/common";
import { ApiQuery } from "@nestjs/swagger";
import type { SchemaObject } from "@nestjs/swagger/dist/interfaces/open-api-spec.interface.js";
import { VENUE_STATUSES, COURT_STATUSES } from "../../../../../../packages/shared/src/constants.js";
import type { OwnerVenueResponse } from "../../../../../../packages/shared/src/types.js";

// Documentation only. Runtime validation always uses shared Zod schemas.
const uuid: SchemaObject = { type: "string", format: "uuid" };
const editable: Record<string, SchemaObject> = {
    name: { type: "string", minLength: 2, maxLength: 200 },
    description: { type: "string", maxLength: 5000 },
    address: { type: "string", minLength: 5, maxLength: 500 },
    provinceId: uuid,
    districtId: uuid,
    lat: { type: "number", minimum: -90, maximum: 90 },
    lng: { type: "number", minimum: -180, maximum: 180 },
    sportIds: { type: "array", items: uuid },
    amenityIds: { type: "array", items: uuid },
};
export const createVenueOpenApi: SchemaObject = {
    type: "object",
    additionalProperties: false,
    required: ["name", "address", "provinceId", "districtId", "lat", "lng"],
    properties: {
        ...editable,
        sportIds: { ...editable.sportIds, default: [] },
        amenityIds: { ...editable.amenityIds, default: [] },
    },
};
export const updateVenueOpenApi: SchemaObject = {
    type: "object",
    additionalProperties: false,
    required: [],
    minProperties: 1,
    properties: editable,
};
export const venueStatusOpenApi: SchemaObject = {
    oneOf: [
        {
            type: "object",
            additionalProperties: false,
            required: ["status", "reason"],
            properties: {
                status: {
                    type: "string",
                    enum: VENUE_STATUSES.filter((s) => s === "rejected"),
                },
                reason: { type: "string", minLength: 1, maxLength: 500 },
            },
        },
        {
            type: "object",
            additionalProperties: false,
            required: ["status"],
            properties: {
                status: {
                    type: "string",
                    enum: VENUE_STATUSES.filter((s) => s !== "rejected"),
                },
            },
        },
    ],
};
export const ownerVenueQueryOpenApi: Record<string, SchemaObject> = {
    page: {
        type: "integer",
        minimum: 1,
        maximum: Number.MAX_SAFE_INTEGER,
        default: 1,
    },
    limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
};
export const adminVenueQueryOpenApi: Record<string, SchemaObject> = {
    ...ownerVenueQueryOpenApi,
    status: { type: "string", enum: [...VENUE_STATUSES] },
    q: { type: "string", maxLength: 200 },
};
export function ApiVenueQuery(kind: "owner" | "admin") {
    const fields = kind === "owner" ? ownerVenueQueryOpenApi : adminVenueQueryOpenApi;
    return applyDecorators(
        ...Object.entries(fields).map(([name, schema]) => ApiQuery({ name, required: false, schema })),
    );
}

const string: SchemaObject = { type: "string" };
type BaseOwnerVenueKeys =
    | "id"
    | "ownerId"
    | "slug"
    | "name"
    | "description"
    | "address"
    | "provinceId"
    | "districtId"
    | "lat"
    | "lng"
    | "sportIds"
    | "amenityIds"
    | "status"
    | "rejectionReason"
    | "createdAt"
    | "updatedAt";

const privateProperties = {
    id: uuid,
    ownerId: uuid,
    slug: string,
    name: string,
    description: { ...string, nullable: true },
    address: string,
    provinceId: uuid,
    districtId: uuid,
    lat: { type: "number", nullable: true },
    lng: { type: "number", nullable: true },
    sportIds: { type: "array", items: uuid },
    amenityIds: { type: "array", items: uuid },
    status: { type: "string", enum: [...VENUE_STATUSES] },
    rejectionReason: { ...string, nullable: true, maxLength: 500 },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
} satisfies Record<BaseOwnerVenueKeys, SchemaObject>;
export const privateVenueOpenApi: SchemaObject = {
    type: "object",
    additionalProperties: false,
    properties: privateProperties,
    required: Object.keys(privateProperties),
};

export const privateVenueResponseOpenApi: SchemaObject = {
    type: "object",
    additionalProperties: false,
    required: ["data"],
    properties: { data: privateVenueOpenApi },
};
export const privateVenueListResponseOpenApi: SchemaObject = {
    type: "object",
    additionalProperties: false,
    required: ["data", "meta"],
    properties: {
        data: { type: "array", items: privateVenueOpenApi },
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

export const publicVenueResponseOpenApi: SchemaObject = {
    type: "object",
    additionalProperties: false,
    required: ["data"],
    properties: {
        data: {
            type: "object",
            additionalProperties: false,
            properties: {
                id: {
                    type: "string",
                    format: "uuid",
                },
                name: {
                    type: "string",
                },
                slug: {
                    type: "string",
                },
                address: {
                    type: "string",
                },
                province: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        id: {
                            type: "string",
                            format: "uuid",
                        },
                        name: {
                            type: "string",
                        },
                        slug: {
                            type: "string",
                        },
                    },
                    required: ["id", "name", "slug"],
                    nullable: true,
                },
                district: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        id: {
                            type: "string",
                            format: "uuid",
                        },
                        name: {
                            type: "string",
                        },
                        slug: {
                            type: "string",
                        },
                        provinceId: {
                            type: "string",
                            format: "uuid",
                        },
                    },
                    required: ["id", "name", "slug", "provinceId"],
                    nullable: true,
                },
                lat: {
                    type: "number",
                    nullable: true,
                },
                lng: {
                    type: "number",
                    nullable: true,
                },
                status: {
                    type: "string",
                    enum: ["approved"],
                },
                coverUrl: {
                    type: "string",
                    nullable: true,
                },
                ratingAvg: {
                    type: "number",
                },
                reviewCount: {
                    type: "integer",
                },
                fromPrice: {
                    type: "integer",
                    nullable: true,
                },
                sports: {
                    type: "array",
                    items: {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                            id: {
                                type: "string",
                                format: "uuid",
                            },
                            name: {
                                type: "string",
                            },
                            slug: {
                                type: "string",
                            },
                            icon: {
                                type: "string",
                                nullable: true,
                            },
                        },
                        required: ["id", "name", "slug", "icon"],
                    },
                },
                ownerId: {
                    type: "string",
                    format: "uuid",
                },
                description: {
                    type: "string",
                    nullable: true,
                },
                provinceId: {
                    type: "string",
                    format: "uuid",
                },
                districtId: {
                    type: "string",
                    format: "uuid",
                },
                images: {
                    type: "array",
                    items: {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                            id: {
                                type: "string",
                                format: "uuid",
                            },
                            url: {
                                type: "string",
                            },
                            sortOrder: {
                                type: "integer",
                            },
                        },
                        required: ["id", "url", "sortOrder"],
                    },
                },
                amenities: {
                    type: "array",
                    items: {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                            id: {
                                type: "string",
                                format: "uuid",
                            },
                            name: {
                                type: "string",
                            },
                            slug: {
                                type: "string",
                            },
                            icon: {
                                type: "string",
                                nullable: true,
                            },
                        },
                        required: ["id", "name", "slug", "icon"],
                    },
                },
                courts: {
                    type: "array",
                    items: {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                            id: {
                                type: "string",
                                format: "uuid",
                            },
                            name: {
                                type: "string",
                            },
                            description: {
                                type: "string",
                                nullable: true,
                            },
                            sportId: {
                                type: "string",
                                format: "uuid",
                                nullable: true,
                            },
                            status: {
                                type: "string",
                                enum: [...COURT_STATUSES],
                            },
                        },
                        required: ["id", "name", "sportId", "status"],
                    },
                },
                cancellationPolicy: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        cancelBeforeHours: {
                            type: "integer",
                        },
                        refundPercent: {
                            type: "integer",
                        },
                        depositPercent: {
                            type: "integer",
                        },
                    },
                    required: ["cancelBeforeHours", "refundPercent", "depositPercent"],
                    nullable: true,
                },
            },
            required: [
                "id",
                "name",
                "slug",
                "address",
                "province",
                "district",
                "lat",
                "lng",
                "status",
                "coverUrl",
                "ratingAvg",
                "reviewCount",
                "fromPrice",
                "sports",
                "ownerId",
                "description",
                "provinceId",
                "districtId",
                "images",
                "amenities",
                "courts",
                "cancellationPolicy",
            ],
        },
    },
};
