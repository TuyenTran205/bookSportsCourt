import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import type { INestApplication } from "@nestjs/common";
import { ServiceUnavailableException } from "@nestjs/common";
import { Pool } from "pg";
import { v7 } from "uuid";
import sharp from "sharp";
import { phase4FixtureIds as ids } from "./phase4.fixture.js";
import { AuthJwtService } from "../../src/modules/auth/auth-jwt.service.js";
import { ProofCleanupService } from "../../src/modules/uploads/proof-cleanup.service.js";
import { PaymentsRepository } from "../../src/modules/payments/payments.repository.js";
import { paymentViewSchema } from "../../../../packages/shared/src/phase4-responses.js";
import { existsSync } from "node:fs";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { readFile } from "node:fs/promises";

export class MemoryProofStorage {
  objects = new Map<string, Buffer>();
  failPut = false;
  failSign = false;
  failDelete = false;
  beforePut?: () => Promise<void>;
  async put(key: string, buffer: Buffer) {
    await this.beforePut?.();
    if (this.failPut)
      throw new ServiceUnavailableException({
        code: "SERVICE_UNAVAILABLE",
        message: "Storage unavailable",
      });
    this.objects.set(key, buffer);
  }
  async delete(key: string) {
    if (this.failDelete) throw new Error("Delete unavailable");
    this.objects.delete(key);
  }
  async signedGet(key: string) {
    if (this.failSign)
      throw new ServiceUnavailableException({
        code: "SERVICE_UNAVAILABLE",
        message: "Signing unavailable",
      });
    return {
      url: "https://private.example.test/" + key + "?X-Amz-Expires=300",
      expiresAt: new Date(Date.now() + 300000).toISOString(),
    };
  }
}
type Request = (
  path: string,
  who?: string,
  method?: string,
  body?: unknown,
) => Promise<Response>;
export async function runPaymentCases(
  t: TestContext,
  app: INestApplication,
  pool: Pool,
  request: Request,
  storage: MemoryProofStorage,
) {
  const image = await sharp({
    create: { width: 2, height: 2, channels: 3, background: "#ffffff" },
  })
    .png()
    .toBuffer();
  const tokens = Object.fromEntries(
    await Promise.all(
      Object.entries(ids.users).map(async ([key, id]) => [
        key,
        await app.get(AuthJwtService).sign(id, "access", false),
      ]),
    ),
  );
  const upload = async (
    bookingId: string,
    who = "customerA",
    options: {
      buffer?: Buffer;
      mime?: string;
      origin?: string | null;
      extra?: boolean;
      duplicate?: boolean;
    } = {},
  ) => {
    const form = new FormData();
    form.append(
      "file",
      new Blob([new Uint8Array(options.buffer ?? image)], {
        type: options.mime ?? "image/png",
      }),
      "proof.png",
    );
    if (options.extra) form.append("amount", "1");
    if (options.duplicate)
      form.append(
        "file",
        new Blob([new Uint8Array(image)], { type: "image/png" }),
        "other.png",
      );
    return fetch(
      `${await app.getUrl()}/api/v1/bookings/${bookingId}/payment/proof`,
      {
        method: "POST",
        headers: {
          ...(tokens[who] ? { Cookie: `access_token=${tokens[who]}` } : {}),
          ...(options.origin === null
            ? {}
            : {
                "X-Request-Origin": options.origin ?? "http://localhost:3000",
              }),
        },
        body: form,
        signal: AbortSignal.timeout(15000),
      },
    );
  };
  const detail = (id: string, who = "customerA") =>
    request("/bookings/" + id + "/payment", who);
  const createCase = async () => {
    const bookingId = v7(),
      paymentId = v7(),
      courtId = v7();
    await pool.query(
      "INSERT INTO courts(id,venue_id,name) VALUES($1,$2,'Payment test')",
      [courtId, ids.venues.a],
    );
    await pool.query(
      "INSERT INTO bookings(id,court_id,customer_id,during,status,total_price,deposit_amount,expires_at) VALUES($1,$2,$3,'[2035-03-01 01:00+00,2035-03-01 02:00+00)','held',100000,50000,clock_timestamp()+interval '10 minutes')",
      [bookingId, courtId, ids.users.customerA],
    );
    await pool.query(
      "INSERT INTO payments(id,booking_id,amount,transfer_code,bank_account_snapshot) VALUES($1,$2,50000,$3,$4)",
      [
        paymentId,
        bookingId,
        "P4-" + paymentId,
        {
          bankBin: "970436",
          accountNo: "1234567890",
          accountName: "FIXTURE OWNER",
        },
      ],
    );
    return { bookingId, paymentId, courtId };
  };
  await t.test(
    "read scopes, snapshot/null legacy, private projection and history",
    async () => {
      const id = ids.bookings.pending;
      for (const [who, status] of [
        ["guest", 401],
        ["adminA", 403],
        ["customerB", 404],
        ["ownerB", 403],
        ["customerA", 200],
        ["ownerA", 200],
      ] as const)
        assert.equal((await detail(id, who)).status, status, who);
      const response = await detail(id);
      const data = paymentViewSchema.parse(
        ((await response.json()) as { data: unknown }).data,
      );
      assert.equal(data.amount, 50000);
      assert.equal(data.proofUrl, null);
      assert.equal(data.bankAccount?.accountNo, "1234567890");
      assert.equal(response.headers.get("cache-control"), "no-store");
      const legacy = paymentViewSchema.parse(
        (
          (await (await detail(ids.bookings.legacy)).json()) as {
            data: unknown;
          }
        ).data,
      );
      assert.equal(legacy.bankAccount, null);
      await pool.query("UPDATE venues SET deleted_at=now() WHERE id=$1", [
        ids.venues.a,
      ]);
      assert.equal((await detail(id, "ownerA")).status, 200);
      await pool.query("UPDATE venues SET deleted_at=NULL WHERE id=$1", [
        ids.venues.a,
      ]);
    },
  );
  await t.test(
    "file guards, origin, invalid UUID, MIME forgery, oversize, extra and duplicate fields",
    async () => {
      const { bookingId } = await createCase();
      for (const [who, status] of [
        ["guest", 401],
        ["adminA", 403],
        ["ownerA", 403],
        ["customerB", 404],
        ["suspendedOwner", 403],
      ] as const)
        assert.equal((await upload(bookingId, who)).status, status, who);
      assert.equal((await upload("invalid")).status, 400);
      for (const origin of [null, "https://evil.example.test"])
        assert.equal(
          (await upload(bookingId, "customerA", { origin })).status,
          403,
        );
      const bad = await upload(bookingId, "customerA", {
        buffer: Buffer.from("fake PNG"),
        mime: "image/png",
      });
      assert.equal(bad.status, 400);
      assert.equal(
        ((await bad.json()) as { error: { code: string } }).error.code,
        "UNSUPPORTED_FILE_TYPE",
      );
      assert.equal(
        (await upload(bookingId, "customerA", { mime: "image/jpeg" })).status,
        400,
      );
      const large = await upload(bookingId, "customerA", {
        buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
      });
      assert.equal(large.status, 413);
      assert.equal(
        ((await large.json()) as { error: { code: string } }).error.code,
        "FILE_TOO_LARGE",
      );
      assert.equal(
        (await upload(bookingId, "customerA", { extra: true })).status,
        400,
      );
      assert.equal(
        (await upload(bookingId, "customerA", { duplicate: true })).status,
        400,
      );
    },
  );
  await t.test(
    "first proof and replacement preserve money/code/first deadline; outbox commits exactly per version",
    async () => {
      const { bookingId, paymentId } = await createCase();
      const response = await upload(bookingId);
      assert.equal(
        response.status,
        200,
        JSON.stringify(await response.clone().json()),
      );
      const first = paymentViewSchema.parse(
        ((await response.json()) as { data: unknown }).data,
      );
      assert.equal(first.bookingStatus, "pending_payment");
      assert.equal(first.status, "submitted");
      assert.equal(first.amount, 50000);
      assert.equal(first.transferCode, "P4-" + paymentId);
      assert.equal(first.proofUploadedAt, first.proofUpdatedAt);
      const secondResponse = await upload(bookingId);
      assert.equal(secondResponse.status, 200);
      const second = paymentViewSchema.parse(
        ((await secondResponse.json()) as { data: unknown }).data,
      );
      assert.equal(second.proofUploadedAt, first.proofUploadedAt);
      assert.equal(second.reviewDeadline, first.reviewDeadline);
      assert.notEqual(second.proofUrl, first.proofUrl);
      assert.equal(
        (
          await pool.query("SELECT expires_at FROM bookings WHERE id=$1", [
            bookingId,
          ])
        ).rows[0].expires_at,
        null,
      );
      const events = (
        await pool.query(
          "SELECT channel,event_type,payload FROM outbox_deliveries WHERE payload->>'paymentId'=$1",
          [paymentId],
        )
      ).rows;
      assert.equal(events.filter((e) => e.channel === "email").length, 1);
      assert.equal(events.filter((e) => e.channel === "realtime").length, 2);
      assert.ok(!JSON.stringify(events).includes("proofs/"));
      assert.ok(!JSON.stringify(events).includes("1234567890"));
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int n FROM payments WHERE booking_id=$1",
            [bookingId],
          )
        ).rows[0].n,
        1,
      );
      assert.equal((await detail(bookingId, "customerB")).status, 404);
      const visible = paymentViewSchema.parse(
        (
          (await (await detail(bookingId, "ownerA")).json()) as {
            data: unknown;
          }
        ).data,
      );
      assert.ok(visible.proofUrl?.includes("X-Amz-Expires=300"));
    },
  );
  await t.test(
    "storage failures, missing snapshot and cash preserve valid state",
    async () => {
      const { bookingId, paymentId } = await createCase();
      storage.failPut = true;
      assert.equal((await upload(bookingId)).status, 503);
      storage.failPut = false;
      assert.equal(
        (
          await pool.query("SELECT status FROM payments WHERE id=$1", [
            paymentId,
          ])
        ).rows[0].status,
        "pending",
      );
      // Legacy case is inserted without a snapshot; do not bypass the immutable snapshot trigger.
      const legacy = await createCase();
      await pool.query("DELETE FROM payments WHERE id=$1", [legacy.paymentId]);
      await pool.query(
        "INSERT INTO payments(id,booking_id,amount,transfer_code) VALUES($1,$2,50000,$3)",
        [legacy.paymentId, legacy.bookingId, "legacy-" + legacy.paymentId],
      );
      assert.equal((await upload(legacy.bookingId)).status, 409);
      assert.equal((await upload(ids.bookings.cash)).status, 404); // manual guest is not the current Customer
      const cash = await createCase();
      await pool.query("DELETE FROM payments WHERE id=$1", [cash.paymentId]);
      await pool.query(
        "UPDATE bookings SET source='manual',status='completed',expires_at=NULL WHERE id=$1",
        [cash.bookingId],
      );
      await pool.query(
        "INSERT INTO payments(id,booking_id,amount,provider,status,paid_at) VALUES($1,$2,50000,'cash','completed',clock_timestamp())",
        [cash.paymentId, cash.bookingId],
      );
      assert.equal((await upload(cash.bookingId)).status, 400);
      const committed = await createCase();
      storage.failSign = true;
      try {
        assert.equal((await upload(committed.bookingId)).status, 503);
      } finally {
        storage.failSign = false;
      }
      const persisted = (
        await pool.query(
          "SELECT status,proof_object_key FROM payments WHERE id=$1",
          [committed.paymentId],
        )
      ).rows[0];
      assert.equal(persisted.status, "submitted");
      assert.equal(storage.objects.has(persisted.proof_object_key), true);
      assert.equal((await detail(committed.bookingId)).status, 200);
    },
  );
  await t.test(
    "two proof requests on real DB connections serialize without extending deadline",
    async () => {
      const { bookingId, paymentId } = await createCase();
      const responses = await Promise.all([
        upload(bookingId),
        upload(bookingId),
      ]);
      assert.deepEqual(
        responses.map((r) => r.status),
        [200, 200],
      );
      const rows = await Promise.all(
        responses.map(async (r) =>
          paymentViewSchema.parse(((await r.json()) as { data: unknown }).data),
        ),
      );
      assert.equal(rows[0]!.proofUploadedAt, rows[1]!.proofUploadedAt);
      assert.equal(rows[0]!.reviewDeadline, rows[1]!.reviewDeadline);
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int n FROM outbox_deliveries WHERE payload->>'paymentId'=$1 AND channel='email'",
            [paymentId],
          )
        ).rows[0].n,
        1,
      );
    },
  );
  await t.test(
    "expire and account changes between guard and transaction are rechecked",
    async () => {
      const expired = await createCase();
      storage.beforePut = async () => {
        await pool.query(
          "UPDATE bookings SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
          [expired.bookingId],
        );
      };
      assert.equal((await upload(expired.bookingId)).status, 422);
      storage.beforePut = undefined;
      const revoked = await createCase();
      storage.beforePut = async () => {
        await pool.query("UPDATE users SET role='owner' WHERE id=$1", [
          ids.users.customerA,
        ]);
      };
      assert.equal((await upload(revoked.bookingId)).status, 403);
      storage.beforePut = undefined;
      await pool.query("UPDATE users SET role='customer' WHERE id=$1", [
        ids.users.customerA,
      ]);
      assert.equal(
        (
          await pool.query("SELECT status FROM payments WHERE id=$1", [
            revoked.paymentId,
          ])
        ).rows[0].status,
        "pending",
      );
    },
  );
  await t.test(
    "SQL event failure rolls back both tables; failed compensation remains durable and cleanup retries",
    async () => {
      const { bookingId, paymentId } = await createCase();
      await pool.query(
        "CREATE FUNCTION fail_payment_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced event failure'; END $$",
      );
      await pool.query(
        "CREATE TRIGGER force_payment_event BEFORE INSERT ON outbox_deliveries FOR EACH ROW EXECUTE FUNCTION fail_payment_event()",
      );
      storage.failDelete = true;
      const response = await upload(bookingId);
      assert.equal(response.status, 500);
      assert.ok(!JSON.stringify(await response.json()).includes("proofs/"));
      await pool.query("DROP TRIGGER force_payment_event ON outbox_deliveries");
      assert.equal(
        (
          await pool.query("SELECT status FROM payments WHERE id=$1", [
            paymentId,
          ])
        ).rows[0].status,
        "pending",
      );
      assert.equal(
        (
          await pool.query("SELECT status FROM bookings WHERE id=$1", [
            bookingId,
          ])
        ).rows[0].status,
        "held",
      );
      const jobs = (
        await pool.query(
          "SELECT object_key,status FROM storage_cleanup_jobs WHERE object_key LIKE $1",
          [`proofs/${bookingId}/%`],
        )
      ).rows;
      assert.equal(jobs.length, 1);
      assert.equal(jobs[0].status, "pending");
      storage.failDelete = false;
      await app.get(ProofCleanupService).clean(jobs[0].object_key);
      assert.equal(storage.objects.has(jobs[0].object_key), false);
    },
  );
  await t.test(
    "review deadline, legacy submitted timestamp and active-reference cleanup are enforced",
    async () => {
      const item = await createCase();
      assert.equal((await upload(item.bookingId)).status, 200);
      const key = (
        await pool.query("SELECT proof_object_key FROM payments WHERE id=$1", [
          item.paymentId,
        ])
      ).rows[0].proof_object_key;
      await app.get(ProofCleanupService).clean(key);
      assert.equal(storage.objects.has(key), true);
      await pool.query(
        "UPDATE payments SET proof_uploaded_at=clock_timestamp()-interval '2 hours',proof_updated_at=clock_timestamp() WHERE id=$1",
        [item.paymentId],
      );
      const expired = await upload(item.bookingId);
      assert.equal(expired.status, 409);
      assert.equal(
        ((await expired.json()) as { error: { code: string } }).error.code,
        "PAYMENT_REVIEW_EXPIRED",
      );
      await pool.query(
        "UPDATE payments SET proof_uploaded_at=NULL,proof_updated_at=NULL WHERE id=$1",
        [item.paymentId],
      );
      const missing = await upload(item.bookingId);
      assert.equal(missing.status, 409);
      assert.equal(
        ((await missing.json()) as { error: { code: string } }).error.code,
        "PAYMENT_DATA_INCOMPLETE",
      );
    },
  );
  await t.test(
    "real expiry transaction and proof serialize in both commit orders",
    async () => {
      const first = await createCase(),
        expire = await pool.connect();
      try {
        await expire.query("BEGIN");
        await expire.query("SELECT id FROM venues WHERE id=$1 FOR SHARE", [
          ids.venues.a,
        ]);
        await expire.query("SELECT id FROM courts WHERE id=$1 FOR SHARE", [
          first.courtId,
        ]);
        await expire.query("SELECT id FROM bookings WHERE id=$1 FOR UPDATE", [
          first.bookingId,
        ]);
        await expire.query("SELECT id FROM payments WHERE id=$1 FOR UPDATE", [
          first.paymentId,
        ]);
        await expire.query(
          "UPDATE bookings SET status='expired',expires_at=NULL WHERE id=$1",
          [first.bookingId],
        );
        await expire.query("UPDATE payments SET status='expired' WHERE id=$1", [
          first.paymentId,
        ]);
        let signal!: () => void;
        const reached = new Promise<void>((resolve) => {
          signal = resolve;
        });
        storage.beforePut = async () => signal();
        const response = upload(first.bookingId);
        await reached;
        await expire.query("COMMIT");
        assert.equal((await response).status, 422);
      } finally {
        storage.beforePut = undefined;
        await expire.query("ROLLBACK");
        expire.release();
      }
      const second = await createCase(),
        client = await pool.connect(),
        repo = app.get(PaymentsRepository),
        original = repo.now;
      let release!: () => void, signal!: () => void;
      const gate = new Promise<void>((resolve) => {
          release = resolve;
        }),
        reached = new Promise<void>((resolve) => {
          signal = resolve;
        });
      repo.now = async (tx) => {
        const now = await original.call(repo, tx);
        signal();
        await gate;
        return now;
      };
      try {
        const response = upload(second.bookingId);
        await reached;
        await client.query("BEGIN");
        await client.query("SELECT id FROM venues WHERE id=$1 FOR SHARE", [
          ids.venues.a,
        ]);
        await client.query("SELECT id FROM courts WHERE id=$1 FOR SHARE", [
          second.courtId,
        ]);
        const pid = (await client.query("SELECT pg_backend_pid() AS pid"))
          .rows[0].pid;
        const waiting = client.query(
          "SELECT status FROM bookings WHERE id=$1 FOR UPDATE",
          [second.bookingId],
        );
        let blocked = false;
        for (let n = 0; n < 100; n++) {
          blocked =
            (
              await pool.query(
                "SELECT wait_event_type='Lock' AS blocked FROM pg_stat_activity WHERE pid=$1",
                [pid],
              )
            ).rows[0]?.blocked === true;
          if (blocked) break;
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        assert.equal(blocked, true);
        release();
        assert.equal((await response).status, 200);
        const booking = (await waiting).rows[0];
        assert.equal(booking.status, "pending_payment");
        await client.query("SELECT id FROM payments WHERE id=$1 FOR UPDATE", [
          second.paymentId,
        ]);
        // The expiry worker rechecks held under the lock and does not cancel submitted payment.
        assert.equal(
          (
            await client.query("SELECT status FROM payments WHERE id=$1", [
              second.paymentId,
            ])
          ).rows[0].status,
          "submitted",
        );
        await client.query("COMMIT");
      } finally {
        release();
        repo.now = original;
        await client.query("ROLLBACK");
        client.release();
      }
    },
  );
  await t.test(
    "payment account requires origin, validates strict fields and preserves existing snapshots",
    async () => {
      const { bookingId } = await createCase();
      const path = "/owner/venues/" + ids.venues.a + "/payment-account";
      assert.equal(
        (
          await request(path, "ownerA", "PUT", {
            bankBin: "970436",
            accountNo: "9999999999",
            accountName: "OWNER A",
          })
        ).status,
        403,
      );
      const response = await fetch(`${await app.getUrl()}/api/v1${path}`, {
        method: "PUT",
        headers: {
          Cookie: `access_token=${tokens.ownerA}`,
          "X-Request-Origin": "http://localhost:3000",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bankBin: "970436",
          accountNo: "9999999999",
          accountName: "OWNER A",
        }),
      });
      assert.equal(response.status, 200);
      const value = paymentViewSchema.parse(
        ((await (await detail(bookingId)).json()) as { data: unknown }).data,
      );
      assert.equal(value.bankAccount?.accountNo, "1234567890");
      assert.equal(
        (
          await request(
            "/bookings/" + bookingId + "/payment?ownerId=" + ids.users.ownerB,
            "customerA",
          )
        ).status,
        400,
      );
      const concurrent = await createCase(),
        repo = app.get(PaymentsRepository),
        original = repo.now;
      let release!: () => void, signal!: () => void;
      const gate = new Promise<void>((resolve) => {
          release = resolve;
        }),
        reached = new Promise<void>((resolve) => {
          signal = resolve;
        });
      repo.now = async (tx) => {
        const now = await original.call(repo, tx);
        signal();
        await gate;
        return now;
      };
      try {
        const proof = upload(concurrent.bookingId);
        await reached;
        const account = fetch(`${await app.getUrl()}/api/v1${path}`, {
          method: "PUT",
          headers: {
            Cookie: `access_token=${tokens.ownerA}`,
            "X-Request-Origin": "http://localhost:3000",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            bankBin: "970436",
            accountNo: "8888888888",
            accountName: "OWNER A",
          }),
        });
        let blocked = false;
        for (let n = 0; n < 100; n++) {
          blocked = (
            await pool.query(
              "SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query ILIKE '%users%') AS blocked",
            )
          ).rows[0].blocked;
          if (blocked) break;
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        assert.equal(blocked, true);
        release();
        assert.equal((await proof).status, 200);
        assert.equal((await account).status, 200);
        assert.equal(
          (
            await pool.query(
              "SELECT bank_account_snapshot FROM payments WHERE id=$1",
              [concurrent.paymentId],
            )
          ).rows[0].bank_account_snapshot.accountNo,
          "1234567890",
        );
      } finally {
        release();
        repo.now = original;
      }
    },
  );
  await t.test(
    "Swagger payment response and multipart endpoint match design",
    async () => {
      const document = SwaggerModule.createDocument(
        app,
        new DocumentBuilder().build(),
      );
      const specUrl = new URL(
        "../../../../docs/openapi/phase-04.openapi.json",
        import.meta.url,
      );
      if (existsSync(specUrl)) {
        const spec = JSON.parse(await readFile(specUrl, "utf8"));
        const schema = spec.components.schemas.PaymentView;
        schema.properties.bankAccount.oneOf[0] =
          spec.components.schemas.BankAccount;
        const response = document.paths["/api/v1/bookings/{id}/payment"]!.get!
          .responses["200"] as unknown as {
          content: Record<
            string,
            { schema: { properties: { data: unknown } } }
          >;
        };
        assert.deepEqual(
          response.content["application/json"]!.schema.properties.data,
          schema,
        );
      }
      assert.ok(
        document.paths["/api/v1/bookings/{id}/payment/proof"]!.post!
          .requestBody,
      );
    },
  );
}
