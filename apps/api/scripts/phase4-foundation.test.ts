import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import type { PoolClient } from "pg";
import { v7 } from "uuid";
import {
  withVenueTestSchema,
  readVenueTestMigration,
} from "./fixtures/venue-test-db.js";
import {
  seedVenueFixtures,
  venueFixtureIds as venue,
} from "./fixtures/venues.fixture.js";
import {
  phase4FixtureIds as ids,
  seedPhase4Fixtures,
} from "./fixtures/phase4.fixture.js";
import { OwnerApplicationsRepository } from "../src/modules/owner-applications/owner-applications.repository.js";
import { drizzle } from "drizzle-orm/node-postgres";

const connection = process.env.VENUE_TEST_DATABASE_URL;
assert.ok(
  connection,
  "Set VENUE_TEST_DATABASE_URL to explicit local PostgreSQL",
);
const hash = "$argon2id$fixture-not-for-login";

async function rejectsSql(
  client: PoolClient,
  sql: string,
  values: unknown[],
  code: string,
) {
  await client.query("SAVEPOINT invalid_case");
  try {
    await assert.rejects(
      client.query(sql, values),
      (error: unknown) =>
        error instanceof Error && "code" in error && error.code === code,
    );
  } finally {
    await client.query("ROLLBACK TO SAVEPOINT invalid_case");
    await client.query("RELEASE SAVEPOINT invalid_case");
  }
}

test("Phase 4 fresh migration, fixture and DB guarantees", async (t) => {
  await withVenueTestSchema(connection, async (client) => {
    await seedPhase4Fixtures(client, hash);
    await t.test(
      "identities, all payment states, private snapshots and two-decimal visible rating",
      async () => {
        assert.equal(
          (await client.query("SELECT count(*)::int n FROM users")).rows[0].n,
          7,
        );
        const roles = (
          await client.query(
            "SELECT role,count(*)::int n FROM users WHERE status='active' GROUP BY role",
          )
        ).rows;
        assert.deepEqual(Object.fromEntries(roles.map((r) => [r.role, r.n])), {
          admin: 2,
          customer: 2,
          owner: 2,
        });
        assert.equal(
          (
            await client.query(
              "SELECT count(DISTINCT status)::int n FROM payments",
            )
          ).rows[0].n,
          7,
        );
        assert.equal(
          (
            await client.query(
              "SELECT rating_avg,review_count FROM venues WHERE id=$1",
              [ids.venues.a],
            )
          ).rows[0].rating_avg,
          "4.33",
        );
        assert.equal(
          (
            await client.query(
              "SELECT count(*)::int n FROM owner_applications WHERE tax_code IS NOT NULL",
            )
          ).rows[0].n,
          3,
        );
        assert.equal(
          (
            await client.query(
              "SELECT count(*)::int n FROM bookings WHERE source='manual' AND customer_id IS NULL",
            )
          ).rows[0].n,
          1,
        );
        await client.query(
          "UPDATE venue_payment_accounts SET account_no='9999999999' WHERE venue_id=$1",
          [ids.venues.a],
        );
        assert.equal(
          (
            await client.query(
              "SELECT bank_account_snapshot FROM payments WHERE id=$1",
              [ids.payments.pending],
            )
          ).rows[0].bank_account_snapshot.accountNo,
          "1234567890",
        );
      },
    );
    await t.test(
      "unique transfer code and active payment are separate constraints",
      async () => {
        await rejectsSql(
          client,
          "INSERT INTO payments(id,booking_id,amount,transfer_code,status) VALUES($1,$2,50000,$3,'expired')",
          [v7(), ids.bookings.expired, "P4-pending"],
          "23505",
        );
        await rejectsSql(
          client,
          "INSERT INTO payments(id,booking_id,amount,transfer_code) VALUES($1,$2,50000,$3)",
          [v7(), ids.bookings.pending, "P4-duplicate-active"],
          "23505",
        );
        // Terminal history may coexist; uniqueness must not prohibit historical attempts.
        await client.query(
          "INSERT INTO payments(id,booking_id,amount,transfer_code,status) VALUES($1,$2,50000,'P4-terminal-history','expired')",
          [v7(), ids.bookings.pending],
        );
      },
    );
    await t.test(
      "review, OAuth identity and pending application uniqueness",
      async () => {
        await rejectsSql(
          client,
          "INSERT INTO reviews(id,booking_id,venue_id,customer_id,rating) VALUES($1,$2,$3,$4,5)",
          [v7(), ids.bookings.completed, ids.venues.a, ids.users.customerA],
          "23505",
        );
        await rejectsSql(
          client,
          "INSERT INTO oauth_accounts(id,user_id,provider,provider_id) VALUES($1,$2,'google','fixture-google-subject')",
          [v7(), ids.users.customerA],
          "23505",
        );
        await rejectsSql(
          client,
          "INSERT INTO owner_applications(id,user_id,business_name,phone,address) VALUES($1,$2,'Duplicate','0912345678','Test address')",
          [v7(), ids.users.customerA],
          "23505",
        );
      },
    );
    await t.test(
      "snapshot shape, immutability, proof timestamps, tax and session checks",
      async () => {
        await rejectsSql(
          client,
          "UPDATE payments SET bank_account_snapshot='{}' WHERE id=$1",
          [ids.payments.legacy],
          "23514",
        );
        await rejectsSql(
          client,
          "UPDATE payments SET bank_account_snapshot=NULL WHERE id=$1",
          [ids.payments.pending],
          "23514",
        );
        await rejectsSql(
          client,
          "UPDATE payments SET proof_updated_at='2034-01-01' WHERE id=$1",
          [ids.payments.submitted],
          "23514",
        );
        await rejectsSql(
          client,
          "UPDATE owner_applications SET tax_code='invalid' WHERE id=$1",
          [ids.applications.pending],
          "23514",
        );
        await rejectsSql(
          client,
          "UPDATE users SET session_version=-1 WHERE id=$1",
          [ids.users.customerA],
          "23514",
        );
      },
    );
    await t.test(
      "notification/outbox dedupe, lease checks and atomic rollback",
      async () => {
        const sql =
          "INSERT INTO outbox_deliveries(id,event_key,event_type,channel,recipient_id,payload) VALUES($1,'fixture:event','booking_confirmed','email',$2,'{}')";
        await client.query(sql, [v7(), ids.users.customerA]);
        await rejectsSql(client, sql, [v7(), ids.users.customerA], "23505");
        await rejectsSql(
          client,
          "UPDATE outbox_deliveries SET status='processing' WHERE event_key='fixture:event'",
          [],
          "23514",
        );
        const notice =
          "INSERT INTO notifications(id,user_id,event_key,type,title,body) VALUES($1,$2,'fixture:event','booking_confirmed','Fixture','Fixture')";
        await client.query(notice, [v7(), ids.users.customerA]);
        await rejectsSql(client, notice, [v7(), ids.users.customerA], "23505");
        await client.query("SAVEPOINT atomic_event");
        await client.query(
          "UPDATE payments SET status='rejected' WHERE id=$1",
          [ids.payments.pending],
        );
        await client.query(
          "INSERT INTO audit_logs(id,action,entity_type) VALUES($1,'fixture.rollback','payment')",
          [v7()],
        );
        await assert.rejects(client.query(sql, [v7(), ids.users.customerA]));
        await client.query("ROLLBACK TO SAVEPOINT atomic_event");
        assert.equal(
          (
            await client.query("SELECT status FROM payments WHERE id=$1", [
              ids.payments.pending,
            ])
          ).rows[0].status,
          "pending",
        );
        assert.equal(
          (
            await client.query(
              "SELECT count(*)::int n FROM audit_logs WHERE action='fixture.rollback'",
            )
          ).rows[0].n,
          0,
        );
      },
    );
    await t.test(
      "OAuth state hash/expiry and storage cleanup constraints",
      async () => {
        const values = [v7(), "a".repeat(64), "b".repeat(64), "c".repeat(64)];
        await client.query(
          "INSERT INTO oauth_states(id,state_hash,binding_hash,nonce_hash,pkce_verifier_ciphertext,expires_at) VALUES($1,$2,$3,$4,'fixture-ciphertext',now()+interval '10 minutes')",
          values,
        );
        await rejectsSql(
          client,
          "INSERT INTO oauth_states(id,state_hash,binding_hash,nonce_hash,pkce_verifier_ciphertext,expires_at) VALUES($1,$2,$3,$4,'fixture-ciphertext',now()+interval '11 minutes')",
          [v7(), "d".repeat(64), values[2], values[3]],
          "23514",
        );
        await client.query(
          "INSERT INTO storage_cleanup_jobs(id,object_key,not_before) VALUES($1,'private/fixture/orphan',now()+interval '24 hours')",
          [v7()],
        );
        await rejectsSql(
          client,
          "UPDATE storage_cleanup_jobs SET status='processing'",
          [],
          "23514",
        );
      },
    );
    await t.test(
      "Owner application repository persists and reads taxCode",
      async () => {
        const repo = new OwnerApplicationsRepository(drizzle(client));
        const row = await repo.create(ids.users.customerB, {
          businessName: "Roundtrip business",
          phone: "0912345678",
          address: "123 Test street",
          taxCode: "0123456789012",
        });
        assert.ok(row);
        assert.equal((await repo.findById(row.id))?.taxCode, "0123456789012");
      },
    );
  });
});

test("Phase 4 upgrades populated 0007 database without inventing legacy fields", async () => {
  await withVenueTestSchema(
    connection,
    async (client) => {
      await seedVenueFixtures(client, hash);
      const bookingId = v7();
      await client.query(
        "INSERT INTO courts(id,venue_id,name) VALUES($1,$2,'Legacy')",
        [bookingId, venue.venues.approvedA],
      );
      await client.query(
        "INSERT INTO bookings(id,court_id,customer_id,during,status,total_price,deposit_amount) VALUES($1,$1,$2,'[2035-01-01 01:00+00,2035-01-01 02:00+00)','completed',100000,50000)",
        [bookingId, venue.users.customer],
      );
      await client.query(
        "INSERT INTO payments(id,booking_id,amount,transfer_code,status,proof_url) VALUES($1,$1,50000,'legacy-transfer','completed','https://legacy.example.test/proof')",
        [bookingId],
      );
      await client.query(
        "INSERT INTO owner_applications(id,user_id,business_name,phone,address) VALUES($1,$2,'Legacy','0912345678','Test address')",
        [v7(), venue.users.customer],
      );
      await client.query(
        await readVenueTestMigration("0008_phase4-foundation.sql"),
      );
      const row = (
        await client.query("SELECT * FROM payments WHERE id=$1", [bookingId])
      ).rows[0];
      assert.equal(row.bank_account_snapshot, null);
      assert.equal(row.proof_object_key, null);
      assert.equal(row.proof_updated_at, null);
      assert.equal(row.paid_at, null);
      assert.equal(row.proof_url, "https://legacy.example.test/proof");
      assert.equal(
        (await client.query("SELECT session_version FROM users LIMIT 1"))
          .rows[0].session_version,
        0,
      );
      assert.equal(
        (await client.query("SELECT tax_code FROM owner_applications LIMIT 1"))
          .rows[0].tax_code,
        null,
      );
      // Match the real runner ledger for a DOWN -> UP rehearsal, in this test schema only.
      await client.query(
        "CREATE TABLE schema_migrations(filename TEXT PRIMARY KEY,applied_at TIMESTAMPTZ DEFAULT now())",
      );
      await client.query(
        "INSERT INTO schema_migrations(filename) VALUES('0008_phase4-foundation.sql')",
      );
      await client.query(
        await readFile(
          new URL("./rollback-phase4-foundation.sql", import.meta.url),
          "utf8",
        ),
      );
      assert.equal(
        (
          await client.query(
            "SELECT count(*)::int n FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='users' AND column_name='session_version'",
          )
        ).rows[0].n,
        0,
      );
      await client.query(
        await readVenueTestMigration("0008_phase4-foundation.sql"),
      );
      assert.equal(
        (
          await client.query(
            "SELECT bank_account_snapshot FROM payments WHERE id=$1",
            [bookingId],
          )
        ).rows[0].bank_account_snapshot,
        null,
      );
    },
    "0007",
  );
});
