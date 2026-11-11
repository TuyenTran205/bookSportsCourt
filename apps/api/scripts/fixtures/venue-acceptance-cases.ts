import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import type { INestApplication } from "@nestjs/common";
import type { Pool } from "pg";
import { AuthJwtService } from "../../src/modules/auth/auth-jwt.service.js";
import { AuthService } from "../../src/modules/auth/auth.service.js";
import {
  venueCreatePayload,
  venueFixtureIds as ids,
} from "./venues.fixture.js";
import type {
  OwnerVenueResponse,
  ApiErrorBody,
} from "../../../../packages/shared/src/types.js";

export async function runVenueAcceptanceCases(
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
  const req = (method: string, path: string, body?: unknown, who = "ownerA") =>
    fetch(`${base}/api/v1${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Cookie: `access_token=${tokens[who]}`,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(20000),
    });
  const read = (r: Response) =>
    r.json() as Promise<{ data: OwnerVenueResponse } & ApiErrorBody>;
  const create = async () => {
    const r = await req("POST", "/venues", venueCreatePayload());
    assert.equal(r.status, 201);
    return (await read(r)).data;
  };
  const row = async (id: string) =>
    (await pool.query("SELECT * FROM venues WHERE id=$1", [id])).rows[0];
  await t.test(
    "acceptance: forbidden cache/identity fields and invalid coordinates never change DB",
    async () => {
      const venue = await create();
      const before = await row(venue.id);
      for (const fields of [
        { ownerId: ids.users.ownerB },
        { status: "approved" },
        { ratingAvg: 5 },
        { reviewCount: 100 },
        { fromPrice: 0 },
        { coverUrl: "https://example.test/fake" },
        { slug: "forged" },
        { deletedAt: "2020-01-01" },
        { lat: 91 },
        { lng: -181 },
        { lat: "10.5" },
      ]) {
        for (const [method, path, body] of [
          ["POST", "/venues", { ...venueCreatePayload(), ...fields }],
          ["PATCH", `/venues/${venue.id}`, fields],
        ] as const) {
          const r = await req(method, path, body);
          assert.equal(r.status, 400);
          const error = (await read(r)).error;
          assert.equal(error.code, "VALIDATION_ERROR");
          assert.equal(error.httpStatus, 400);
        }
      }
      assert.deepEqual(await row(venue.id), before);
    },
  );
  await t.test(
    "acceptance: hidden statuses and soft deletion return 404 by slug as well as UUID",
    async () => {
      const venue = await create();
      for (const status of ["pending", "rejected", "suspended", "approved"]) {
        await pool.query(
          "UPDATE venues SET status=$1,deleted_at=CASE WHEN $1='approved' THEN now() ELSE NULL END WHERE id=$2",
          [status, venue.id],
        );
        for (const identifier of [venue.id, venue.slug])
          for (const who of ["ownerA", "admin"]) {
            const r = await req("GET", `/venues/${identifier}`, undefined, who);
            assert.equal(r.status, 404);
            assert.equal((await read(r)).error.code, "NOT_FOUND");
          }
      }
    },
  );
  await t.test(
    "acceptance: resource existence precedes invalid moderation body",
    async () => {
      for (const id of [ids.missing, ids.venues.deletedA]) {
        const r = await req(
          "PATCH",
          `/venues/${id}/status`,
          { status: "rejected" },
          "admin",
        );
        assert.equal(r.status, 404);
        assert.equal((await read(r)).error.code, "NOT_FOUND");
      }
    },
  );
  await t.test(
    "acceptance: suspension committed between guard and transaction blocks every mutation",
    async () => {
      for (const operation of ["create", "update", "delete", "moderate"]) {
        const venue = await create();
        const before = await row(venue.id);
        const who = operation === "moderate" ? "admin" : "ownerA";
        const userId = ids.users[who];
        const auth = app.get(AuthService);
        const original = auth.requireActiveUser.bind(auth);
        const blocker = await pool.connect();
        let reached!: () => void;
        const entered = new Promise<void>((resolve) => {
          reached = resolve;
        });
        auth.requireActiveUser = (...args) => {
          if (args[1]) reached();
          return original(...args);
        };
        let pending: Promise<Response> | undefined;
        try {
          await blocker.query("BEGIN");
          await blocker.query(
            "UPDATE users SET status='suspended' WHERE id=$1",
            [userId],
          );
          pending =
            operation === "create"
              ? req("POST", "/venues", venueCreatePayload())
              : operation === "delete"
                ? req("DELETE", `/venues/${venue.id}`)
                : operation === "moderate"
                  ? req(
                      "PATCH",
                      `/venues/${venue.id}/status`,
                      { status: "approved" },
                      who,
                    )
                  : req("PATCH", `/venues/${venue.id}`, {
                      name: "Must not write",
                    });
          await Promise.race([
            entered,
            new Promise<never>((_, reject) => {
              const timer = setTimeout(
                () => reject(new Error("Transaction not reached")),
                10000,
              );
              timer.unref();
            }),
          ]);
          await blocker.query("COMMIT");
          const r = await pending;
          assert.equal(r.status, 403);
          assert.equal((await read(r)).error.code, "ACCOUNT_SUSPENDED");
          assert.deepEqual(await row(venue.id), before);
        } finally {
          auth.requireActiveUser = original;
          await blocker.query("ROLLBACK");
          if (pending) await pending.catch(() => undefined);
          await blocker.query("UPDATE users SET status='active' WHERE id=$1", [
            userId,
          ]);
          blocker.release();
        }
      }
    },
  );
  await t.test(
    "acceptance: concurrent PATCH and DELETE never resurrect or partially update Venue",
    async () => {
      const venue = await create();
      const [updated, deleted] = await Promise.all([
        req("PATCH", `/venues/${venue.id}`, {
          name: "Concurrent change",
          sportIds: [],
        }),
        req("DELETE", `/venues/${venue.id}`),
      ]);
      assert.equal(deleted.status, 204);
      assert.ok([200, 404].includes(updated.status));
      const stored = await row(venue.id);
      assert.ok(stored.deleted_at);
      assert.equal(
        stored.name,
        updated.status === 200 ? "Concurrent change" : venue.name,
      );
      const links = await pool.query(
        "SELECT * FROM venue_sports WHERE venue_id=$1",
        [venue.id],
      );
      assert.equal(
        links.rowCount,
        updated.status === 200 ? 0 : venue.sportIds.length,
      );
      assert.equal((await req("GET", `/venues/${venue.id}`)).status, 404);
    },
  );
}
