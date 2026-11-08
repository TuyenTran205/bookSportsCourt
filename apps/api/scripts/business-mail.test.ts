import "reflect-metadata";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readdir } from "node:fs/promises";
import { test } from "node:test";
import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { DATABASE } from "../src/database/database.module.js";
import * as schema from "../src/database/schema/index.js";
import { EmailOutboxRepository } from "../src/modules/mail/email-outbox.repository.js";
import { BookingRemindersRepository } from "../src/modules/mail/booking-reminders.repository.js";
import { BusinessMailService } from "../src/modules/mail/business-mail.service.js";
import {
  MailDeliveryError,
  MailTransport,
  type MailRequest,
} from "../src/modules/mail/mail.transport.js";
import { renderBookingMail } from "../src/modules/mail/business-mail.templates.js";
import { AuthMailService } from "../src/modules/auth/auth-mail.service.js";
import {
  readVenueTestMigration,
  withVenueTestSchema,
} from "./fixtures/venue-test-db.js";
import {
  seedPhase4Fixtures,
  phase4FixtureIds as ids,
} from "./fixtures/phase4.fixture.js";

test("0010 upgrades populated 0009 without losing legacy events", async () => {
  const connection = process.env.VENUE_TEST_DATABASE_URL;
  assert.ok(connection);
  await withVenueTestSchema(
    connection,
    async (client) => {
      await seedPhase4Fixtures(client, "$argon2id$test-fixture-not-for-login");
      const id = crypto.randomUUID();
      await client.query(
        `INSERT INTO outbox_deliveries(id,event_key,event_type,channel,recipient_id,payload)
      VALUES($1,'legacy','booking_confirmed','email',$2,'{}')`,
        [id, ids.users.customer],
      );
      await client.query(
        await readVenueTestMigration("0010_email-delivery.sql"),
      );
      const row = (
        await client.query("SELECT * FROM outbox_deliveries WHERE id=$1", [id])
      ).rows[0];
      assert.equal(row.status, "pending");
      assert.equal(row.email_request, null);
      assert.equal(row.first_attempt_at, null);
      assert.equal(
        (
          await client.query(
            "SELECT count(*)::int AS n FROM pg_indexes WHERE schemaname=current_schema() AND indexname='idx_outbox_email_lease'",
          )
        ).rows[0].n,
        1,
      );
    },
    "0009",
  );
});

test("Vietnamese templates escape HTML and contain no proof, bank or other customer data", () => {
  for (const event of [
    "booking_confirmed",
    "booking_cancelled",
    "payment_rejected",
    "payment_submitted",
    "booking_reminder",
  ]) {
    const rendered = renderBookingMail(event, ids.bookings.submitted, {
      venueName: "<script>&\"'",
      courtName: "Sân A",
      start: new Date("2035-01-01T00:00:00Z"),
      end: new Date("2035-01-01T01:00:00Z"),
      totalPrice: 200000,
      depositAmount: 100000,
    });
    assert.ok(rendered.text.includes("07:00"));
    assert.ok(rendered.text.includes("200.000"));
    assert.ok(rendered.html.includes("&lt;script&gt;&amp;&quot;&#39;"));
    assert.ok(!rendered.html.includes("<script>"));
    assert.ok(!/proof|bank|token|https?:/i.test(rendered.text));
  }
});

test("Shared Resend transport sends stable key, sanitizes failures and serves Auth", async () => {
  const config = new ConfigService({
    RESEND_API_KEY: "test-not-real",
    MAIL_FROM: "noreply@example.test",
    AUTH_FRONTEND_URL: "https://example.test",
    ALLOWED_ORIGINS: "https://example.test",
  });
  const transport = new MailTransport(config);
  const previous = globalThis.fetch;
  const sent: { headers: Headers; body: MailRequest }[] = [];
  try {
    globalThis.fetch = async (_input, init) => {
      sent.push({
        headers: new Headers(init?.headers),
        body: JSON.parse(String(init?.body)) as MailRequest,
      });
      return new Response('{"id":"test-provider-receipt"}', { status: 200 });
    };
    await transport.send(
      {
        from: "noreply@example.test",
        to: ["test@example.test"],
        subject: "test",
        text: "test",
      },
      "bsc/stable",
    );
    assert.equal(sent[0]!.headers.get("Idempotency-Key"), "bsc/stable");
    await new AuthMailService(config, transport).send(
      "test@example.test",
      "private-token",
      "password_reset",
    );
    assert.ok(
      sent[1]!.body.text.includes("/reset-password?token=private-token"),
    );
    globalThis.fetch = async () =>
      new Response("provider-secret", { status: 429 });
    await assert.rejects(
      () => transport.send(sent[0]!.body),
      (e: unknown) =>
        e instanceof MailDeliveryError &&
        e.code === "MAIL_RATE_LIMITED" &&
        e.retryable,
    );
    globalThis.fetch = async () => {
      throw new Error("secret-address");
    };
    await assert.rejects(
      () => transport.send(sent[0]!.body),
      (e: unknown) =>
        e instanceof MailDeliveryError && e.message === "DELIVERY_AMBIGUOUS",
    );
  } finally {
    globalThis.fetch = previous;
  }
});

test("Email worker and reminder producer against isolated PostgreSQL", async (t) => {
  const connectionString = process.env.VENUE_TEST_DATABASE_URL;
  assert.ok(connectionString, "Set explicit local test PostgreSQL URL");
  assert.ok(
    ["localhost", "127.0.0.1", "[::1]"].includes(
      new URL(connectionString).hostname,
    ),
  );
  const name = `bsc014_test_${randomBytes(6).toString("hex")}`;
  const admin = new Pool({ connectionString });
  const pool = new Pool({
    connectionString,
    options: `-c search_path=${name},public -c statement_timeout=15000`,
  });
  const deliveries: { request: MailRequest; key?: string }[] = [];
  let send: (
    request: MailRequest,
    key?: string,
  ) => Promise<void> = async () => {};
  const config = new ConfigService({
    MAIL_FROM: "noreply@example.test",
    BUSINESS_MAIL_ENABLED: false,
  });
  await admin.query(`CREATE SCHEMA "${name}"`);
  try {
    for (const file of (
      await readdir(new URL("../src/database/migrations/", import.meta.url))
    )
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      await pool.query(await readVenueTestMigration(file));
    }
    const client = await pool.connect();
    try {
      await seedPhase4Fixtures(client, "$argon2id$test-fixture-not-for-login");
    } finally {
      client.release();
    }
    const module = await Test.createTestingModule({
      providers: [
        EmailOutboxRepository,
        BookingRemindersRepository,
        BusinessMailService,
        { provide: DATABASE, useValue: drizzle(pool, { schema }) },
        { provide: ConfigService, useValue: config },
        {
          provide: MailTransport,
          useValue: {
            assertConfigured() {},
            async send(request: MailRequest, key?: string) {
              deliveries.push({ request, key });
              await send(request, key);
            },
          },
        },
      ],
    }).compile();
    const worker = module.get(BusinessMailService);
    const repo = module.get(EmailOutboxRepository);
    const reminders = module.get(BookingRemindersRepository);
    const enqueue = async (
      event = "booking_confirmed",
      who = ids.users.customer,
      channel = "email",
      payload: unknown = {
        bookingId: ids.bookings.submitted,
        paymentId: ids.payments.submitted,
        venueId: ids.venues.a,
      },
    ) =>
      (
        await pool.query(
          `INSERT INTO outbox_deliveries(id,event_key,event_type,channel,recipient_id,payload)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [
            crypto.randomUUID(),
            `test:${crypto.randomUUID()}`,
            event,
            channel,
            who,
            JSON.stringify(payload),
          ],
        )
      ).rows[0].id as string;
    const get = async (id: string) =>
      (await pool.query("SELECT * FROM outbox_deliveries WHERE id=$1", [id]))
        .rows[0];
    const reset = async () => {
      await pool.query(
        "DELETE FROM outbox_deliveries; DELETE FROM notifications",
      );
      deliveries.length = 0;
      send = async () => {};
    };
    try {
      await t.test(
        "two workers claim once; network runs without a DB transaction; realtime remains pending",
        async () => {
          const id = await enqueue();
          const realtime = await enqueue(
            "booking_confirmed",
            ids.users.customer,
            "realtime",
          );
          send = async () => {
            const independent = await pool.connect();
            try {
              await independent.query("BEGIN");
              await independent.query(
                "SELECT id FROM outbox_deliveries WHERE id=$1 FOR UPDATE NOWAIT",
                [id],
              );
              await independent.query("COMMIT");
            } finally {
              await independent.query("ROLLBACK");
              independent.release();
            }
            await pool.query(
              "UPDATE bookings SET note='committed while sending' WHERE id=$1",
              [ids.bookings.submitted],
            );
          };
          await Promise.all([worker.deliverOne(), worker.deliverOne()]);
          assert.equal(deliveries.length, 1);
          assert.equal((await get(id)).status, "delivered");
          assert.equal((await get(realtime)).status, "pending");
          assert.match(deliveries[0]!.key!, /^bsc\/[a-f0-9]{64}$/);
          await reset();
        },
      );
      await t.test(
        "retry persists exact request/key despite changed venue name; backoff and five-attempt bound",
        async () => {
          const id = await enqueue();
          send = async () => {
            throw new MailDeliveryError("MAIL_RATE_LIMITED", true);
          };
          for (let attempt = 1; attempt <= 5; attempt++) {
            await worker.deliverOne();
            const row = await get(id);
            assert.equal(row.attempts, attempt);
            assert.equal(row.status, attempt === 5 ? "failed" : "pending");
            assert.ok(
              new Date(row.next_attempt_at).getTime() > Date.now() + 50000,
            );
            await pool.query(
              "UPDATE venues SET name='Changed venue' WHERE id=$1",
              [ids.venues.a],
            );
            await pool.query(
              "UPDATE outbox_deliveries SET next_attempt_at=now()-interval '1 second' WHERE id=$1",
              [id],
            );
          }
          assert.equal(deliveries.length, 5);
          for (const delivery of deliveries)
            assert.deepEqual(delivery, deliveries[0]);
          assert.equal(await worker.deliverOne(), false);
          await reset();
        },
      );
      await t.test(
        "payment projection uses the exact event payment even with multiple terminal histories",
        async () => {
          const paymentId = crypto.randomUUID();
          await pool.query(
            `INSERT INTO payments(id,booking_id,amount,provider,status,transfer_code) VALUES($1,$2,100000,'bank_transfer','rejected',$3)`,
            [paymentId, ids.bookings.submitted, `history-${paymentId}`],
          );
          assert.equal(
            (await repo.view(ids.bookings.submitted, paymentId))!.payment_id,
            paymentId,
          );
          const id = await enqueue(
            "payment_rejected",
            ids.users.customer,
            "email",
            {
              bookingId: ids.bookings.submitted,
              paymentId,
              venueId: ids.venues.a,
            },
          );
          await worker.deliverOne();
          assert.equal((await get(id)).status, "delivered");
          await pool.query("DELETE FROM payments WHERE id=$1", [paymentId]);
          await reset();
        },
      );
      await t.test(
        "operator retry preserves key and request, rejects delivered/old/unknown rows",
        async () => {
          const id = await enqueue();
          send = async () => {
            throw new MailDeliveryError("MAIL_PROVIDER_ERROR", false);
          };
          await worker.deliverOne();
          assert.equal((await get(id)).status, "failed");
          assert.equal(await repo.retryFailed(id), true);
          send = async () => {};
          await worker.deliverOne();
          assert.deepEqual(deliveries[0], deliveries[1]);
          assert.equal(await repo.retryFailed(id), false);
          const old = await enqueue();
          await pool.query(
            "UPDATE outbox_deliveries SET status='failed',first_attempt_at=now()-interval '25 hours' WHERE id=$1",
            [old],
          );
          assert.equal(await repo.retryFailed(old), false);
          await reset();
        },
      );
      await t.test(
        "expired lease recovers; stale acknowledgement cannot overwrite winner; old provider window parks unknown",
        async () => {
          const id = await enqueue();
          const first = await repo.claim();
          assert.ok(first && !first.parked);
          await pool.query(
            "UPDATE outbox_deliveries SET lease_expires_at=now()-interval '1 second' WHERE id=$1",
            [id],
          );
          await worker.deliverOne();
          assert.equal((await get(id)).status, "delivered");
          assert.equal(await repo.finish(first.job, "failed", "STALE"), false);
          const old = await enqueue();
          await pool.query(
            "UPDATE outbox_deliveries SET first_attempt_at=now()-interval '25 hours', attempts=1 WHERE id=$1",
            [old],
          );
          await worker.deliverOne();
          assert.equal((await get(old)).status, "delivery_unknown");
          assert.equal(deliveries.length, 1);
          await reset();
        },
      );
      await t.test(
        "provider accepted then DB acknowledgement fails: recovery reuses exact request/key",
        async () => {
          const id = await enqueue();
          await pool.query(`CREATE FUNCTION reject_mail_ack() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
          IF NEW.status='delivered' THEN RAISE EXCEPTION 'test ack failure'; END IF; RETURN NEW; END $$;
          CREATE TRIGGER reject_mail_ack BEFORE UPDATE ON outbox_deliveries FOR EACH ROW EXECUTE FUNCTION reject_mail_ack()`);
          await assert.rejects(() => worker.deliverOne());
          assert.equal((await get(id)).status, "processing");
          await pool.query(
            "DROP TRIGGER reject_mail_ack ON outbox_deliveries; DROP FUNCTION reject_mail_ack()",
          );
          await pool.query(
            "UPDATE outbox_deliveries SET lease_expires_at=now()-interval '1 second' WHERE id=$1",
            [id],
          );
          await worker.deliverOne();
          assert.equal((await get(id)).status, "delivered");
          assert.deepEqual(deliveries[0], deliveries[1]);
          await reset();
        },
      );
      await t.test(
        "recipient email changes between attempts: frozen message is parked for reconciliation",
        async () => {
          const id = await enqueue();
          send = async () => {
            throw new MailDeliveryError("DELIVERY_AMBIGUOUS", true);
          };
          await worker.deliverOne();
          const email = (
            await pool.query("SELECT email FROM users WHERE id=$1", [
              ids.users.customer,
            ])
          ).rows[0].email;
          await pool.query(
            "UPDATE users SET email='changed@example.test' WHERE id=$1",
            [ids.users.customer],
          );
          await pool.query(
            "UPDATE outbox_deliveries SET next_attempt_at=now()-interval '1 second' WHERE id=$1",
            [id],
          );
          await worker.deliverOne();
          assert.equal((await get(id)).status, "delivery_unknown");
          assert.equal(deliveries.length, 1);
          await pool.query("UPDATE users SET email=$2 WHERE id=$1", [
            ids.users.customer,
            email,
          ]);
          await reset();
        },
      );
      await t.test(
        "timeout exhaustion is unknown; invalid recipient/payload never reaches transport",
        async () => {
          const id = await enqueue();
          await pool.query(
            "UPDATE outbox_deliveries SET attempts=4 WHERE id=$1",
            [id],
          );
          send = async () => {
            throw new MailDeliveryError("DELIVERY_AMBIGUOUS", true);
          };
          await worker.deliverOne();
          assert.equal((await get(id)).status, "delivery_unknown");
          assert.equal(await repo.retryFailed(id), false);
          await reset();
          for (const bad of [
            await enqueue("booking_confirmed", ids.users.ownerB),
            await enqueue("booking_confirmed", ids.users.customer, "email", {
              bookingId: ids.bookings.submitted,
              venueId: ids.venues.a,
              proofUrl: "private-secret",
            }),
          ]) {
            await worker.deliverOne();
            assert.equal((await get(bad)).status, "failed");
          }
          assert.equal(deliveries.length, 0);
          await reset();
        },
      );
      await t.test(
        "customer and Owner events choose actual recipient; deleted/suspended Venue does not hide history",
        async () => {
          await pool.query(
            "UPDATE venues SET deleted_at=now(), status='suspended' WHERE id=$1",
            [ids.venues.a],
          );
          for (const event of [
            "booking_confirmed",
            "booking_cancelled",
            "payment_rejected",
            "payment_submitted",
          ]) {
            const owner = event === "payment_submitted";
            const id = await enqueue(
              event,
              owner ? ids.users.ownerA : ids.users.customer,
            );
            await worker.deliverOne();
            assert.equal((await get(id)).status, "delivered");
            const actual = (
              await pool.query("SELECT email FROM users WHERE id=$1", [
                owner ? ids.users.ownerA : ids.users.customer,
              ])
            ).rows[0].email;
            assert.deepEqual(deliveries.at(-1)!.request.to, [actual]);
          }
          await pool.query(
            "UPDATE venues SET deleted_at=NULL,status='approved' WHERE id=$1",
            [ids.venues.a],
          );
          await reset();
        },
      );
      await t.test(
        "late reminder scan catches up, concurrent producers dedupe, marker waits for provider acknowledgement",
        async () => {
          await pool.query(
            `UPDATE bookings SET status='confirmed',during=tstzrange(
          date_trunc('hour',now())+interval '3 hours',date_trunc('hour',now())+interval '4 hours','[)'),reminders_sent_at=NULL WHERE id=$1`,
            [ids.bookings.submitted],
          );
          await Promise.all([
            reminders.enqueueBatch(),
            reminders.enqueueBatch(),
          ]);
          assert.equal(
            (
              await pool.query(
                "SELECT count(*)::int AS n FROM outbox_deliveries WHERE event_type='booking_reminder'",
              )
            ).rows[0].n,
            1,
          );
          assert.equal(
            (
              await pool.query(
                "SELECT count(*)::int AS n FROM notifications WHERE type='booking_reminder'",
              )
            ).rows[0].n,
            1,
          );
          assert.equal(
            (
              await pool.query(
                "SELECT reminders_sent_at FROM bookings WHERE id=$1",
                [ids.bookings.submitted],
              )
            ).rows[0].reminders_sent_at,
            null,
          );
          send = async () => {
            throw new MailDeliveryError("MAIL_RATE_LIMITED", true);
          };
          await worker.deliverOne();
          assert.equal(await reminders.enqueueBatch(), 0);
          await pool.query(
            "UPDATE outbox_deliveries SET next_attempt_at=now()-interval '1 second'",
          );
          send = async () => {};
          await worker.deliverOne();
          assert.ok(
            (
              await pool.query(
                "SELECT reminders_sent_at FROM bookings WHERE id=$1",
                [ids.bookings.submitted],
              )
            ).rows[0].reminders_sent_at,
          );
          assert.equal(await reminders.enqueueBatch(), 0);
          await reset();
        },
      );
      await t.test(
        "reminder cancelled before delivery is not sent; manual guest never gets a synthetic address",
        async () => {
          await pool.query(
            `UPDATE bookings SET status='confirmed',during=tstzrange(
          date_trunc('hour',now())+interval '6 hours',date_trunc('hour',now())+interval '7 hours','[)') WHERE id=$1`,
            [ids.bookings.cash],
          );
          await pool.query(
            "UPDATE bookings SET reminders_sent_at=NULL WHERE id=$1",
            [ids.bookings.submitted],
          );
          await reminders.enqueueBatch();
          await pool.query(
            "UPDATE bookings SET status='cancelled' WHERE id=$1",
            [ids.bookings.submitted],
          );
          await worker.deliverOne();
          assert.equal(deliveries.length, 0);
          assert.equal(
            (
              await pool.query(
                "SELECT status,last_error_code FROM outbox_deliveries",
              )
            ).rows[0].last_error_code,
            "REMINDER_OBSOLETE",
          );
          assert.equal(await reminders.enqueueBatch(), 0);
          await reset();
        },
      );
      await t.test(
        "notification failure rolls back reminder intent; domain survives provider failure",
        async () => {
          await pool.query(
            "UPDATE bookings SET status='confirmed',reminders_sent_at=NULL WHERE id=$1",
            [ids.bookings.submitted],
          );
          await pool.query(`CREATE FUNCTION reject_mail_notif() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test'; END $$;
          CREATE TRIGGER reject_mail_notif BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION reject_mail_notif()`);
          await assert.rejects(() => reminders.enqueueBatch());
          assert.equal(
            (
              await pool.query(
                "SELECT count(*)::int AS n FROM outbox_deliveries",
              )
            ).rows[0].n,
            0,
          );
          await pool.query(
            "DROP TRIGGER reject_mail_notif ON notifications; DROP FUNCTION reject_mail_notif()",
          );
          await reminders.enqueueBatch();
          send = async () => {
            throw new MailDeliveryError("MAIL_PROVIDER_ERROR", true);
          };
          await worker.deliverOne();
          assert.equal(
            (
              await pool.query("SELECT status FROM bookings WHERE id=$1", [
                ids.bookings.submitted,
              ])
            ).rows[0].status,
            "confirmed",
          );
        },
      );
    } finally {
      await module.close();
    }
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${name}" CASCADE`);
    await admin.end();
  }
});
