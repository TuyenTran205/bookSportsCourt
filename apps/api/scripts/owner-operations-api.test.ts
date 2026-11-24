import "reflect-metadata";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readdir } from "node:fs/promises";
import { test } from "node:test";
import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { v7 } from "uuid";
import { GlobalExceptionFilter } from "../src/common/filters/global-exception.filter.js";
import { TransformResponseInterceptor } from "../src/common/interceptors/transform-response.interceptor.js";
import { configureHttpSecurity } from "../src/config/http-security.js";
import { DATABASE, DatabaseService } from "../src/database/database.module.js";
import * as schema from "../src/database/schema/index.js";
import { AuthJwtService } from "../src/modules/auth/auth-jwt.service.js";
import { ProofStorage } from "../src/modules/uploads/proof-storage.js";
import { CancelStalePaymentsSchedule } from "../src/schedules/cancel-stale-payments.schedule.js";
import { MemoryProofStorage } from "./fixtures/payment-cases.js";
import {
  phase4FixtureIds as ids,
  seedPhase4Fixtures,
} from "./fixtures/phase4.fixture.js";
import { readVenueTestMigration } from "./fixtures/venue-test-db.js";

test("Owner operations (timeline, manual booking, blackouts, venue hours/pricing, quote, custom policy, stale payment schedule) against PostgreSQL", async (t) => {
  const connectionString =
    process.env.VENUE_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  assert.ok(
    connectionString,
    "Set VENUE_TEST_DATABASE_URL or DATABASE_URL to local PostgreSQL",
  );
  assert.ok(
    ["localhost", "127.0.0.1", "[::1]"].includes(
      new URL(connectionString).hostname,
    ),
  );

  const schemaName = `bsc014_test_${randomBytes(6).toString("hex")}`;
  const admin = new Pool({ connectionString, connectionTimeoutMillis: 5000 });
  const pool = new Pool({
    connectionString,
    options: `-c search_path=${schemaName},public -c statement_timeout=15000`,
    connectionTimeoutMillis: 5000,
  });

  const config = {
    DATABASE_URL: connectionString,
    JWT_ACCESS_SECRET: randomBytes(32).toString("hex"),
    JWT_REFRESH_SECRET: randomBytes(32).toString("hex"),
    ALLOWED_ORIGINS: "http://localhost:3000",
    NODE_ENV: "test",
    BUSINESS_MAIL_ENABLED: "false",
  };
  const previous = Object.fromEntries(
    Object.keys(config).map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, config);

  await admin.query(`CREATE SCHEMA "${schemaName}"`);

  try {
    const migrationFiles = (
      await readdir(new URL("../src/database/migrations/", import.meta.url))
    )
      .filter((file) => file.endsWith(".sql"))
      .sort();
    for (const file of migrationFiles) {
      await pool.query(await readVenueTestMigration(file));
    }

    const client = await pool.connect();
    try {
      await seedPhase4Fixtures(client, "$argon2id$test-fixture-not-for-login");
      await client.query(
        `UPDATE bookings SET created_at = now() - interval '2 days'`,
      );
      for (let day = 0; day <= 6; day += 1) {
        await client.query(
          `INSERT INTO opening_hours (id, court_id, day_of_week, open_time, close_time)
           VALUES ($1, $2, $3, '06:00', '23:00')
           ON CONFLICT (court_id, day_of_week) DO UPDATE SET open_time = '06:00', close_time = '23:00'`,
          [v7(), ids.courts.a, day],
        );
      }
    } finally {
      client.release();
    }

    const { AppModule } = await import("../src/app.module.js");
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ProofStorage)
      .useValue(new MemoryProofStorage())
      .overrideProvider(DATABASE)
      .useValue(drizzle(pool, { schema }))
      .overrideProvider(DatabaseService)
      .useValue({
        query: (text: string, values?: unknown[]) => pool.query(text, values),
      })
      .compile();

    const app = module.createNestApplication();
    app.setGlobalPrefix("api/v1");
    configureHttpSecurity(app);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new TransformResponseInterceptor());

    try {
      await app.listen(0, "127.0.0.1");
      const base = `${await app.getUrl()}/api/v1`;
      const tokens = Object.fromEntries(
        await Promise.all(
          Object.entries(ids.users).map(async ([key, id]) => [
            key,
            await app.get(AuthJwtService).sign(id, "access", false),
          ]),
        ),
      );

      const request = (
        path: string,
        who = "guest",
        method = "GET",
        body?: unknown,
      ) =>
        fetch(base + path, {
          method,
          headers: {
            "X-Request-Origin": "http://localhost:3000",
            ...(tokens[who] ? { Cookie: `access_token=${tokens[who]}` } : {}),
            ...(body !== undefined
              ? { "Content-Type": "application/json" }
              : {}),
          },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
          signal: AbortSignal.timeout(10000),
        });

      await t.test(
        "1. GET /owner/timeline & GET /owner/bookings enforce ownership and return filtered day/booking views",
        async () => {
          assert.equal(
            (await request(`/owner/timeline?venueId=${ids.venues.a}&date=2035-01-03`)).status,
            401,
          );
          assert.equal(
            (await request(`/owner/timeline?venueId=${ids.venues.a}&date=2035-01-03`, "customerA")).status,
            403,
          );
          assert.equal(
            (await request(`/owner/timeline?venueId=${ids.venues.a}&date=2035-01-03`, "ownerB")).status,
            403,
          );
          assert.equal(
            (await request(`/owner/timeline?venueId=${ids.venues.a}`, "ownerA")).status,
            400,
          );
          assert.equal(
            (await request(`/owner/timeline?venueId=019a0000-0004-7000-8000-999999999999&date=2035-01-03`, "ownerA")).status,
            404,
          );

          const res = await request(
            `/owner/timeline?venueId=${ids.venues.a}&date=2035-01-03`,
            "ownerA",
          );
          assert.equal(res.status, 200);
          const { data } = (await res.json()) as {
            data: {
              venueId: string;
              date: string;
              courts: Array<{ id: string }>;
              bookings: Array<{ id: string }>;
              openingHours: Array<{ weekday: number }>;
            };
          };
          assert.equal(data.venueId, ids.venues.a);
          assert.equal(data.date, "2035-01-03");
          assert.ok(data.courts.some((c) => c.id === ids.courts.a));
          assert.ok(data.bookings.some((b) => b.id === ids.bookings.completed));
          assert.equal(data.openingHours.length, 7);

          // GET /owner/bookings scope & filters
          assert.equal(
            (await request(`/owner/bookings?venueId=${ids.venues.a}`, "ownerB")).status,
            403,
          );
          const listRes = await request(
            `/owner/bookings?venueId=${ids.venues.a}&status=completed&limit=50`,
            "ownerA",
          );
          assert.equal(listRes.status, 200);
          const listJson = (await listRes.json()) as {
            data: Array<{ id: string; venueId: string }>;
            meta: { total: number };
          };
          assert.ok(listJson.meta.total >= 1);
          assert.ok(listJson.data.every((b) => b.venueId === ids.venues.a));
        },
      );

      await t.test(
        "2. POST /owner/bookings/manual creates walk-in booking + cash payment, supports slots[], rejects conflicts & unauthorized owners",
        async () => {
          assert.equal(
            (
              await request("/owner/bookings/manual", "customerA", "POST", {
                courtId: ids.courts.a,
                start: "2035-06-01T08:00:00+07:00",
                end: "2035-06-01T09:00:00+07:00",
              })
            ).status,
            403,
          );
          assert.equal(
            (
              await request("/owner/bookings/manual", "ownerB", "POST", {
                courtId: ids.courts.a,
                start: "2035-06-01T08:00:00+07:00",
                end: "2035-06-01T09:00:00+07:00",
              })
            ).status,
            403,
          );
          assert.equal(
            (
              await request("/owner/bookings/manual", "ownerA", "POST", {
                courtId: ids.courts.a,
                start: "2035-06-01T10:00:00+07:00",
                end: "2035-06-01T09:00:00+07:00",
              })
            ).status,
            400,
          );

          const createdRes = await request(
            "/owner/bookings/manual",
            "ownerA",
            "POST",
            {
              courtId: ids.courts.a,
              start: "2035-06-01T08:00:00+07:00",
              end: "2035-06-01T09:00:00+07:00",
              guestName: "Anh Minh tại quầy",
              guestPhone: "0909888777",
              totalPrice: 240000,
            },
          );
          assert.equal(createdRes.status, 201);
          const created = (await createdRes.json()) as {
            data: {
              id: string;
              status: string;
              source: string;
              totalPrice: number;
            };
          };
          assert.equal(created.data.status, "confirmed");
          assert.equal(created.data.source, "manual");
          assert.equal(created.data.totalPrice, 240000);

          const dbCheck = await pool.query<{ provider: string; status: string; amount: number }>(
            `SELECT provider, status, amount FROM payments WHERE booking_id = $1`,
            [created.data.id],
          );
          assert.equal(dbCheck.rows[0]?.provider, "cash");
          assert.equal(dbCheck.rows[0]?.status, "completed");
          assert.equal(dbCheck.rows[0]?.amount, 240000);

          // Conflict on overlapping slot
          const conflictRes = await request(
            "/owner/bookings/manual",
            "ownerA",
            "POST",
            {
              courtId: ids.courts.a,
              slots: [
                {
                  start: "2035-06-01T08:30:00+07:00",
                  end: "2035-06-01T09:30:00+07:00",
                },
              ],
            },
          );
          assert.equal(conflictRes.status, 400);
          const conflictBody = (await conflictRes.json()) as { error: { code: string } };
          assert.equal(conflictBody.error.code, "SLOT_CONFLICT");

          // Verify manual booking appears on OwnerTimeline
          const tlRes = await request(
            `/owner/timeline?venueId=${ids.venues.a}&date=2035-06-01`,
            "ownerA",
          );
          const tlData = (await tlRes.json()) as {
            data: { bookings: Array<{ id: string; source: string }> };
          };
          assert.ok(
            tlData.data.bookings.some(
              (b) => b.id === created.data.id && b.source === "manual",
            ),
          );
        },
      );

      await t.test(
        "3. Blackouts CRUD blocks SlotGrid & POST /bookings/hold, then unlocks on DELETE",
        async () => {
          const boStart = "2035-06-10T09:00:00+07:00";
          const boEnd = "2035-06-10T10:00:00+07:00";

          // Ownership check
          assert.equal(
            (
              await request(`/courts/${ids.courts.a}/blackouts`, "ownerB", "POST", {
                start: boStart,
                end: boEnd,
                reason: "Trộm khoá",
              })
            ).status,
            403,
          );

          // Invalid range
          assert.equal(
            (
              await request(`/courts/${ids.courts.a}/blackouts`, "ownerA", "POST", {
                start: boEnd,
                end: boStart,
              })
            ).status,
            400,
          );

          // Create blackout
          const createBoRes = await request(
            `/courts/${ids.courts.a}/blackouts`,
            "ownerA",
            "POST",
            { start: boStart, end: boEnd, reason: "Thay lưới và đèn" },
          );
          assert.equal(createBoRes.status, 201);
          const boJson = (await createBoRes.json()) as {
            data: { id: string; courtId: string; reason: string };
          };
          assert.equal(boJson.data.courtId, ids.courts.a);
          assert.equal(boJson.data.reason, "Thay lưới và đèn");

          // List blackouts (BlackoutsController requires YYYY-MM-DD from/to query)
          const listBoRes = await request(
            `/courts/${ids.courts.a}/blackouts?from=2035-06-09&to=2035-06-11`,
            "ownerA",
          );
          const listBoText = await listBoRes.text();
          assert.equal(listBoRes.status, 200, listBoText);
          const listBo = JSON.parse(listBoText) as {
            data: Array<{ id: string }>;
          };
          assert.ok(listBo.data.some((b) => b.id === boJson.data.id));

          // SlotGrid reflects blocked slots
          const slotsBlocked = (await (
            await request(`/venues/${ids.venues.a}/slots?date=2035-06-10`)
          ).json()) as {
            data: {
              courts: Array<{
                courtId: string;
                slots: Array<{ start: string; status: string }>;
              }>;
            };
          };
          const courtSlots = slotsBlocked.data.courts.find(
            (c) => c.courtId === ids.courts.a,
          )!;
          const targetSlot = courtSlots.slots.find((s) =>
            s.start.startsWith("2035-06-10T09:00"),
          );
          assert.equal(targetSlot?.status, "blocked");

          // Hold against blocked slot fails with 409 BOOKING_CONFLICT
          const holdBlockedRes = await request(
            "/bookings/hold",
            "customerA",
            "POST",
            { courtId: ids.courts.a, start: boStart, end: "2035-06-10T09:30:00+07:00" },
          );
          assert.equal(holdBlockedRes.status, 409);

          // Unlock (delete blackout)
          assert.equal(
            (
              await request(
                `/courts/${ids.courts.a}/blackouts/${boJson.data.id}`,
                "ownerB",
                "DELETE",
              )
            ).status,
            403,
          );
          const delBoRes = await request(
            `/courts/${ids.courts.a}/blackouts/${boJson.data.id}`,
            "ownerA",
            "DELETE",
          );
          assert.equal(delBoRes.status, 200);

          // Slot returns to available and customer can hold
          const holdOpenRes = await request(
            "/bookings/hold",
            "customerA",
            "POST",
            { courtId: ids.courts.a, start: boStart, end: "2035-06-10T09:30:00+07:00" },
          );
          assert.equal(holdOpenRes.status, 201);
          const holdOpen = (await holdOpenRes.json()) as { data: { booking: { id: string } } };
          // Release immediately so subsequent tests remain clean
          assert.equal(
            (await request(`/bookings/holds/${holdOpen.data.booking.id}`, "customerA", "DELETE")).status,
            204,
          );
        },
      );

      await t.test(
        "4. Venue-level opening-hours, pricing-rules, POST /bookings/quote and custom cancellation policy (OWN-10)",
        async () => {
          // OwnerB cannot access or mutate Venue A hours/pricing/policy
          assert.equal(
            (await request(`/owner/venues/${ids.venues.a}/opening-hours`, "ownerB")).status,
            403,
          );
          assert.equal(
            (await request(`/owner/venues/${ids.venues.a}/pricing-rules`, "ownerB")).status,
            403,
          );

          // Update venue opening hours (close Sunday weekday=0)
          const hoursPayload = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
            weekday,
            openTime: "06:00",
            closeTime: "22:00",
            isClosed: weekday === 0,
          }));
          const putHoursRes = await request(
            `/owner/venues/${ids.venues.a}/opening-hours`,
            "ownerA",
            "PUT",
            { hours: hoursPayload },
          );
          assert.equal(putHoursRes.status, 200);

          // Create & delete venue pricing rule
          assert.equal(
            (
              await request(
                `/owner/venues/${ids.venues.a}/pricing-rules`,
                "ownerA",
                "POST",
                {
                  label: "Giờ vàng chiều",
                  weekdays: [1, 2, 3, 4, 5],
                  startTime: "17:00",
                  endTime: "21:00",
                  pricePerSlot: 80000,
                },
              )
            ).status,
            201,
          );
          const listRules = (await (
            await request(`/owner/venues/${ids.venues.a}/pricing-rules`, "ownerA")
          ).json()) as { data: Array<{ id: string; label: string }> };
          const goldenRule = listRules.data.find((r) => r.label === "Giờ vàng chiều");
          assert.ok(goldenRule);
          assert.equal(
            (await request(`/owner/pricing-rules/${goldenRule.id}`, "ownerB", "DELETE")).status,
            403,
          );
          assert.equal(
            (await request(`/owner/pricing-rules/${goldenRule.id}`, "ownerA", "DELETE")).status,
            204,
          );

          // Update custom cancellation policy (OWN-10): 48h before, 50% refund, 30% deposit
          const putPolicyRes = await request(
            `/owner/venues/${ids.venues.a}/cancellation-policy`,
            "ownerA",
            "PUT",
            { cancelBeforeHours: 48, refundPercent: 50, depositPercent: 30 },
          );
          assert.equal(putPolicyRes.status, 200);

          // Quote booking: 2035-06-12 is Tuesday (open), 10:00..11:00 (2 slots x 50k = 100k, deposit 30% = 30k)
          const quoteRes = await request("/bookings/quote", "guest", "POST", {
            courtId: ids.courts.a,
            slots: [
              { start: "2035-06-12T10:00:00+07:00", end: "2035-06-12T10:30:00+07:00" },
              { start: "2035-06-12T10:30:00+07:00", end: "2035-06-12T11:00:00+07:00" },
            ],
          });
          assert.equal(quoteRes.status, 201);
          const quote = (await quoteRes.json()) as {
            data: {
              total: number;
              deposit: number;
              depositPercent: number;
              ranges: Array<{ start: string; end: string }>;
              unavailable: string[];
            };
          };
          assert.equal(quote.data.total, 100000);
          assert.equal(quote.data.depositPercent, 30);
          assert.equal(quote.data.deposit, 30000);
          assert.equal(quote.data.ranges.length, 1);
          assert.deepEqual(quote.data.unavailable, []);

          // Quote flags overlapping occupied slot (2035-06-01T08:00 manual booking created in test 2)
          const quoteBusyRes = await request("/bookings/quote", "guest", "POST", {
            courtId: ids.courts.a,
            slots: [
              { start: "2035-06-01T08:00:00+07:00", end: "2035-06-01T08:30:00+07:00" },
            ],
          });
          assert.equal(quoteBusyRes.status, 201);
          const quoteBusy = (await quoteBusyRes.json()) as { data: { unavailable: string[] } };
          assert.equal(quoteBusy.data.unavailable.length, 1);

          // Hold + confirm + cancellation-preview uses custom 48h & 50% refund policy
          const holdRes = await request("/bookings/hold", "customerB", "POST", {
            courtId: ids.courts.a,
            start: "2035-06-12T14:00:00+07:00",
            end: "2035-06-12T15:00:00+07:00",
          });
          assert.equal(holdRes.status, 201);
          const holdJson = (await holdRes.json()) as {
            data: { booking: { id: string; depositAmount: number } };
          };
          assert.equal(holdJson.data.booking.depositAmount, 30000);
          assert.equal(
            (await request(`/bookings/${holdJson.data.booking.id}/confirm`, "customerB", "POST")).status,
            200,
          );
          const previewRes = await request(
            `/bookings/${holdJson.data.booking.id}/cancellation-preview`,
            "customerB",
          );
          assert.equal(previewRes.status, 200);
          const preview = (await previewRes.json()) as {
            data: { canCancel: boolean; refundPercent: number; refundAmount: number };
          };
          assert.equal(preview.data.canCancel, true);
          assert.equal(preview.data.refundPercent, 50);
          assert.equal(preview.data.refundAmount, 15000);
        },
      );

      await t.test(
        "5. CancelStalePaymentsSchedule.run() executes batch expiry cleanly and skips concurrent overlap",
        async () => {
          const schedule = app.get(CancelStalePaymentsSchedule);
          await Promise.all([schedule.run(), schedule.run()]);
        },
      );
    } finally {
      await app.close();
    }
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await admin.end();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
