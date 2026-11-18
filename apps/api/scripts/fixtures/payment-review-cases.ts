import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import type { INestApplication } from "@nestjs/common";
import type { Pool } from "pg";
import sharp from "sharp";
import { phase4FixtureIds as ids } from "./phase4.fixture.js";
import type { MemoryProofStorage } from "./payment-cases.js";
import { PaymentsRepository } from "../../src/modules/payments/payments.repository.js";
import { PaymentReviewService } from "../../src/modules/payments/payment-review.service.js";
import { PaymentsService } from "../../src/modules/payments/payments.service.js";
import {
  ownerPaymentItemSchema,
  paymentViewSchema,
  phase4ListEnvelope,
} from "../../../../packages/shared/src/phase4-responses.js";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AuthJwtService } from "../../src/modules/auth/auth-jwt.service.js";
type Request = (
  path: string,
  who?: string,
  method?: string,
  body?: unknown,
) => Promise<Response>;

export async function runPaymentReviewCases(
  t: TestContext,
  app: INestApplication,
  pool: Pool,
  request: Request,
  storage: MemoryProofStorage,
) {
  const repo = app.get(PaymentsRepository),
    service = app.get(PaymentReviewService);
  const booking = ids.bookings.submitted,
    payment = ids.payments.submitted;
  const path = (action: string, id = payment) =>
    `/owner/payments/${id}/${action}`;
  const reset = async (expired = false) => {
    await pool.query("DELETE FROM audit_logs WHERE entity_id=$1", [payment]);
    await pool.query("DELETE FROM notifications WHERE event_key LIKE $1", [
      `payment:${payment}:%`,
    ]);
    await pool.query("DELETE FROM outbox_deliveries WHERE event_key LIKE $1", [
      `payment:${payment}:%`,
    ]);
    await pool.query(
      "UPDATE bookings SET status='pending_payment',cancelled_by=NULL,cancelled_at=NULL,cancel_reason=NULL,expires_at=NULL WHERE id=$1",
      [booking],
    );
    await pool.query(
      "UPDATE payments SET status='submitted',proof_object_key=NULL,proof_uploaded_at=clock_timestamp()-($2::int * interval '1 minute'),proof_updated_at=clock_timestamp(),reviewed_by=NULL,reviewed_at=NULL,reject_reason=NULL,paid_at=NULL WHERE id=$1",
      [payment, expired ? 121 : 1],
    );
  };
  const state = async () =>
    (
      await pool.query(
        "SELECT b.status AS booking_status,p.* FROM payments p JOIN bookings b ON b.id=p.booking_id WHERE p.id=$1",
        [payment],
      )
    ).rows[0];
  const eventCounts = async () =>
    (
      await pool.query(
        "SELECT (SELECT count(*)::int FROM audit_logs WHERE entity_id=$1) AS audit,(SELECT count(*)::int FROM notifications WHERE event_key LIKE $2) AS notification,(SELECT count(*)::int FROM outbox_deliveries WHERE event_key LIKE $2) AS outbox",
        [payment, `payment:${payment}:%`],
      )
    ).rows[0];
  await t.test(
    "owner scope, pagination, role, strict inputs, origin and Swagger",
    async () => {
      await reset();
      assert.equal((await request("/owner/payments")).status, 401);
      for (const who of ["customerA", "adminA"])
        assert.equal((await request("/owner/payments", who)).status, 403);
      assert.equal(
        (
          await request(path("approve"), "ownerB", "PATCH", {
            ownerId: ids.users.ownerB,
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await request(path("approve"), "ownerA", "PATCH", {
            status: "completed",
          })
        ).status,
        400,
      );
      assert.equal(
        (await request(path("reject"), "ownerA", "PATCH", { reason: "   " }))
          .status,
        400,
      );
      for (const query of [
        "ownerId=" + ids.users.ownerB,
        "limit=101",
        "page=0",
        "status=submitted&status=completed",
      ])
        assert.equal(
          (await request("/owner/payments?" + query, "ownerA")).status,
          400,
        );
      const list = phase4ListEnvelope(ownerPaymentItemSchema).parse(
        await (
          await request("/owner/payments?status=submitted&limit=1", "ownerA")
        ).json(),
      );
      assert.equal(list.meta.total, 1);
      assert.equal(list.data.length, 1);
      ownerPaymentItemSchema.parse(list.data[0]);
      const allList = phase4ListEnvelope(ownerPaymentItemSchema).parse(
        await (
          await request("/owner/payments?status=all&limit=20", "ownerA")
        ).json(),
      );
      assert.ok(allList.meta.total >= 2);
      assert.ok(allList.data.some((row: { id: string }) => row.id === ids.payments.submitted));
      assert.ok(allList.data.some((row: { id: string }) => row.id === ids.payments.cash));
      const other = phase4ListEnvelope(ownerPaymentItemSchema).parse(
        await (
          await request(`/owner/payments?venueId=${ids.venues.a}`, "ownerB")
        ).json(),
      );
      assert.equal(other.meta.total, 0);
      assert.equal(other.meta.totalPages, 0);
      const huge = phase4ListEnvelope(ownerPaymentItemSchema).parse(
        await (
          await request(
            "/owner/payments?page=9007199254740991&limit=100",
            "ownerA",
          )
        ).json(),
      );
      assert.deepEqual(huge.data, []);
      const token = await app
        .get(AuthJwtService)
        .sign(ids.users.ownerA, "access", false);
      const noOrigin = await fetch(
        `${await app.getUrl()}/api/v1${path("approve")}`,
        { method: "PATCH", headers: { Cookie: `access_token=${token}` } },
      );
      assert.equal(noOrigin.status, 403);
      const doc = SwaggerModule.createDocument(
        app,
        new DocumentBuilder().build(),
      );
      assert.ok(doc.paths["/api/v1/owner/payments"]?.get);
      assert.ok(doc.paths["/api/v1/owner/payments/{id}/approve"]?.patch);
    },
  );
  await t.test(
    "approve commits pair, immutable snapshot and one audit/event set; retry past deadline is no-op even cancelled booking",
    async () => {
      await reset();
      const before = await state();
      const response = await request(path("approve"), "ownerA", "PATCH");
      assert.equal(response.status, 200);
      const view = paymentViewSchema.parse(
        ((await response.json()) as { data: unknown }).data,
      );
      assert.equal(view.status, "completed");
      assert.equal(view.bookingStatus, "confirmed");
      assert.equal(view.reviewedAt, view.paidAt);
      assert.equal(view.reviewedBy, ids.users.ownerA);
      assert.equal(view.amount, before.amount);
      assert.deepEqual(view.bankAccount, before.bank_account_snapshot);
      const persisted = await state();
      const counts = await eventCounts();
      assert.deepEqual(counts, { audit: 1, notification: 1, outbox: 3 });
      await pool.query(
        "UPDATE payments SET proof_uploaded_at=clock_timestamp()-interval '3 hours' WHERE id=$1",
        [payment],
      );
      await pool.query("UPDATE bookings SET status='cancelled' WHERE id=$1", [
        booking,
      ]);
      assert.equal(
        (await request(path("approve"), "ownerA", "PATCH", {})).status,
        200,
      );
      assert.equal((await state()).booking_status, "cancelled");
      assert.equal(
        (await state()).updated_at.getTime(),
        persisted.updated_at.getTime(),
      );
      assert.deepEqual(await eventCounts(), counts);
    },
  );
  await t.test(
    "reject reason synchronized, trimmed retry no-op, different reason forbidden",
    async () => {
      await reset();
      assert.equal(
        (
          await request(path("reject"), "ownerA", "PATCH", {
            reason: "  Invalid proof  ",
          })
        ).status,
        200,
      );
      const row = await state();
      assert.equal(row.status, "rejected");
      assert.equal(row.booking_status, "cancelled");
      assert.equal(row.reject_reason, "Invalid proof");
      const b = (
        await pool.query("SELECT * FROM bookings WHERE id=$1", [booking])
      ).rows[0];
      assert.equal(b.cancel_reason, row.reject_reason);
      assert.equal(b.cancelled_by, row.reviewed_by);
      assert.equal(b.cancelled_at.getTime(), row.reviewed_at.getTime());
      await pool.query(
        "UPDATE payments SET proof_uploaded_at=clock_timestamp()-interval '3 hours' WHERE id=$1",
        [payment],
      );
      assert.equal(
        (
          await request(path("reject"), "ownerA", "PATCH", {
            reason: "Invalid proof",
          })
        ).status,
        200,
      );
      assert.equal(
        (await request(path("reject"), "ownerA", "PATCH", { reason: "Other" }))
          .status,
        400,
      );
      assert.equal(
        (await request(path("approve"), "ownerA", "PATCH")).status,
        400,
      );
      assert.deepEqual(await eventCounts(), {
        audit: 1,
        notification: 1,
        outbox: 3,
      });
    },
  );
  await t.test(
    "deadline and legacy missing timestamp; two cron workers cancel once without refund",
    async () => {
      await reset(true);
      assert.equal(
        (await request(path("approve"), "ownerA", "PATCH")).status,
        409,
      );
      const results = await Promise.all([
        service.expireBatch(),
        service.expireBatch(),
      ]);
      assert.equal(
        results.reduce((n, r) => n + r.cancelled, 0),
        1,
      );
      const row = await state();
      assert.equal(row.status, "cancelled");
      assert.equal(row.booking_status, "cancelled");
      assert.equal(row.refunded_at, null);
      assert.equal(row.reviewed_at, null);
      const b = (
        await pool.query(
          "SELECT cancelled_by,cancel_reason FROM bookings WHERE id=$1",
          [booking],
        )
      ).rows[0];
      assert.equal(b.cancelled_by, null);
      assert.equal(b.cancel_reason, "OWNER_REVIEW_TIMEOUT");
      assert.deepEqual(await eventCounts(), {
        audit: 1,
        notification: 1,
        outbox: 3,
      });
      await reset();
      await pool.query(
        "UPDATE payments SET proof_uploaded_at=NULL,proof_updated_at=NULL WHERE id=$1",
        [payment],
      );
      assert.equal(
        (await request(path("approve"), "ownerA", "PATCH")).status,
        409,
      );
      assert.ok((await service.expireBatch()).errors >= 1);
      assert.equal((await state()).status, "submitted");
    },
  );
  // Gate is after real PostgreSQL locks. The competitor uses a separate pool connection.
  async function race(
    first: () => Promise<unknown>,
    second: () => Promise<unknown>,
    releaseAt?: Date,
  ) {
    const original = repo.now.bind(repo);
    let release!: () => void, entered!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const ready = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let calls = 0;
    repo.now = async (tx) => {
      const now = await original(tx);
      if (++calls === 1) {
        entered();
        await gate;
        return now;
      }
      return now;
    };
    const a = first();
    try {
      await Promise.race([
        ready,
        new Promise((_, reject) =>
          setTimeout(() => reject(Error("gate timeout")), 5000),
        ),
      ]);
      const b = second();
      let blocked = false;
      for (let i = 0; i < 100; i++) {
        const result = await pool.query(
          "SELECT count(*)::int AS n FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND wait_event_type='Lock' AND query LIKE '%users%'",
        );
        if (result.rows[0].n > 0) {
          blocked = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assert.ok(blocked, "competitor must wait on a real PostgreSQL lock");
      if (releaseAt)
        await new Promise((resolve) =>
          setTimeout(resolve, Math.max(0, releaseAt.getTime() - Date.now())),
        );
      release();
      return await Promise.all([a, b]);
    } finally {
      release();
      repo.now = original;
    }
  }
  await t.test(
    "approve/approve and approve/reject serialize; loser never duplicates effects",
    async () => {
      await reset();
      let result = await race(
        () => request(path("approve"), "ownerA", "PATCH"),
        () => request(path("approve"), "ownerA", "PATCH"),
      );
      assert.deepEqual(
        result.map((r) => (r as Response).status),
        [200, 200],
      );
      assert.deepEqual(await eventCounts(), {
        audit: 1,
        notification: 1,
        outbox: 3,
      });
      await reset();
      result = await race(
        () => request(path("approve"), "ownerA", "PATCH"),
        () => request(path("reject"), "ownerA", "PATCH", { reason: "No" }),
      );
      assert.deepEqual(
        result.map((r) => (r as Response).status),
        [200, 400],
      );
      assert.equal((await state()).status, "completed");
    },
  );
  await t.test(
    "approve/cron in both lock orders obey deadline and only winner emits",
    async () => {
      await reset();
      await pool.query(
        "UPDATE payments SET proof_uploaded_at=clock_timestamp()-interval '2 hours'+interval '3 seconds',proof_updated_at=clock_timestamp() WHERE id=$1",
        [payment],
      );
      const stamp = (await state()).proof_uploaded_at as Date;
      let result = await race(
        () => request(path("approve"), "ownerA", "PATCH"),
        () => service.expireBatch(),
        new Date(stamp.getTime() + 7200000 + 50),
      );
      assert.equal((result[0] as Response).status, 200);
      assert.equal((await state()).status, "completed");
      assert.equal((await eventCounts()).audit, 1);
      await reset(true);
      result = await race(
        () => service.expireBatch(),
        () => request(path("approve"), "ownerA", "PATCH"),
      );
      assert.equal((result[1] as Response).status, 400);
      assert.equal((await state()).status, "cancelled");
      assert.equal((await eventCounts()).audit, 1);
    },
  );
  await t.test(
    "proof/cron race cannot attach a file after expiry commits",
    async () => {
      await reset(true);
      let enter!: () => void, release!: () => void;
      const ready = new Promise<void>((r) => {
          enter = r;
        }),
        gate = new Promise<void>((r) => {
          release = r;
        });
      storage.beforePut = async () => {
        enter();
        await gate;
      };
      const buffer = await sharp({
        create: { width: 2, height: 2, channels: 3, background: "white" },
      })
        .png()
        .toBuffer();
      const proof = app
        .get(PaymentsService)
        .proof(ids.users.customerA, booking, {
          buffer,
          size: buffer.length,
          mimetype: "image/png",
        });
      const failure = assert.rejects(
        proof,
        (error) =>
          typeof error === "object" &&
          error !== null &&
          "getStatus" in error &&
          (error.getStatus as () => number)() === 400,
      );
      try {
        await ready;
        await service.expireBatch();
      } finally {
        release();
        storage.beforePut = undefined;
      }
      await failure;
      assert.equal((await state()).status, "cancelled");
      assert.equal((await state()).proof_object_key, null);
    },
  );
  await t.test(
    "failure between booking/payment writes rolls back pair, audit and events",
    async () => {
      await reset();
      await pool.query(
        "CREATE FUNCTION fail_review_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id='" +
          payment +
          "' AND NEW.status='completed' THEN RAISE EXCEPTION 'private injected failure'; END IF; RETURN NEW; END $$",
      );
      await pool.query(
        "CREATE TRIGGER fail_review_test BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION fail_review_test()",
      );
      try {
        assert.equal(
          (await request(path("approve"), "ownerA", "PATCH")).status,
          500,
        );
      } finally {
        await pool.query(
          "DROP TRIGGER fail_review_test ON payments; DROP FUNCTION fail_review_test()",
        );
      }
      assert.equal((await state()).booking_status, "pending_payment");
      assert.equal((await state()).status, "submitted");
      assert.deepEqual(await eventCounts(), {
        audit: 0,
        notification: 0,
        outbox: 0,
      });
    },
  );
  await t.test(
    "outbox failure also rolls back booking, payment, audit and notification",
    async () => {
      await reset();
      await pool.query(
        "CREATE FUNCTION fail_outbox_review_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_key='payment:" +
          payment +
          ":approve' THEN RAISE EXCEPTION 'injected outbox failure'; END IF; RETURN NEW; END $$",
      );
      await pool.query(
        "CREATE TRIGGER fail_outbox_review_test BEFORE INSERT ON outbox_deliveries FOR EACH ROW EXECUTE FUNCTION fail_outbox_review_test()",
      );
      try {
        const response = await request(path("approve"), "ownerA", "PATCH");
        assert.equal(response.status, 500);
        assert.ok(!JSON.stringify(await response.json()).includes("injected"));
      } finally {
        await pool.query(
          "DROP TRIGGER fail_outbox_review_test ON outbox_deliveries; DROP FUNCTION fail_outbox_review_test()",
        );
      }
      assert.equal((await state()).booking_status, "pending_payment");
      assert.equal((await state()).status, "submitted");
      assert.deepEqual(await eventCounts(), {
        audit: 0,
        notification: 0,
        outbox: 0,
      });
    },
  );
  await t.test(
    "live role/suspension rechecked between guard and transaction",
    async () => {
      for (const field of ["role", "status"]) {
        await reset();
        const original = repo.lockUsers.bind(repo);
        let changed = false;
        repo.lockUsers = async (tx, users) => {
          if (!changed) {
            changed = true;
            await pool.query(
              field === "role"
                ? "UPDATE users SET role='customer' WHERE id=$1"
                : "UPDATE users SET status='suspended' WHERE id=$1",
              [ids.users.ownerA],
            );
          }
          await original(tx, users);
        };
        try {
          assert.equal(
            (await request(path("approve"), "ownerA", "PATCH")).status,
            403,
          );
          assert.equal((await state()).status, "submitted");
        } finally {
          repo.lockUsers = original;
          await pool.query(
            "UPDATE users SET role='owner',status='active' WHERE id=$1",
            [ids.users.ownerA],
          );
        }
      }
    },
  );
  await t.test(
    "deleted or suspended Venue history stays accessible and reviewable; cash cannot be bank-approved",
    async () => {
      await reset();
      await pool.query(
        "UPDATE venues SET status='suspended',deleted_at=clock_timestamp() WHERE id=$1",
        [ids.venues.a],
      );
      try {
        const list = phase4ListEnvelope(ownerPaymentItemSchema).parse(
          await (await request("/owner/payments", "ownerA")).json(),
        );
        assert.ok(list.data.some((r: { id: string }) => r.id === payment));
        assert.equal(
          (await request(path("approve"), "ownerA", "PATCH")).status,
          200,
        );
        assert.equal(
          (await request(`/bookings/${booking}/payment`, "customerA")).status,
          200,
        );
        assert.equal(
          (await request(path("approve", ids.payments.cash), "ownerA", "PATCH"))
            .status,
          400,
        );
      } finally {
        await pool.query(
          "UPDATE venues SET status='approved',deleted_at=NULL WHERE id=$1",
          [ids.venues.a],
        );
      }
    },
  );
}
