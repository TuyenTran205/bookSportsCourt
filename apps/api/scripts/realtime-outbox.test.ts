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
import { RealtimeOutboxRepository } from "../src/modules/realtime/realtime-outbox.repository.js";
import { RealtimeOutboxService } from "../src/modules/realtime/realtime-outbox.service.js";
import { RealtimePublisher } from "../src/modules/realtime/realtime.publisher.js";
import { BookingsService } from "../src/modules/bookings/bookings.service.js";
import { readVenueTestMigration } from "./fixtures/venue-test-db.js";
import {
  seedPhase4Fixtures,
  phase4FixtureIds as ids,
} from "./fixtures/phase4.fixture.js";

type Emitted = { event: string; to: string; payload: unknown };

test("Realtime outbox consumer routes committed events to rooms", async () => {
  const connection = process.env.VENUE_TEST_DATABASE_URL;
  assert.ok(connection, "VENUE_TEST_DATABASE_URL is required");
  const url = new URL(connection);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  ) {
    throw new Error("Realtime fixture tests require a local PostgreSQL URL");
  }
  const name = `bsc014_test_${randomBytes(6).toString("hex")}`;
  const adminPool = new Pool({ connectionString: connection });
  await adminPool.query(`CREATE SCHEMA "${name}"`);
  const pool = new Pool({
    connectionString: connection,
    options: `-c search_path=${name},public -c statement_timeout=15000`,
  });
  const emitted: Emitted[] = [];
  let failEmit = false;
  const fakePublisher = {
    emitSlots(payload: {
      venueId: string;
      courtId: string;
      date: string;
      slots: unknown[];
    }) {
      emitted.push({
        event: "slot_updated",
        to: `venue:${payload.venueId}:date:${payload.date}`,
        payload,
      });
    },
    emitBookingCreated(
      ownerId: string,
      customerId: string | null,
      payload: unknown,
    ) {
      emitted.push({
        event: "booking_created",
        to: `owner:${ownerId}`,
        payload,
      });
      if (customerId) {
        emitted.push({
          event: "booking_created",
          to: `user:${customerId}`,
          payload,
        });
      }
    },
    emitPaymentSubmitted(ownerId: string, payload: unknown) {
      if (failEmit) throw new Error("transport down");
      emitted.push({
        event: "payment_submitted",
        to: `owner:${ownerId}`,
        payload,
      });
    },
    emitBookingCancelled(userId: string, payload: unknown) {
      emitted.push({
        event: "booking_cancelled",
        to: `user:${userId}`,
        payload,
      });
    },
    emitHoldExpired(userId: string, payload: unknown) {
      emitted.push({ event: "hold_expired", to: `user:${userId}`, payload });
    },
    emitBookingConfirmed(userId: string, payload: unknown) {
      emitted.push({
        event: "booking_confirmed",
        to: `user:${userId}`,
        payload,
      });
    },
    emitPaymentRejected(userId: string, payload: unknown) {
      emitted.push({
        event: "payment_rejected",
        to: `user:${userId}`,
        payload,
      });
    },
    emitNotification(userId: string, payload: unknown) {
      emitted.push({
        event: "notification_created",
        to: `user:${userId}`,
        payload,
      });
    },
  };
  const fakeBookings = {
    getVenueSlots: async (_venueId: string, opts: { date: string }) => ({
      data: {
        date: opts.date,
        courts: [
          {
            courtId: ids.courts.a,
            slots: [
              {
                start: `${opts.date}T01:00:00.000Z`,
                end: `${opts.date}T02:00:00.000Z`,
                status: "available",
              },
            ],
          },
        ],
      },
    }),
  };
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
    const config = new ConfigService({ REALTIME_OUTBOX_ENABLED: true });
    const module = await Test.createTestingModule({
      providers: [
        RealtimeOutboxRepository,
        RealtimeOutboxService,
        { provide: DATABASE, useValue: drizzle(pool, { schema }) },
        { provide: ConfigService, useValue: config },
        { provide: RealtimePublisher, useValue: fakePublisher },
        { provide: BookingsService, useValue: fakeBookings },
      ],
    }).compile();
    const worker = module.get(RealtimeOutboxService);

    const enqueue = async (
      event: string,
      recipient: string,
      eventKey: string,
      payload: unknown,
    ) =>
      (
        await pool.query(
          `INSERT INTO outbox_deliveries(id,event_key,event_type,channel,recipient_id,payload)
           VALUES ($1,$2,$3,'realtime',$4,$5) RETURNING id`,
          [
            crypto.randomUUID(),
            eventKey,
            event,
            recipient,
            JSON.stringify(payload),
          ],
        )
      ).rows[0].id as string;
    const get = async (id: string) =>
      (await pool.query("SELECT * FROM outbox_deliveries WHERE id=$1", [id]))
        .rows[0];

    const bookingRef = {
      bookingId: ids.bookings.submitted,
      venueId: ids.venues.a,
      courtId: ids.courts.a,
    };

    // 1) booking_created → room owner + room cá nhân khách + mirror notification.
    const createdId = await enqueue(
      "booking_created",
      ids.users.ownerA,
      `booking:${ids.bookings.submitted}:created`,
      bookingRef,
    );
    await pool.query(
      `INSERT INTO notifications(id,user_id,type,title,body,event_key)
       VALUES ($1,$2,'booking_created','Đặt sân mới','X',$3)`,
      [
        crypto.randomUUID(),
        ids.users.ownerA,
        `booking:${ids.bookings.submitted}:created`,
      ],
    );
    emitted.length = 0;
    await worker.deliverOne();
    assert.equal((await get(createdId)).status, "delivered");
    assert.ok(
      emitted.some(
        (e) =>
          e.event === "booking_created" &&
          e.to === `owner:${ids.users.ownerA}`,
      ),
    );
    assert.ok(
      emitted.some(
        (e) =>
          e.event === "booking_created" &&
          e.to === `user:${ids.users.customerA}`,
      ),
    );
    // 2) booking_cancelled → room cá nhân khách.
    const cancelledId = await enqueue(
      "booking_cancelled",
      ids.users.customerA,
      `booking:${ids.bookings.submitted}:cancelled`,
      { bookingId: ids.bookings.submitted, reason: "OWNER_REJECT" },
    );
    emitted.length = 0;
    await worker.deliverOne();
    assert.equal((await get(cancelledId)).status, "delivered");
    assert.ok(
      emitted.some(
        (e) =>
          e.event === "booking_cancelled" &&
          e.to === `user:${ids.users.customerA}`,
      ),
    );

    // 2b) payment_rejected → room cá nhân khách, kèm paymentId + lý do.
    const rejectedId = await enqueue(
      "payment_rejected",
      ids.users.customerA,
      `payment:${ids.payments.submitted}:rejected`,
      {
        bookingId: ids.bookings.submitted,
        paymentId: ids.payments.submitted,
        reason: "PROOF_INVALID",
      },
    );
    emitted.length = 0;
    await worker.deliverOne();
    assert.equal((await get(rejectedId)).status, "delivered");
    assert.ok(
      emitted.some(
        (e) =>
          e.event === "payment_rejected" &&
          e.to === `user:${ids.users.customerA}`,
      ),
    );

    // 3) slot_refresh_requested → hydrate lưới slot, date theo múi giờ VN.
    const refreshId = await enqueue(
      "slot_refresh_requested",
      ids.users.ownerA,
      `slot:${ids.courts.a}:refresh`,
      {
        venueId: ids.venues.a,
        courtId: ids.courts.a,
        start: "2035-01-01T17:00:00.000Z",
        end: "2035-01-01T18:00:00.000Z",
      },
    );
    emitted.length = 0;
    await worker.deliverOne();
    assert.equal((await get(refreshId)).status, "delivered");
    const slotEvent = emitted.find((e) => e.event === "slot_updated");
    assert.ok(slotEvent);
    assert.equal(slotEvent.to, `venue:${ids.venues.a}:date:2035-01-02`);
    assert.equal((slotEvent.payload as { slots: unknown[] }).slots.length, 1);

    // 4) Sai recipient → failed, không phát.
    const invalidId = await enqueue(
      "booking_created",
      ids.users.ownerB,
      "booking:invalid:created",
      bookingRef,
    );
    emitted.length = 0;
    await worker.deliverOne();
    const invalidRow = await get(invalidId);
    assert.equal(invalidRow.status, "failed");
    assert.equal(invalidRow.last_error_code, "INVALID_EVENT_OR_RECIPIENT");
    assert.deepEqual(emitted, []);

    // 5) Event type lạ → failed INVALID_EVENT.
    const unknownId = await enqueue(
      "weird_event",
      ids.users.ownerA,
      "test:weird",
      {},
    );
    await worker.deliverOne();
    const unknownRow = await get(unknownId);
    assert.equal(unknownRow.status, "failed");
    assert.equal(unknownRow.last_error_code, "INVALID_EVENT");

    // 6) Publisher lỗi tạm thời → pending + attempts tăng, retry khi đến hạn.
    const paymentId = await enqueue(
      "payment_submitted",
      ids.users.ownerA,
      `payment:${ids.payments.submitted}:submitted`,
      {
        bookingId: ids.bookings.submitted,
        paymentId: ids.payments.submitted,
        venueId: ids.venues.a,
      },
    );
    failEmit = true;
    emitted.length = 0;
    await worker.deliverOne();
    const pendingRow = await get(paymentId);
    assert.equal(pendingRow.status, "pending");
    assert.equal(pendingRow.attempts, 1);
    assert.equal(pendingRow.last_error_code, "REALTIME_DELIVERY_FAILED");
    await pool.query(
      "UPDATE outbox_deliveries SET next_attempt_at=now() WHERE id=$1",
      [paymentId],
    );
    failEmit = false;
    await worker.deliverOne();
    assert.equal((await get(paymentId)).status, "delivered");

    // 7) Quá 5 lần thử → failed REALTIME_MAX_ATTEMPTS, không phát.
    const stuckId = await enqueue(
      "booking_cancelled",
      ids.users.customerA,
      "test:stuck",
      { bookingId: ids.bookings.submitted },
    );
    await pool.query(
      "UPDATE outbox_deliveries SET attempts=5, next_attempt_at=now() WHERE id=$1",
      [stuckId],
    );
    emitted.length = 0;
    await worker.deliverOne();
    const stuckRow = await get(stuckId);
    assert.equal(stuckRow.status, "failed");
    assert.equal(stuckRow.last_error_code, "REALTIME_MAX_ATTEMPTS");
    assert.deepEqual(emitted, []);
  } finally {
    await adminPool.query(`DROP SCHEMA IF EXISTS "${name}" CASCADE`);
    await pool.end();
    await adminPool.end();
  }
});
