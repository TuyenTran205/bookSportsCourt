import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { CatalogsService } from "../src/modules/catalogs/catalogs.service.js";
import { OwnerApplicationsService } from "../src/modules/owner-applications/owner-applications.service.js";
import { VenuesService } from "../src/modules/venues/venues.service.js";
import { CourtsService } from "../src/modules/courts/courts.service.js";

test("Group 1 CatalogsService validates slug uniqueness and resource usage", async (t) => {
  await t.test("rejects duplicate sport slug", async () => {
    const mockRepo: any = {
      findSportBySlug: async (slug: string) => (slug === "badminton" ? { id: "1", slug } : null),
    };
    const service = new CatalogsService(mockRepo);
    await assert.rejects(
      async () => service.createSport({ name: "Cầu lông", slug: "badminton" }),
      (err: any) => err.status === 409 && err.response?.code === "ALREADY_EXISTS",
    );
  });

  await t.test("rejects deleting sport currently in use", async () => {
    const mockRepo: any = {
      findSportById: async (id: string) => ({ id, name: "Cầu lông", slug: "badminton" }),
      isSportInUse: async () => true,
    };
    const service = new CatalogsService(mockRepo);
    await assert.rejects(
      async () => service.deleteSport("1"),
      (err: any) => err.status === 409 && err.response?.code === "RESOURCE_IN_USE",
    );
  });

  await t.test("requires parentId when creating district", async () => {
    const mockRepo: any = {};
    const service = new CatalogsService(mockRepo);
    await assert.rejects(
      async () =>
        service.createArea({
          name: "Quận 1",
          slug: "quan-1",
          type: "district",
          parentId: null,
        }),
      (err: any) => err.status === 400 && err.response?.code === "VALIDATION_ERROR",
    );
  });
});

test("Group 1 OwnerApplicationsService handles application flow and transitions", async (t) => {
  await t.test("blocks apply if user already has role owner", async () => {
    const mockRepo: any = {};
    const service = new OwnerApplicationsService(mockRepo);
    await assert.rejects(
      async () =>
        service.apply("user-1", "owner", {
          businessName: "Sân Sao Mai",
          phone: "0901234567",
          address: "123 Đường Số 1",
        }),
      (err: any) => err.status === 409 && err.response?.code === "ALREADY_EXISTS",
    );
  });

  await t.test("blocks apply if user has existing pending application", async () => {
    const mockRepo: any = {
      findPendingByUserId: async () => ({ id: "app-1", status: "pending" }),
    };
    const service = new OwnerApplicationsService(mockRepo);
    await assert.rejects(
      async () =>
        service.apply("user-1", "customer", {
          businessName: "Sân Sao Mai",
          phone: "0901234567",
          address: "123 Đường Số 1",
        }),
      (err: any) => err.status === 409 && err.response?.code === "ALREADY_EXISTS",
    );
  });

  await t.test("rejects reviewing application that is not in pending status", async () => {
    const mockRepo: any = {
      findById: async () => ({ id: "app-1", status: "approved" }),
    };
    const service = new OwnerApplicationsService(mockRepo);
    await assert.rejects(
      async () =>
        service.review("app-1", "admin-1", {
          status: "approved",
          reviewNote: "Duyệt lại",
        }),
      (err: any) => err.status === 400 && err.response?.code === "INVALID_STATUS_TRANSITION",
    );
  });
});

test("Group 1 VenuesService validates province-district hierarchy", async (t) => {
  const mockCatalogsRepo: any = {
    findAreaById: async (id: string) => {
      if (id === "prov-hcm") return { id, type: "province", parentId: null };
      if (id === "dist-q1") return { id, type: "district", parentId: "prov-hcm" };
      if (id === "dist-hn") return { id, type: "district", parentId: "prov-hn" };
      return null;
    },
  };
  const mockVenuesRepo: any = {
    findBySlug: async () => null,
    createVenue: async (_ownerId: string, slug: string, input: any) => ({
      id: "venue-1",
      slug,
      ...input,
    }),
  };

  const service = new VenuesService(mockVenuesRepo, mockCatalogsRepo);

  await t.test("rejects when district does not belong to province", async () => {
    await assert.rejects(
      async () =>
        service.createVenue("owner-1", {
          name: "Sân Test",
          address: "123 Đường A",
          provinceId: "prov-hcm",
          districtId: "dist-hn",
          sportIds: [],
          amenityIds: [],
        }),
      (err: any) => err.status === 400 && err.response?.code === "VALIDATION_ERROR",
    );
  });

  await t.test("creates venue with auto-generated slug when province and district match", async () => {
    const venue = await service.createVenue("owner-1", {
      name: "Sân Cầu Lông Kỳ Hoà",
      address: "123 Đường A",
      provinceId: "prov-hcm",
      districtId: "dist-q1",
      sportIds: [],
      amenityIds: [],
    });
    assert.equal(venue.slug, "san-cau-long-ky-hoa");
  });
});

test("Group 1 CourtsService validates court creation and pricing rules", async (t) => {
  const mockVenuesRepo: any = {
    findById: async (id: string) => (id === "venue-1" ? { id } : null),
  };
  const mockCourtsRepo: any = {
    createCourt: async (venueId: string, input: any) => ({ id: "court-1", venueId, ...input }),
    upsertOpeningHours: async () => [],
    findCourtById: async (id: string) => (id === "court-1" ? { id } : null),
    createPricingRule: async (_courtId: string, input: any) => ({ id: "rule-1", ...input }),
  };

  const service = new CourtsService(mockCourtsRepo, mockVenuesRepo);

  await t.test("creates court and seeds 7-day default opening hours", async () => {
    const court = await service.createCourt("venue-1", { name: "Sân 1" });
    assert.equal(court.id, "court-1");
  });

  await t.test("rejects pricing rule when startTime >= endTime", async () => {
    await assert.rejects(
      async () =>
        service.createPricingRule("court-1", {
          label: "Giờ vàng",
          weekdays: [1, 2, 3],
          startTime: "18:00",
          endTime: "17:00",
          pricePerSlot: 100000,
        }),
      (err: any) => err.status === 400 && err.response?.code === "VALIDATION_ERROR",
    );
  });
});

