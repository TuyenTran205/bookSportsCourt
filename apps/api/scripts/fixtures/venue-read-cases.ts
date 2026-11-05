import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import type { INestApplication } from "@nestjs/common";
import type { Pool } from "pg";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AuthJwtService } from "../../src/modules/auth/auth-jwt.service.js";
import type {
  OwnerVenueResponse,
  VenueDetail,
  PaginationMeta,
  ApiErrorBody,
} from "../../../../packages/shared/src/types.js";
import { venueFixtureIds as ids } from "./venues.fixture.js";

export async function runVenueReadCases(
  t: TestContext,
  app: INestApplication,
  pool: Pool,
) {
  const base = await app.getUrl();
  const tokens = Object.fromEntries(
    await Promise.all(
      Object.entries(ids.users).map(async ([key, id]) => [
        key,
        await app.get(AuthJwtService).sign(id, "access", false),
      ]),
    ),
  );
  const get = (path: string, who = "guest") =>
    fetch(`${base}/api/v1${path}`, {
      headers: tokens[who] ? { Cookie: `access_token=${tokens[who]}` } : {},
      signal: AbortSignal.timeout(10000),
    });
  const list = async (path: string, who: string) => {
    const response = await get(path, who);
    assert.equal(response.status, 200);
    return response.json() as Promise<{
      data: OwnerVenueResponse[];
      meta: PaginationMeta;
    }>;
  };
  const detail = async (id: string) => {
    const response = await get(`/venues/${id}`);
    assert.equal(response.status, 200);
    return ((await response.json()) as { data: VenueDetail }).data;
  };

  await t.test(
    "read guards enforce Owner/Admin roles and strict queries",
    async () => {
      for (const path of ["/owner/venues", "/admin/venues"]) {
        assert.equal((await get(path)).status, 401);
        assert.equal((await get(path, "customer")).status, 403);
        assert.equal((await get(path, "suspendedOwner")).status, 403);
      }
      assert.equal((await get("/owner/venues", "admin")).status, 403);
      assert.equal((await get("/admin/venues", "ownerA")).status, 403);
      for (const query of [
        `ownerId=${ids.users.ownerB}`,
        "status=approved",
        "page=0",
        "limit=101",
        "page=1&page=2",
      ]) {
        const response = await get(`/owner/venues?${query}`, "ownerA");
        assert.equal(response.status, 400);
        assert.equal(
          ((await response.json()) as ApiErrorBody).error.code,
          "VALIDATION_ERROR",
        );
      }
      assert.equal(
        (await get("/admin/venues?status=all", "admin")).status,
        400,
      );
    },
  );
  await t.test(
    "Owner list isolates owners, keeps reasons, paginates stably including huge page",
    async () => {
      const full = await list("/owner/venues", "ownerA");
      assert.equal(full.meta.total, 4);
      assert.equal(full.data.length, 4);
      assert.ok(full.data.every((v) => v.ownerId === ids.users.ownerA));
      assert.deepEqual(full.data.map((v) => v.status).sort(), [
        "approved",
        "pending",
        "rejected",
        "suspended",
      ]);
      assert.ok(
        full.data.find((v) => v.status === "rejected")?.rejectionReason,
      );
      const expected = (
        await pool.query(
          "SELECT id FROM venues WHERE owner_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC,id DESC",
          [ids.users.ownerA],
        )
      ).rows.map((r: { id: string }) => r.id);
      assert.deepEqual(
        full.data.map((v) => v.id),
        expected,
      );
      const a = await list("/owner/venues?limit=2&page=1", "ownerA");
      const b = await list("/owner/venues?limit=2&page=2", "ownerA");
      assert.deepEqual(
        [...a.data, ...b.data].map((v) => v.id),
        expected,
      );
      assert.deepEqual(a.meta, { page: 1, limit: 2, total: 4, totalPages: 2 });
      const far = await list(
        "/owner/venues?page=9007199254740991&limit=100",
        "ownerA",
      );
      assert.deepEqual(far.data, []);
      assert.equal(far.meta.total, 4);
      const other = await list("/owner/venues", "ownerB");
      assert.equal(other.meta.total, 2);
      assert.ok(other.data.every((v) => v.ownerId === ids.users.ownerB));
    },
  );
  await t.test(
    "Admin defaults pending, literal case-insensitive search and private moderation fields",
    async () => {
      const pending = await list("/admin/venues", "admin");
      assert.ok(pending.data.length > 0);
      assert.ok(pending.data.every((v) => v.status === "pending"));
      assert.ok(
        pending.data.every(
          (v) =>
            "description" in v && "sportIds" in v && "rejectionReason" in v,
        ),
      );
      const original = (
        await pool.query("SELECT name FROM venues WHERE id=$1", [
          ids.venues.pendingA,
        ])
      ).rows[0].name as string;
      try {
        await pool.query("UPDATE venues SET name=$1 WHERE id=$2", [
          "Review 100%_\\ literal",
          ids.venues.pendingA,
        ]);
        const matched = await list(
          `/admin/venues?q=${encodeURIComponent("  REVIEW 100%_\\  ")}`,
          "admin",
        );
        assert.deepEqual(
          matched.data.map((v) => v.id),
          [ids.venues.pendingA],
        );
        const empty = await list("/admin/venues?q=does-not-exist", "admin");
        assert.deepEqual(empty, {
          data: [],
          meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
        });
        const rejected = await list("/admin/venues?status=rejected", "admin");
        assert.equal(rejected.data.length, 2);
        assert.equal(
          rejected.data.find((v) => v.id === ids.venues.legacyRejectedB)
            ?.rejectionReason,
          null,
        );
      } finally {
        await pool.query("UPDATE venues SET name=$1 WHERE id=$2", [
          original,
          ids.venues.pendingA,
        ]);
      }
    },
  );
  await t.test(
    "public UUID/slug only exposes approved alive; no Owner/Admin bypass",
    async () => {
      const venue = await detail(ids.venues.approvedA);
      assert.deepEqual(await detail(venue.slug), venue);
      assert.deepEqual(await detail(ids.venues.approvedA.toUpperCase()), venue);
      for (const id of [
        ids.venues.pendingA,
        ids.venues.rejectedA,
        ids.venues.suspendedA,
        ids.venues.deletedA,
        ids.missing,
        "not-a-venue",
      ]) {
        for (const who of ["guest", "ownerA", "admin"]) {
          const response = await get(`/venues/${id}`, who);
          assert.equal(response.status, 404);
          assert.equal(
            ((await response.json()) as ApiErrorBody).error.code,
            "NOT_FOUND",
          );
        }
      }
      for (const key of [
        "rejectionReason",
        "createdAt",
        "updatedAt",
        "deletedAt",
        "email",
        "phone",
        "paymentAccount",
      ])
        assert.equal(key in venue, false);
      assert.deepEqual(venue.images, []);
      assert.deepEqual(venue.courts, []);
      assert.equal(venue.cancellationPolicy, null);
      assert.equal(venue.fromPrice, null);
    },
  );
  await t.test(
    "detail reads real related data, excludes deleted courts and preserves null coordinates",
    async () => {
      const original = (
        await pool.query("SELECT lat,lng FROM venues WHERE id=$1", [
          ids.venues.approvedA,
        ])
      ).rows[0];
      const imageIds = [
        "019a0000-0014-7000-8000-000000000501",
        "019a0000-0014-7000-8000-000000000502",
      ];
      const courtIds = [
        "019a0000-0014-7000-8000-000000000601",
        "019a0000-0014-7000-8000-000000000602",
      ];
      try {
        await pool.query("UPDATE venues SET lat=NULL,lng=NULL WHERE id=$1", [
          ids.venues.approvedA,
        ]);
        for (const id of [...imageIds].reverse())
          await pool.query(
            "INSERT INTO venue_images(id,venue_id,url,sort_order) VALUES($1,$2,$3,1)",
            [id, ids.venues.approvedA, `https://example.test/${id}.jpg`],
          );
        await pool.query(
          "INSERT INTO courts(id,venue_id,name,status) VALUES($1,$2,'Court visible','inactive'),($3,$2,'Court deleted','active')",
          [courtIds[0], ids.venues.approvedA, courtIds[1]],
        );
        await pool.query("UPDATE courts SET deleted_at=now() WHERE id=$1", [
          courtIds[1],
        ]);
        await pool.query(
          "INSERT INTO cancellation_policies(venue_id,cancel_before_hours,refund_percent,deposit_percent) VALUES($1,12,50,30)",
          [ids.venues.approvedA],
        );
        await pool.query(
          "INSERT INTO venue_sports(venue_id,sport_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
          [ids.venues.approvedA, ids.sports.football],
        );
        const venue = await detail(ids.venues.approvedA);
        assert.equal(venue.lat, null);
        assert.equal(venue.lng, null);
        assert.deepEqual(
          venue.images.map((i) => i.id),
          imageIds,
        );
        assert.deepEqual(
          venue.courts.map((c) => c.id),
          [courtIds[0]],
        );
        assert.equal(venue.courts[0]?.status, "inactive");
        assert.deepEqual(venue.cancellationPolicy, {
          cancelBeforeHours: 12,
          refundPercent: 50,
          depositPercent: 30,
        });
        assert.equal(venue.province?.id, ids.areas.provinceA);
        assert.equal(venue.district?.provinceId, ids.areas.provinceA);
        assert.ok(venue.sports.some((s) => s.id === ids.sports.football));
        assert.ok(venue.amenities.length > 0);
        const owner = await list("/owner/venues", "ownerA");
        assert.equal(owner.meta.total, 4);
        assert.equal(new Set(owner.data.map((v) => v.id)).size, 4);
      } finally {
        await pool.query("DELETE FROM venue_images WHERE id=ANY($1::uuid[])", [
          imageIds,
        ]);
        await pool.query("DELETE FROM courts WHERE id=ANY($1::uuid[])", [
          courtIds,
        ]);
        await pool.query(
          "DELETE FROM cancellation_policies WHERE venue_id=$1",
          [ids.venues.approvedA],
        );
        await pool.query("UPDATE venues SET lat=$1,lng=$2 WHERE id=$3", [
          original.lat,
          original.lng,
          ids.venues.approvedA,
        ]);
      }
    },
  );
  await t.test(
    "runtime Swagger declares all three reads with public projection",
    () => {
      const doc = SwaggerModule.createDocument(
        app,
        new DocumentBuilder().build(),
      );
      for (const path of [
        "/api/v1/owner/venues",
        "/api/v1/admin/venues",
        "/api/v1/venues/{slug}",
      ])
        assert.ok(doc.paths[path]?.get?.responses["200"]);
      assert.equal(
        doc.paths["/api/v1/venues/{slug}"]?.get?.security,
        undefined,
      );
    },
  );
}
