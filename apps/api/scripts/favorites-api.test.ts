import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { FavoritesController } from "../src/modules/favorites/favorites.controller.js";
import { FavoritesService } from "../src/modules/favorites/favorites.service.js";
import type { FavoritesRepository } from "../src/modules/favorites/favorites.repository.js";
import type { AuthenticatedUser } from "../../../packages/shared/src/types.js";

test("FavoritesController handles list, add and remove operations", async () => {
  const mockUser = {
    id: "user-123",
    email: "test@example.com",
    role: "customer",
    status: "active",
  } as AuthenticatedUser;

  const mockVenues = [
    {
      id: "venue-1",
      name: "Sân Cầu Lông Cầu Giấy",
      slug: "san-cau-long-cau-giay",
      address: "123 Cầu Giấy, Hà Nội",
      province: { id: "p-1", name: "Hà Nội", slug: "ha-noi" },
      ward: null,
      district: null,
      lat: 21.0285,
      lng: 105.8542,
      status: "approved" as const,
      coverUrl: null,
      ratingAvg: 4.8,
      reviewCount: 15,
      fromPrice: 100000,
      sports: [{ id: "s-1", name: "Cầu lông", slug: "cau-long", icon: null }],
    },
  ];

  let addedVenueId = "";
  let removedVenueId = "";

  const mockRepo = {
    listUserFavorites: async (userId: string) => {
      assert.equal(userId, "user-123");
      return mockVenues;
    },
    addFavorite: async (userId: string, venueId: string) => {
      assert.equal(userId, "user-123");
      addedVenueId = venueId;
      return venueId !== "not-found";
    },
    removeFavorite: async (userId: string, venueId: string) => {
      assert.equal(userId, "user-123");
      removedVenueId = venueId;
      return true;
    },
  } as unknown as FavoritesRepository;

  const service = new FavoritesService(mockRepo);
  const controller = new FavoritesController(service);

  // Test 1: list
  const listResult = await controller.list(mockUser);
  assert.deepEqual(listResult, { data: mockVenues });

  // Test 2: add existing venue
  const addResult = await controller.add(mockUser, "venue-1");
  assert.deepEqual(addResult, { data: { favorited: true } });
  assert.equal(addedVenueId, "venue-1");

  // Test 3: add non-existent venue throws 404
  await assert.rejects(
    controller.add(mockUser, "not-found"),
    (err: { getStatus?: () => number }) => err.getStatus?.() === 404,
  );

  // Test 4: remove
  const removeResult = await controller.remove(mockUser, "venue-1");
  assert.deepEqual(removeResult, { data: { favorited: false } });
  assert.equal(removedVenueId, "venue-1");
});
