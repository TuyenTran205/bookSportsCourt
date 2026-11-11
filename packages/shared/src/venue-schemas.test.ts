import { describe, expect, it } from "vitest";
import {
  createVenueSchema,
  updateVenueSchema,
  venueStatusUpdateSchema,
  ownerVenueQuerySchema,
  adminVenueQuerySchema,
} from "./schemas.js";

const input = {
  name: "  Sân cầu lông  ",
  address: "123 Đường A",
  provinceId: "019a0000-0000-7000-8000-000000000001",
  districtId: "019a0000-0000-7000-8000-000000000002",
  lat: 10.85,
  lng: 106.76,
};

describe("Venue input contract", () => {
  it("normalizes query defaults, pagination and admin search", () => {
    expect(ownerVenueQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(
      adminVenueQuerySchema.parse({ page: "2", limit: "100", q: "  Sân A  " }),
    ).toEqual({ page: 2, limit: 100, q: "Sân A" });
    expect(
      adminVenueQuerySchema.parse({ status: "pending" }),
    ).toEqual({ page: 1, limit: 20, status: "pending" });
    expect(adminVenueQuerySchema.parse({ q: "   " }).q).toBe("");
  });

  it("rejects ambiguous pagination and query fields outside the allowlist", () => {
    for (const page of [
      "",
      " ",
      "1e2",
      "1.5",
      "-1",
      "0",
      "Infinity",
      null,
      true,
      ["1", "2"],
      {},
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      expect(ownerVenueQuerySchema.safeParse({ page }).success).toBe(false);
    }
    expect(ownerVenueQuerySchema.safeParse({ limit: "101" }).success).toBe(
      false,
    );
    expect(
      ownerVenueQuerySchema.safeParse({ ownerId: input.provinceId }).success,
    ).toBe(false);
    expect(ownerVenueQuerySchema.safeParse({ status: "pending" }).success).toBe(
      false,
    );
    expect(adminVenueQuerySchema.safeParse({ status: "all" }).success).toBe(
      false,
    );
    expect(adminVenueQuerySchema.safeParse({ q: ["A", "B"] }).success).toBe(
      false,
    );
    expect(
      adminVenueQuerySchema.safeParse({ q: "a".repeat(201) }).success,
    ).toBe(false);
  });

  it("validates content lengths and both link arrays on POST and PATCH", () => {
    for (const fields of [
      { name: "a" },
      { name: "a".repeat(201) },
      { address: "    " },
      { description: "a".repeat(5001) },
      { lng: 181 },
      { sportIds: ["bad"] },
      { amenityIds: [null] },
      { ratingAvg: 5 },
      { reviewCount: 10 },
    ]) {
      expect(createVenueSchema.safeParse({ ...input, ...fields }).success).toBe(
        false,
      );
      expect(updateVenueSchema.safeParse(fields).success).toBe(false);
    }
  });
  it("trims names and defaults links only on creation", () => {
    expect(createVenueSchema.parse(input)).toMatchObject({
      name: "Sân cầu lông",
      sportIds: [],
      amenityIds: [],
    });
    expect(updateVenueSchema.parse({ description: "Mới" })).toEqual({
      description: "Mới",
    });
    expect(updateVenueSchema.parse({ amenityIds: [] })).toEqual({
      amenityIds: [],
    });
  });

  it("rejects client-controlled ownership/status and an empty PATCH", () => {
    for (const field of [
      "ownerId",
      "status",
      "slug",
      "deletedAt",
      "fromPrice",
      "coverUrl",
    ]) {
      expect(
        createVenueSchema.safeParse({ ...input, [field]: "injected" }).success,
      ).toBe(false);
      expect(
        updateVenueSchema.safeParse({ description: "Mới", [field]: "injected" })
          .success,
      ).toBe(false);
    }
    expect(updateVenueSchema.safeParse({}).success).toBe(false);
    expect(
      updateVenueSchema.safeParse({ description: undefined }).success,
    ).toBe(false);
  });

  it("does not coerce missing or invalid coordinates into zero", () => {
    for (const lat of [null, "", "10.85", Infinity, 91]) {
      expect(createVenueSchema.safeParse({ ...input, lat }).success).toBe(
        false,
      );
    }
    expect(
      createVenueSchema.safeParse({ ...input, lat: 0, lng: 0 }).success,
    ).toBe(true);
    expect(createVenueSchema.safeParse({ ...input, name: "   " }).success).toBe(
      false,
    );
    expect(
      createVenueSchema.safeParse({ ...input, sportIds: ["invalid"] }).success,
    ).toBe(false);
  });

  it("requires a normalized reason only for rejection", () => {
    expect(
      venueStatusUpdateSchema.parse({
        status: "rejected",
        reason: "  Sai địa chỉ  ",
      }),
    ).toEqual({ status: "rejected", reason: "Sai địa chỉ" });
    for (const reason of [undefined, null, "", "   ", "a".repeat(501)]) {
      expect(
        venueStatusUpdateSchema.safeParse({ status: "rejected", reason })
          .success,
      ).toBe(false);
    }
    for (const status of ["pending", "approved", "suspended"]) {
      expect(venueStatusUpdateSchema.safeParse({ status }).success).toBe(true);
      expect(
        venueStatusUpdateSchema.safeParse({ status, reason: "Không hợp lệ" })
          .success,
      ).toBe(false);
    }
    expect(
      venueStatusUpdateSchema.safeParse({ status: "deleted" }).success,
    ).toBe(false);
  });
});
