import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import type { INestApplication } from "@nestjs/common";
import type { Pool } from "pg";
import { v7 } from "uuid";
import { AuthJwtService } from "../../src/modules/auth/auth-jwt.service.js";
import { AuthService } from "../../src/modules/auth/auth.service.js";
import {
  venueFixtureIds as ids,
  venueCreatePayload,
} from "./venues.fixture.js";
import type {
  OwnerVenueResponse,
  ApiErrorBody,
} from "../../../../packages/shared/src/types.js";

export async function runVenueModerationCases(
  t: TestContext,
  app: INestApplication,
  pool: Pool,
) {
  const base = await app.getUrl();
  const adminB = v7();
  await pool.query(
    "INSERT INTO users(id,email,full_name,password_hash,role,status) SELECT $1,'adminb@bsc014.example.test','Admin B',password_hash,'admin','active' FROM users WHERE id=$2",
    [adminB, ids.users.admin],
  );
  const tokens = Object.fromEntries(
    await Promise.all(
      Object.entries({ ...ids.users, adminB }).map(async ([key, id]) => [
        key,
        await app.get(AuthJwtService).sign(id, "access", false),
      ]),
    ),
  );
  const request = (
    method: string,
    path: string,
    body?: unknown,
    who = "admin",
  ) =>
    fetch(`${base}/api/v1${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(tokens[who] ? { Cookie: `access_token=${tokens[who]}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(20000),
    });
  const read = (r: Response) =>
    r.json() as Promise<{ data: OwnerVenueResponse } & ApiErrorBody>;
  const create = async () => {
    const r = await request("POST", "/venues", venueCreatePayload(), "ownerA");
    assert.equal(r.status, 201);
    return (await read(r)).data;
  };
  const status = (id: string, body: unknown, who = "admin") =>
    request("PATCH", `/venues/${id}/status`, body, who);
  const row = async (id: string) =>
    (await pool.query("SELECT * FROM venues WHERE id=$1", [id])).rows[0];
  const audit = async (id: string) =>
    (
      await pool.query(
        "SELECT * FROM audit_logs WHERE entity_id=$1 ORDER BY created_at,id",
        [id],
      )
    ).rows;

  await t.test(
    "moderation guards/body/UUID/missing/deleted validation",
    async () => {
      const venue = await create();
      for (const [who, code] of [
        ["guest", 401],
        ["customer", 403],
        ["ownerA", 403],
        ["ownerB", 403],
        ["suspendedOwner", 403],
      ] as const)
        assert.equal(
          (await status(venue.id, { status: "approved" }, who)).status,
          code,
        );
      for (const body of [
        { status: "rejected" },
        { status: "rejected", reason: "  " },
        { status: "approved", reason: "no" },
        { status: "invalid" },
        { status: "approved", ownerId: ids.users.admin },
      ])
        assert.equal((await status(venue.id, body)).status, 400);
      assert.equal(
        (await status("invalid-id", { status: "approved" })).status,
        400,
      );
      for (const id of [ids.missing, ids.venues.deletedA])
        assert.equal((await status(id, { status: "approved" })).status, 404);
      assert.equal((await row(venue.id)).status, "pending");
      assert.equal((await audit(venue.id)).length, 0);
    },
  );
  await t.test(
    "create reject owner feedback resubmit approve suspend requeue full HTTP flow",
    async () => {
      const venue = await create();
      const rejected = await status(venue.id, {
        status: "rejected",
        reason: "  Bổ sung địa chỉ  ",
      });
      assert.equal(rejected.status, 200);
      assert.equal(
        (await read(rejected)).data.rejectionReason,
        "Bổ sung địa chỉ",
      );
      assert.equal((await request("GET", `/venues/${venue.id}`)).status, 404);
      const mine = await request(
        "GET",
        "/owner/venues?limit=100",
        undefined,
        "ownerA",
      );
      const body = (await mine.json()) as { data: OwnerVenueResponse[] };
      assert.equal(
        body.data.find((v) => v.id === venue.id)?.rejectionReason,
        "Bổ sung địa chỉ",
      );
      const other = await request(
        "GET",
        "/owner/venues?limit=100",
        undefined,
        "ownerB",
      );
      assert.ok(
        !((await other.json()) as { data: OwnerVenueResponse[] }).data.some(
          (v) => v.id === venue.id,
        ),
      );
      assert.equal(
        (
          await request(
            "PATCH",
            `/venues/${venue.id}`,
            { address: "456 Updated address" },
            "ownerA",
          )
        ).status,
        200,
      );
      assert.equal((await row(venue.id)).rejection_reason, null);
      assert.equal(
        (await status(venue.id, { status: "approved" })).status,
        200,
      );
      const publicResult = await request(
        "GET",
        `/venues/${venue.slug}`,
        undefined,
        "guest",
      );
      assert.equal(publicResult.status, 200);
      assert.equal("rejectionReason" in (await read(publicResult)).data, false);
      assert.equal(
        (await status(venue.id, { status: "suspended" })).status,
        200,
      );
      assert.equal((await request("GET", `/venues/${venue.id}`)).status, 404);
      assert.equal((await status(venue.id, { status: "pending" })).status, 200);
      assert.equal(
        (await status(venue.id, { status: "approved" })).status,
        200,
      );
      const logs = await audit(venue.id);
      assert.equal(logs.length, 5);
      for (const log of logs) {
        assert.equal(log.action, "venue.status_changed");
        assert.equal(log.actor_id, ids.users.admin);
        assert.deepEqual(Object.keys(log.new_data).sort(), [
          "hasRejectionReason",
          "status",
        ]);
        assert.ok(!JSON.stringify(log).includes("Bổ sung"));
        assert.equal(log.ip_address, null);
      }
    },
  );
  await t.test(
    "retries preserve updatedAt/audit, changed reason rejected, legacy null filled once",
    async () => {
      const venue = await create();
      assert.equal((await status(venue.id, { status: "pending" })).status, 200);
      assert.equal((await audit(venue.id)).length, 0);
      await status(venue.id, { status: "rejected", reason: "Reason" });
      const before = await row(venue.id);
      assert.equal(
        (await status(venue.id, { status: "rejected", reason: " Reason " }))
          .status,
        200,
      );
      assert.deepEqual(await row(venue.id), before);
      assert.equal((await audit(venue.id)).length, 1);
      const bad = await status(venue.id, {
        status: "rejected",
        reason: "Different",
      });
      assert.equal(bad.status, 400);
      assert.equal((await read(bad)).error.code, "INVALID_STATUS_TRANSITION");
      assert.equal(
        (await status(venue.id, { status: "approved" })).status,
        400,
      );
      await pool.query("UPDATE venues SET rejection_reason=NULL WHERE id=$1", [
        venue.id,
      ]);
      assert.equal(
        (
          await status(venue.id, {
            status: "rejected",
            reason: "Legacy supplied",
          })
        ).status,
        200,
      );
      const filled = await row(venue.id);
      assert.equal(
        (
          await status(venue.id, {
            status: "rejected",
            reason: "Legacy supplied",
          })
        ).status,
        200,
      );
      assert.deepEqual(await row(venue.id), filled);
      assert.equal((await audit(venue.id)).length, 2);
    },
  );
  await t.test(
    "two distinct Admins approve/reject concurrently serialize on Venue",
    async () => {
      const venue = await create();
      const results = await Promise.all([
        status(venue.id, { status: "approved" }),
        status(
          venue.id,
          { status: "rejected", reason: "Concurrent reason" },
          "adminB",
        ),
      ]);
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]);
      const stored = await row(venue.id);
      assert.equal(
        stored.rejection_reason,
        stored.status === "rejected" ? "Concurrent reason" : null,
      );
      assert.equal((await audit(venue.id)).length, 1);
      const another = await create();
      const same = await Promise.all([
        status(another.id, { status: "approved" }),
        status(another.id, { status: "approved" }, "adminB"),
      ]);
      assert.deepEqual(
        same.map((r) => r.status),
        [200, 200],
      );
      assert.equal((await audit(another.id)).length, 1);
    },
  );
  await t.test("Admin role revoked after guard cannot moderate", async () => {
    const venue = await create();
    const blocker = await pool.connect();
    const auth = app.get(AuthService);
    const original = auth.requireActiveUser.bind(auth);
    let reached!: () => void;
    const entered = new Promise<void>((resolve) => {
      reached = resolve;
    });
    auth.requireActiveUser = (...args) => {
      if (args[1]) reached();
      return original(...args);
    };
    try {
      await blocker.query("BEGIN");
      await blocker.query("UPDATE users SET role='customer' WHERE id=$1", [
        ids.users.admin,
      ]);
      const pending = status(venue.id, { status: "approved" });
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
      assert.equal((await pending).status, 403);
      assert.equal((await row(venue.id)).status, "pending");
      assert.equal((await audit(venue.id)).length, 0);
    } finally {
      auth.requireActiveUser = original;
      await blocker.query("ROLLBACK");
      await blocker.query("UPDATE users SET role='admin' WHERE id=$1", [
        ids.users.admin,
      ]);
      blocker.release();
    }
  });
  await t.test(
    "audit failure rolls back status/reason/timestamp without leaking SQL",
    async () => {
      const venue = await create();
      const before = await row(venue.id);
      await pool.query(
        "CREATE FUNCTION fail_moderation_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private audit diagnostic'; END $$; CREATE TRIGGER fail_moderation_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION fail_moderation_audit()",
      );
      try {
        const response = await status(venue.id, {
          status: "rejected",
          reason: "Secret reason",
        });
        assert.equal(response.status, 500);
        const body = await read(response);
        assert.equal(body.error.code, "INTERNAL_ERROR");
        assert.ok(!JSON.stringify(body).includes("diagnostic"));
        assert.deepEqual(await row(venue.id), before);
        assert.equal((await audit(venue.id)).length, 0);
      } finally {
        await pool.query(
          "DROP TRIGGER fail_moderation_audit ON audit_logs; DROP FUNCTION fail_moderation_audit()",
        );
      }
    },
  );
}
