import assert from "node:assert/strict";
import { test } from "node:test";
import {
  withVenueTestSchema,
  readVenueTestMigration,
} from "./fixtures/venue-test-db.js";
import { seedPhase4Fixtures } from "./fixtures/phase4.fixture.js";
test("0009 upgrades populated 0008 and can rehearse index-only down/up without data loss", async () => {
  const connection = process.env.VENUE_TEST_DATABASE_URL;
  assert.ok(connection, "Set explicit local test PostgreSQL URL");
  await withVenueTestSchema(
    connection,
    async (client) => {
      await seedPhase4Fixtures(client, "$argon2id$test-fixture-not-for-login");
      const before = (
        await client.query(
          "SELECT (SELECT count(*) FROM bookings) AS bookings,(SELECT count(*) FROM payments) AS payments",
        )
      ).rows[0];
      const migration = await readVenueTestMigration(
        "0009_admin-reporting-indexes.sql",
      );
      await client.query(migration);
      assert.equal(
        (
          await client.query(
            "SELECT count(*)::int AS n FROM pg_indexes WHERE schemaname=current_schema() AND indexname=ANY($1)",
            [
              [
                "idx_bookings_start",
                "idx_payments_collected_at",
                "idx_payments_refunded_at",
              ],
            ],
          )
        ).rows[0].n,
        3,
      );
      await client.query(
        "DROP INDEX idx_bookings_start; DROP INDEX idx_payments_collected_at; DROP INDEX idx_payments_refunded_at",
      );
      await client.query(migration);
      assert.deepEqual(
        (
          await client.query(
            "SELECT (SELECT count(*) FROM bookings) AS bookings,(SELECT count(*) FROM payments) AS payments",
          )
        ).rows[0],
        before,
      );
    },
    "0008",
  );
});
