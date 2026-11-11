import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readdir } from "node:fs/promises";
import { test } from "node:test";
import { Pool } from "pg";
import { v7 } from "uuid";
import { readVenueTestMigration } from "./fixtures/venue-test-db.js";
import {
  seedVenueFixtures,
  venueFixtureIds as ids,
} from "./fixtures/venues.fixture.js";

// Database readiness only: this is not an implementation/test of the future hold API.
test("Phase 4 prerequisite constraints against isolated PostgreSQL", async (t) => {
  const connectionString = process.env.VENUE_TEST_DATABASE_URL;
  assert.ok(
    connectionString,
    "Set VENUE_TEST_DATABASE_URL to local test PostgreSQL",
  );
  assert.ok(
    ["localhost", "127.0.0.1", "[::1]"].includes(
      new URL(connectionString).hostname,
    ),
  );
  const name = `bsc014_test_${randomBytes(6).toString("hex")}`;
  const admin = new Pool({ connectionString, connectionTimeoutMillis: 5000 });
  const pool = new Pool({
    connectionString,
    options: `-c search_path=${name},public -c statement_timeout=10000`,
    connectionTimeoutMillis: 5000,
  });
  await admin.query(`CREATE SCHEMA "${name}"`);
  try {
    for (const file of (
      await readdir(new URL("../src/database/migrations/", import.meta.url))
    )
      .filter((file) => file.endsWith(".sql"))
      .sort()) {
      await pool.query(await readVenueTestMigration(file));
    }
    const client = await pool.connect();
    try {
      await seedVenueFixtures(client, "$argon2id$test-fixture-not-for-login");
    } finally {
      client.release();
    }
    const courtId = v7();
    await pool.query(
      "INSERT INTO courts(id,venue_id,name) VALUES($1,$2,'Phase 4 readiness court')",
      [courtId, ids.venues.approvedA],
    );
    const insertBooking = (id: string, start: string, end: string) =>
      pool.query(
        "INSERT INTO bookings(id,court_id,customer_id,during,status,total_price,deposit_amount,expires_at) VALUES($1,$2,$3,tstzrange($4::timestamptz,$5::timestamptz,'[)'),'held',100000,50000,now()+interval '10 minutes')",
        [id, courtId, ids.users.customer, start, end],
      );
    await t.test(
      "two actual DB connections competing for the same slot have one winner",
      async () => {
        const first = await pool.connect();
        const second = await pool.connect();
        try {
          await Promise.all([first.query("BEGIN"), second.query("BEGIN")]);
          const firstId = v7();
          const secondId = v7();
          const sql =
            "INSERT INTO bookings(id,court_id,customer_id,during,status,total_price,deposit_amount,expires_at) VALUES($1,$2,$3,'[2035-01-01 01:00:00+00,2035-01-01 02:00:00+00)','held',100000,50000,now()+interval '10 minutes')";
          await first.query(sql, [firstId, courtId, ids.users.customer]);
          const competing = second.query(sql, [
            secondId,
            courtId,
            ids.users.customer,
          ]);
          const rejected = assert.rejects(
            competing,
            (error: unknown) =>
              typeof error === "object" &&
              error !== null &&
              "code" in error &&
              error.code === "23P01",
          );
          await first.query("COMMIT");
          await rejected;
          await second.query("ROLLBACK");
          assert.equal(
            (
              await pool.query(
                "SELECT count(*)::int AS count FROM bookings WHERE id IN ($1,$2)",
                [firstId, secondId],
              )
            ).rows[0].count,
            1,
          );
        } finally {
          await first.query("ROLLBACK");
          await second.query("ROLLBACK");
          first.release();
          second.release();
        }
      },
    );
    await t.test(
      "blackout trigger rejects a booking within maintenance",
      async () => {
        await pool.query(
          "INSERT INTO blackout_periods(id,court_id,during,reason) VALUES($1,$2,'[2035-01-02 01:00:00+00,2035-01-02 02:00:00+00)','Readiness test')",
          [v7(), courtId],
        );
        await assert.rejects(
          insertBooking(v7(), "2035-01-02T01:00:00Z", "2035-01-02T02:00:00Z"),
          (error: unknown) =>
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "23P01",
        );
      },
    );
    await t.test(
      "time-range trigger rejects times off the 30-minute grid",
      async () => {
        await assert.rejects(
          insertBooking(v7(), "2035-01-03T01:15:00Z", "2035-01-03T02:00:00Z"),
          (error: unknown) =>
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "23514",
        );
      },
    );
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${name}" CASCADE`);
    await admin.end();
  }
});
