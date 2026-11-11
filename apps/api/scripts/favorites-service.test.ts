import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { FavoritesService } from "../src/modules/favorites/favorites.service.js";

const VENUE_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_VENUE_ID = "22222222-2222-4222-8222-222222222222";

function createService() {
  const calls: { added: string[]; removed: string[] } = {
    added: [],
    removed: [],
  };
  const repo = {
    listUserFavorites: async () => [
      { id: OTHER_VENUE_ID, name: "Sân B" },
      { id: VENUE_ID, name: "Sân A" },
    ],
    addFavorite: async (_userId: string, venueId: string) => {
      calls.added.push(venueId);
      return true;
    },
    removeFavorite: async (_userId: string, venueId: string) => {
      calls.removed.push(venueId);
      return true;
    },
  };
  const service = new FavoritesService(repo as never);
  return { service, calls };
}

test("FavoritesService", async (t) => {
  await t.test("trả về danh sách yêu thích của người dùng", async () => {
    const { service } = createService();
    const result = await service.list("user-1");
    assert.deepEqual(result, [
      { id: OTHER_VENUE_ID, name: "Sân B" },
      { id: VENUE_ID, name: "Sân A" },
    ]);
  });

  await t.test("thêm yêu thích trả về trạng thái favorited", async () => {
    const { service, calls } = createService();
    const result = await service.add("user-1", VENUE_ID);
    assert.deepEqual(result, { favorited: true });
    assert.deepEqual(calls.added, [VENUE_ID]);
  });

  await t.test("bỏ yêu thích vẫn thành công dù chưa từng yêu thích", async () => {
    const { service, calls } = createService();
    const result = await service.remove("user-1", OTHER_VENUE_ID);
    assert.deepEqual(result, { favorited: false });
    assert.deepEqual(calls.removed, [OTHER_VENUE_ID]);
  });

  await t.test("trả 404 khi venue không tồn tại hoặc đã bị xoá", async () => {
    const repo = {
      listUserFavorites: async () => [],
      addFavorite: async () => false,
      removeFavorite: async () => true,
    };
    const service = new FavoritesService(repo as never);
    await assert.rejects(
      () => service.add("user-1", VENUE_ID),
      /Cơ sở không tồn tại/,
    );
  });
});