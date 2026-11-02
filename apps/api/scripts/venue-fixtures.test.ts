import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { Pool, type PoolClient } from "pg";
import {
  hashPassword,
  verifyPassword,
} from "../src/modules/auth/auth-secrets.js";
import {
  seedVenueFixtures,
  venueFixtureIds as ids,
  venueFixtureReason,
  venueInvalidPayloads,
} from "./fixtures/venues.fixture.js";
import {
  withVenueTestSchema,
  readVenueTestMigration,
} from "./fixtures/venue-test-db.js";

const connectionString = process.env.VENUE_TEST_DATABASE_URL;
assert.ok(
  connectionString,
  "Set VENUE_TEST_DATABASE_URL explicitly to a local PostgreSQL test database",
);
const password = randomBytes(24).toString("base64url");
const passwordHash = await hashPassword(password);

async function rejectsSql(
  client: PoolClient,
  sql: string,
  values: unknown[],
  code: string,
) {
  await client.query("SAVEPOINT invalid_fixture");
  try {
    await assert.rejects(
      client.query(sql, values),
      (error: unknown) =>
        error instanceof Error && "code" in error && error.code === code,
    );
  } finally {
    await client.query("ROLLBACK TO SAVEPOINT invalid_fixture");
    await client.query("RELEASE SAVEPOINT invalid_fixture");
  }
}

test("fresh migrations and reusable fixtures cover identities, states and DB constraints", async () => {
  await withVenueTestSchema(connectionString, async (client) => {
    await seedVenueFixtures(client, passwordHash);
    const users = await client.query(
      "SELECT id,role,status,password_hash FROM users ORDER BY id",
    );
    assert.equal(users.rowCount, 5);
    assert.deepEqual(
      users.rows.map((u) => [u.role, u.status]),
      [
        ["owner", "active"],
        ["owner", "active"],
        ["admin", "active"],
        ["customer", "active"],
        ["owner", "suspended"],
      ],
    );
    assert.equal(
      await verifyPassword(users.rows[0].password_hash, password),
      true,
    );
    const venues = await client.query("SELECT * FROM venues ORDER BY id");
    assert.equal(venues.rowCount, 8);
    assert.deepEqual(
      venues.rows.map((v) => v.status),
      [
        "pending",
        "approved",
        "rejected",
        "suspended",
        "approved",
        "approved",
        "rejected",
        "pending",
      ],
    );
    assert.equal(
      venues.rows.find((v) => v.id === ids.venues.deletedA)
        ?.deleted_at instanceof Date,
      true,
    );
    assert.equal(
      venues.rows.find((v) => v.id === ids.venues.rejectedA)?.rejection_reason,
      venueFixtureReason,
    );
    const legacy = venues.rows.find((v) => v.id === ids.venues.legacyRejectedB);
    assert.ok(legacy);
    assert.deepEqual(
      [legacy.rejection_reason, legacy.lat, legacy.lng, legacy.from_price],
      [null, null, null, null],
    );
    assert.equal(legacy.owner_id, ids.users.ownerB);
    // Fixture expectations for future API tests, not an implementation of visibility.
    const visible = await client.query(
      "SELECT id FROM venues WHERE status='approved' AND deleted_at IS NULL ORDER BY id",
    );
    assert.deepEqual(
      visible.rows.map((v) => v.id),
      [ids.venues.approvedA, ids.venues.approvedB],
    );
    const ownerA = await client.query(
      "SELECT id FROM venues WHERE owner_id=$1 AND deleted_at IS NULL",
      [ids.users.ownerA],
    );
    assert.equal(ownerA.rowCount, 4);
    assert.equal((await client.query("SELECT * FROM sports")).rowCount, 2);
    assert.equal((await client.query("SELECT * FROM amenities")).rowCount, 2);
    assert.equal(
      (await client.query("SELECT * FROM venue_sports")).rowCount,
      8,
    );
    assert.equal(
      (await client.query("SELECT * FROM venue_amenities")).rowCount,
      8,
    );
    const invalid = venueInvalidPayloads();
    await rejectsSql(
      client,
      "UPDATE venues SET district_id=$1 WHERE id=$2",
      [invalid.wrongProvince.districtId, ids.venues.pendingA],
      "23514",
    );
    await rejectsSql(
      client,
      "UPDATE venues SET province_id=$1 WHERE id=$2",
      [invalid.wrongAreaType.provinceId, ids.venues.pendingA],
      "23514",
    );
    await rejectsSql(
      client,
      "INSERT INTO venue_sports (venue_id,sport_id) VALUES ($1,$2)",
      [ids.venues.pendingA, ids.missing],
      "23503",
    );
    await rejectsSql(
      client,
      "INSERT INTO venue_amenities (venue_id,amenity_id) VALUES ($1,$2)",
      [ids.venues.pendingA, ids.missing],
      "23503",
    );
    await rejectsSql(
      client,
      "UPDATE venues SET slug=(SELECT slug FROM venues WHERE id=$1) WHERE id=$2",
      [ids.venues.approvedA, ids.venues.pendingA],
      "23505",
    );
    const unchanged = await client.query(
      "SELECT province_id,district_id FROM venues WHERE id=$1",
      [ids.venues.pendingA],
    );
    assert.deepEqual(unchanged.rows[0], {
      province_id: ids.areas.provinceA,
      district_id: ids.areas.districtA,
    });
  });
});

test("upgrade 0001–0006 to 0007 preserves all legacy rows and adds nullable reason", async () => {
  await withVenueTestSchema(
    connectionString,
    async (client) => {
      await seedVenueFixtures(client, passwordHash, { legacySchema: true });
      const before = await client.query("SELECT * FROM venues ORDER BY id");
      await client.query(
        await readVenueTestMigration("0007_add-venue-rejection-reason.sql"),
      );
      const after = await client.query("SELECT * FROM venues ORDER BY id");
      assert.deepEqual(
        after.rows.map(({ rejection_reason, ...row }) => {
          assert.equal(rejection_reason, null);
          return row;
        }),
        before.rows,
      );
      await client.query("UPDATE venues SET rejection_reason=$1 WHERE id=$2", [
        venueFixtureReason,
        ids.venues.rejectedA,
      ]);
      assert.equal(
        (
          await client.query(
            "SELECT rejection_reason FROM venues WHERE id=$1",
            [ids.venues.rejectedA],
          )
        ).rows[0].rejection_reason,
        venueFixtureReason,
      );
      await client.query(
        "UPDATE venues SET status='pending',rejection_reason=NULL WHERE id=$1",
        [ids.venues.rejectedA],
      );
      assert.equal(
        (
          await client.query(
            "SELECT rejection_reason FROM venues WHERE id=$1",
            [ids.venues.rejectedA],
          )
        ).rows[0].rejection_reason,
        null,
      );
    },
    "0006",
  );
});

test("fixture can be recreated with identical IDs in a new isolated schema", async () => {
  const snapshots = [];
  for (let run = 0; run < 2; run++) {
    snapshots.push(
      await withVenueTestSchema(connectionString, async (client) => {
        await seedVenueFixtures(client, passwordHash);
        return (
          await client.query(
            "SELECT id,owner_id,status,slug FROM venues ORDER BY id",
          )
        ).rows;
      }),
    );
  }
  assert.deepEqual(snapshots[0], snapshots[1]);
});

test("fixture refuses public schema and failure rolls back the temporary schema", async () => {
  let schemaName = "";
  await assert.rejects(
    withVenueTestSchema(connectionString, async (client) => {
      schemaName = (await client.query("SELECT current_schema() AS name"))
        .rows[0].name;
      await client.query("SET LOCAL search_path TO public");
      await seedVenueFixtures(client, passwordHash);
    }),
    /isolated bsc014_test/,
  );
  assert.match(schemaName, /^bsc014_test_[a-f0-9]{12}$/);
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 5000 });
  try {
    const remaining = await pool.query(
      "SELECT 1 FROM pg_namespace WHERE nspname=$1",
      [schemaName],
    );
    assert.equal(remaining.rowCount, 0);
  } finally {
    await pool.end();
  }
});
