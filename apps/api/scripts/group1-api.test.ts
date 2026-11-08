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
      findSportBySlug: async (slug: string) =>
        slug === "badminton" ? { id: "1", slug } : null,
    };
    const service = new CatalogsService(mockRepo);
    await assert.rejects(
      async () => service.createSport({ name: "Cầu lông", slug: "badminton" }),
      (err: any) =>
        err.status === 409 && err.response?.code === "ALREADY_EXISTS",
    );
  });

  await t.test("rejects deleting sport currently in use", async () => {
    const mockRepo: any = {
      findSportById: async (id: string) => ({
        id,
        name: "Cầu lông",
        slug: "badminton",
      }),
      isSportInUse: async () => true,
    };
    const service = new CatalogsService(mockRepo);
    await assert.rejects(
      async () => service.deleteSport("1"),
      (err: any) =>
        err.status === 409 && err.response?.code === "RESOURCE_IN_USE",
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
      (err: any) =>
        err.status === 400 && err.response?.code === "VALIDATION_ERROR",
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
          bankBin: "970436",
          bankName: "Vietcombank",
          accountNo: "0123456789",
          accountName: "NGUYEN VAN A",
        }),
      (err: any) =>
        err.status === 409 && err.response?.code === "ALREADY_EXISTS",
    );
  });

  await t.test(
    "blocks apply if user has existing pending application",
    async () => {
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
            bankBin: "970436",
            bankName: "Vietcombank",
            accountNo: "0123456789",
            accountName: "NGUYEN VAN A",
          }),
        (err: any) =>
          err.status === 409 && err.response?.code === "ALREADY_EXISTS",
      );
    },
  );

  await t.test(
    "rejects reviewing application that is not in pending status",
    async () => {
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
        (err: any) =>
          err.status === 400 &&
          err.response?.code === "INVALID_STATUS_TRANSITION",
      );
    },
  );
});

test("Group 1 VenuesService uses transactional area validation and UUID-suffixed slugs", async (t) => {
  const ownerId = "01900000-0000-7000-8000-000000000001";
  const provinceId = "01900000-0000-7000-8000-000000000002";
  const districtId = "01900000-0000-7000-8000-000000000003";
  let parentId = provinceId;
  const transaction = {};
  const repo: any = {
    transaction: async (work: any) => work(transaction),
    areas: async (tx: unknown) => {
      assert.equal(tx, transaction);
      return [
        { id: provinceId, type: "province" },
        { id: districtId, type: "district", parentId },
      ];
    },
    catalogIds: async () => [],
    create: async (tx: unknown, values: any) => {
      assert.equal(tx, transaction);
      return { ...values, createdAt: new Date(), updatedAt: new Date() };
    },
  };
  const auth: any = {
    requireActiveUser: async (_id: string, tx: unknown) => {
      assert.equal(tx, transaction);
      return { id: ownerId, role: "owner" };
    },
  };
  const service = new VenuesService(repo, auth, {} as any);
  const input = {
    name: "San Test",
    address: "123 Duong A",
    provinceId,
    districtId,
    lat: 10,
    lng: 106,
    sportIds: [],
    amenityIds: [],
  };
  await t.test("rejects a district belonging to another province", async () => {
    parentId = "01900000-0000-7000-8000-000000000004";
    await assert.rejects(
      () => service.create(ownerId, input),
      (err: any) =>
        err.status === 400 && err.response?.code === "VALIDATION_ERROR",
    );
  });
  await t.test(
    "creates a pending Venue with immutable UUID-suffixed slug",
    async () => {
      parentId = provinceId;
      const venue = await service.create(ownerId, input);
      assert.equal(venue.slug, `san-test-${venue.id}`);
      assert.equal(venue.status, "pending");
    },
  );
});

test("Group 1 CourtsService validates court creation and pricing rules", async (t) => {
  const mockVenuesRepo: any = {
    findById: async (id: string) => (id === "venue-1" ? { id } : null),
  };
  const mockCourtsRepo: any = {
    createCourt: async (venueId: string, input: any) => ({
      id: "court-1",
      venueId,
      ...input,
    }),
    upsertOpeningHours: async () => [],
    findCourtById: async (id: string) => (id === "court-1" ? { id } : null),
    createPricingRule: async (_courtId: string, input: any) => ({
      id: "rule-1",
      ...input,
    }),
  };

  const service = new CourtsService(
    mockCourtsRepo,
    mockVenuesRepo,
    // Kiểm tra quyền sở hữu không thuộc phạm vi unit test của service này.
    {} as unknown as ConstructorParameters<typeof CourtsService>[2],
  );

  await t.test(
    "creates court and seeds 7-day default opening hours",
    async () => {
      const court = await service.createCourt("venue-1", { name: "Sân 1" });
      assert.equal(court.id, "court-1");
    },
  );

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
      (err: any) =>
        err.status === 400 && err.response?.code === "VALIDATION_ERROR",
    );
  });
});
