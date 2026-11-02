import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import type { INestApplication } from "@nestjs/common";
import type { Pool } from "pg";
import { v7 } from "uuid";
import { AuthJwtService } from "../../src/modules/auth/auth-jwt.service.js";
import { VenuesRepository } from "../../src/modules/venues/venues.repository.js";
import type {
  OwnerVenueResponse,
  ApiErrorBody,
} from "../../../../packages/shared/src/types.js";
import {
  venueFixtureIds as ids,
  venueCreatePayload,
} from "./venues.fixture.js";

export async function runVenueMutationCases(
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
  const request = (
    method: string,
    id: string,
    body?: unknown,
    who = "ownerA",
  ) =>
    fetch(`${base}/api/v1/venues${id ? `/${id}` : ""}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(tokens[who] ? { Cookie: `access_token=${tokens[who]}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(20000),
    });
  const read = (response: Response) =>
    response.json() as Promise<{ data: OwnerVenueResponse } & ApiErrorBody>;
  const create = async () => {
    const response = await request("POST", "", venueCreatePayload());
    assert.equal(response.status, 201);
    return (await read(response)).data;
  };
  const row = async (id: string) =>
    (await pool.query("SELECT * FROM venues WHERE id=$1", [id])).rows[0];
  const links = async (id: string) => ({
    sports: (
      await pool.query(
        "SELECT sport_id FROM venue_sports WHERE venue_id=$1 ORDER BY sport_id",
        [id],
      )
    ).rows,
    amenities: (
      await pool.query(
        "SELECT amenity_id FROM venue_amenities WHERE venue_id=$1 ORDER BY amenity_id",
        [id],
      )
    ).rows,
  });

  await t.test(
    "PATCH/DELETE enforce role, ownership, UUID and deleted precedence",
    async () => {
      const venue = await create();
      for (const method of ["PATCH", "DELETE"]) {
        for (const [who, status] of [
          ["guest", 401],
          ["customer", 403],
          ["admin", 403],
          ["suspendedOwner", 403],
          ["ownerB", 403],
        ] as const) {
          const response = await request(
            method,
            venue.id,
            method === "PATCH" ? { name: "Forbidden" } : undefined,
            who,
          );
          assert.equal(response.status, status);
          if (who === "ownerB")
            assert.equal((await read(response)).error.code, "NOT_VENUE_OWNER");
        }
        assert.equal((await request(method, "bad-uuid", {})).status, 400);
        assert.equal(
          (await request(method, ids.venues.deletedA, {})).status,
          404,
        );
        assert.equal((await request(method, ids.missing, {})).status, 404);
      }
      for (const body of [
        {},
        { ownerId: ids.users.ownerB },
        { status: "approved" },
        { name: "  " },
        { lat: null },
      ])
        assert.equal((await request("PATCH", venue.id, body)).status, 400);
      assert.equal((await row(venue.id)).name, venue.name);
    },
  );
  await t.test(
    "PATCH validates merged area pair and distinguishes omitted versus empty links",
    async () => {
      const venue = await create();
      const before = await row(venue.id);
      assert.equal(
        (await request("PATCH", venue.id, { provinceId: ids.areas.provinceB }))
          .status,
        400,
      );
      assert.deepEqual(await row(venue.id), before);
      const response = await request("PATCH", venue.id, {
        provinceId: ids.areas.provinceB,
        districtId: ids.areas.districtB,
        description: "",
        sportIds: [],
      });
      assert.equal(response.status, 200);
      const data = (await read(response)).data;
      assert.equal(data.description, "");
      assert.deepEqual(data.sportIds, []);
      assert.deepEqual(data.amenityIds, venue.amenityIds);
      assert.equal(data.slug, venue.slug);
      assert.equal(
        (await request("PATCH", venue.id, { amenityIds: [ids.missing] }))
          .status,
        400,
      );
      assert.equal(
        (
          await request("PATCH", venue.id, {
            sportIds: [ids.sports.football, ids.sports.football],
          })
        ).status,
        200,
      );
      assert.equal((await links(venue.id)).sports.length, 1);
    },
  );
  await t.test(
    "PATCH effective edits requeue approved/rejected, preserve suspended and keep slug",
    async () => {
      for (const status of ["approved", "rejected", "pending", "suspended"]) {
        const venue = await create();
        await pool.query(
          "UPDATE venues SET status=$1,rejection_reason=$2,updated_at='2020-01-01' WHERE id=$3",
          [status, status === "rejected" ? "Fix address" : null, venue.id],
        );
        const response = await request("PATCH", venue.id, {
          name: `Edited ${status}`,
        });
        assert.equal(response.status, 200);
        const data = (await read(response)).data;
        assert.equal(
          data.status,
          status === "suspended" ? "suspended" : "pending",
        );
        assert.equal(data.rejectionReason, null);
        assert.equal(data.slug, venue.slug);
        assert.notEqual(data.updatedAt, "2020-01-01T00:00:00.000Z");
        assert.equal((await request("GET", venue.id)).status, 404);
      }
    },
  );
  await t.test(
    "PATCH no-op preserves timestamps/reason/status after trim, precision and set normalization",
    async () => {
      const venue = await create();
      await pool.query(
        "UPDATE venues SET status='rejected',rejection_reason='Keep reason',updated_at='2020-01-01' WHERE id=$1",
        [venue.id],
      );
      const before = await row(venue.id);
      const response = await request("PATCH", venue.id, {
        name: ` ${venue.name} `,
        lat: 10.850000001,
        sportIds: [...venue.sportIds, ...venue.sportIds],
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await row(venue.id), before);
      await pool.query("UPDATE venues SET lat=0 WHERE id=$1", [venue.id]);
      const zeroBefore = await row(venue.id);
      assert.equal(
        (await request("PATCH", venue.id, { lat: -0.00000001 })).status,
        200,
      );
      assert.deepEqual(await row(venue.id), zeroBefore);
      await pool.query("UPDATE venues SET lat=NULL,lng=NULL WHERE id=$1", [
        venue.id,
      ]);
      const unchanged = await request("PATCH", venue.id, { name: venue.name });
      assert.equal((await read(unchanged)).data.lat, null);
    },
  );
  await t.test(
    "PATCH link failure rolls back scalars, moderation state and deleted/replaced links",
    async () => {
      const venue = await create();
      await pool.query("UPDATE venues SET status='approved' WHERE id=$1", [
        venue.id,
      ]);
      const before = await row(venue.id);
      const beforeLinks = await links(venue.id);
      await pool.query(
        "CREATE FUNCTION mutation_fail_link() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private mutation SQL' USING ERRCODE='23503'; END $$; CREATE TRIGGER mutation_fail_link BEFORE INSERT ON venue_amenities FOR EACH ROW EXECUTE FUNCTION mutation_fail_link()",
      );
      try {
        const response = await request("PATCH", venue.id, {
          name: "Will rollback",
          sportIds: [],
          amenityIds: [ids.amenities.water],
        });
        assert.equal(response.status, 400);
        const body = await read(response);
        assert.equal(body.error.code, "VALIDATION_ERROR");
        assert.ok(!JSON.stringify(body).includes("private mutation"));
        assert.deepEqual(await row(venue.id), before);
        assert.deepEqual(await links(venue.id), beforeLinks);
      } finally {
        await pool.query(
          "DROP TRIGGER mutation_fail_link ON venue_amenities; DROP FUNCTION mutation_fail_link()",
        );
      }
    },
  );
  await t.test(
    "concurrent disjoint PATCH operations preserve both changes",
    async () => {
      const venue = await create();
      const responses = await Promise.all([
        request("PATCH", venue.id, { name: "Concurrent name" }),
        request("PATCH", venue.id, { address: "Concurrent address" }),
      ]);
      assert.deepEqual(
        responses.map((r) => r.status),
        [200, 200],
      );
      const updated = await row(venue.id);
      assert.equal(updated.name, "Concurrent name");
      assert.equal(updated.address, "Concurrent address");
    },
  );
  await t.test(
    "ownership changed after guard is rechecked under the Venue lock",
    async () => {
      const venue = await create();
      const blocker = await pool.connect();
      const repository = app.get(VenuesRepository);
      const original = repository.lockVenue.bind(repository);
      let reached!: () => void;
      const entered = new Promise<void>((resolve) => {
        reached = resolve;
      });
      repository.lockVenue = (...args) => {
        reached();
        return original(...args);
      };
      try {
        await blocker.query("BEGIN");
        await blocker.query("UPDATE venues SET owner_id=$1 WHERE id=$2", [
          ids.users.ownerB,
          venue.id,
        ]);
        const pending = request("PATCH", venue.id, { name: "Must not write" });
        await Promise.race([
          entered,
          new Promise<never>((_, reject) => {
            const timer = setTimeout(
              () => reject(new Error("Venue lock not reached")),
              10000,
            );
            timer.unref();
          }),
        ]);
        await blocker.query("COMMIT");
        const response = await pending;
        assert.equal(response.status, 403);
        assert.equal((await read(response)).error.code, "NOT_VENUE_OWNER");
        assert.equal((await row(venue.id)).name, venue.name);
      } finally {
        repository.lockVenue = original;
        await blocker.query("ROLLBACK");
        blocker.release();
      }
    },
  );
  await t.test(
    "DELETE blocks held/pending_payment/confirmed including expired/past and deleted courts",
    async () => {
      const venue = await create();
      const courtId = v7();
      const bookingId = v7();
      await pool.query(
        "INSERT INTO courts(id,venue_id,name,deleted_at) VALUES($1,$2,'Deleted court',now())",
        [courtId, venue.id],
      );
      await pool.query(
        "INSERT INTO bookings(id,court_id,customer_id,during,status,total_price,deposit_amount,expires_at) VALUES($1,$2,$3,'[2020-01-01 01:00:00+00,2020-01-01 02:00:00+00)','held',100000,50000,'2020-01-01')",
        [bookingId, courtId, ids.users.customer],
      );
      for (const status of ["held", "pending_payment", "confirmed"]) {
        await pool.query(
          "UPDATE bookings SET status=$1, expires_at=CASE WHEN $1='held' THEN expires_at ELSE NULL END WHERE id=$2",
          [status, bookingId],
        );
        const response = await request("DELETE", venue.id);
        assert.equal(response.status, 409);
        assert.equal((await read(response)).error.code, "RESOURCE_IN_USE");
        assert.equal((await row(venue.id)).deleted_at, null);
      }
      await pool.query("UPDATE bookings SET status='completed' WHERE id=$1", [
        bookingId,
      ]);
      const response = await request("DELETE", venue.id);
      assert.equal(response.status, 204);
      assert.equal(await response.text(), "");
      assert.equal(
        (
          await pool.query("SELECT status FROM bookings WHERE id=$1", [
            bookingId,
          ])
        ).rows[0].status,
        "completed",
      );
      assert.equal(
        (await pool.query("SELECT id FROM courts WHERE id=$1", [courtId]))
          .rowCount,
        1,
      );
    },
  );
  await t.test(
    "DELETE keeps children/links, disappears from reads, repeated delete and patch return 404",
    async () => {
      const venue = await create();
      const courtId = v7();
      const beforeLinks = await links(venue.id);
      await pool.query(
        "INSERT INTO courts(id,venue_id,name) VALUES($1,$2,'Active empty court')",
        [courtId, venue.id],
      );
      await pool.query("UPDATE venues SET status='approved' WHERE id=$1", [
        venue.id,
      ]);
      assert.equal((await request("DELETE", venue.id)).status, 204);
      assert.equal((await row(venue.id)).status, "approved");
      assert.ok((await row(venue.id)).deleted_at);
      assert.deepEqual(await links(venue.id), beforeLinks);
      assert.equal(
        (
          await pool.query("SELECT deleted_at FROM courts WHERE id=$1", [
            courtId,
          ])
        ).rows[0].deleted_at,
        null,
      );
      assert.equal((await request("GET", venue.id)).status, 404);
      for (const who of ["ownerA", "ownerB"])
        assert.equal(
          (await request("DELETE", venue.id, undefined, who)).status,
          404,
        );
      assert.equal(
        (await request("PATCH", venue.id, { name: "No restore" })).status,
        404,
      );
      for (const [path, who] of [
        ["owner/venues?limit=100", "ownerA"],
        ["admin/venues?status=approved&limit=100", "admin"],
      ]) {
        const response = await fetch(`${base}/api/v1/${path}`, {
          headers: { Cookie: `access_token=${tokens[who!]}` },
        });
        const body = (await response.json()) as { data: OwnerVenueResponse[] };
        assert.ok(body.data.every((v) => v.id !== venue.id));
      }
    },
  );
  await t.test(
    "concurrent DELETE succeeds once without double deletion",
    async () => {
      const venue = await create();
      const responses = await Promise.all([
        request("DELETE", venue.id),
        request("DELETE", venue.id),
      ]);
      assert.deepEqual(responses.map((r) => r.status).sort(), [204, 404]);
    },
  );
  await t.test(
    "booking transaction holding Venue SHARE commits before DELETE checks dependencies",
    async () => {
      const venue = await create();
      const courtId = v7();
      await pool.query(
        "INSERT INTO courts(id,venue_id,name) VALUES($1,$2,'Concurrent booking court')",
        [courtId, venue.id],
      );
      await pool.query("UPDATE venues SET status='approved' WHERE id=$1", [
        venue.id,
      ]);
      const writer = await pool.connect();
      const repository = app.get(VenuesRepository);
      const original = repository.lockVenue.bind(repository);
      let reached!: () => void;
      const entered = new Promise<void>((resolve) => {
        reached = resolve;
      });
      repository.lockVenue = (...args) => {
        reached();
        return original(...args);
      };
      try {
        await writer.query("BEGIN");
        await writer.query(
          "SELECT id FROM venues WHERE id=$1 AND status='approved' AND deleted_at IS NULL FOR SHARE",
          [venue.id],
        );
        const pending = request("DELETE", venue.id);
        await Promise.race([
          entered,
          new Promise<never>((_, reject) => {
            const timer = setTimeout(
              () => reject(new Error("Delete did not reach lock")),
              10000,
            );
            timer.unref();
          }),
        ]);
        await writer.query(
          "INSERT INTO bookings(id,court_id,customer_id,during,status,total_price,deposit_amount) VALUES($1,$2,$3,'[2030-01-01 01:00:00+00,2030-01-01 02:00:00+00)','confirmed',100000,50000)",
          [v7(), courtId, ids.users.customer],
        );
        await writer.query("COMMIT");
        const response = await pending;
        assert.equal(response.status, 409);
        assert.equal((await read(response)).error.code, "RESOURCE_IN_USE");
        assert.equal((await row(venue.id)).deleted_at, null);
      } finally {
        repository.lockVenue = original;
        await writer.query("ROLLBACK");
        writer.release();
      }
    },
  );
}
