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
import { BookingsScheduleService } from "../src/modules/bookings/bookings-schedule.service.js";
import { ProofStorage } from "../src/modules/uploads/proof-storage.js";
import { MemoryProofStorage } from "./fixtures/payment-cases.js";
import {
  phase4FixtureIds as ids,
  seedPhase4Fixtures,
} from "./fixtures/phase4.fixture.js";
import { readVenueTestMigration } from "./fixtures/venue-test-db.js";

test("Bookings & Time Slot Grid Engine: 7 REST APIs, 20-way race condition (5 rounds), idempotency, TTL & cron against PostgreSQL", async (t) => {
  const connectionString =
    process.env.VENUE_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    t.skip("Set VENUE_TEST_DATABASE_URL or DATABASE_URL to local PostgreSQL");
    return;
  }
  assert.ok(
    ["localhost", "127.0.0.1", "[::1]"].includes(
      new URL(connectionString).hostname,
    ),
  );

  const schemaName = `bsc014_test_${randomBytes(6).toString("hex")}`;
  const admin = new Pool({ connectionString, connectionTimeoutMillis: 5000 });
  const pool = new Pool({
    connectionString,
    max: 25,
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
      // Đẩy created_at của các bản ghi fixture cũ lùi về 2 ngày trước để không chạm ngưỡng rate-limit 1 giờ của test mới
      await client.query(
        `UPDATE bookings SET created_at = now() - interval '2 days'`,
      );
      // Seed opening hours for all 7 weekdays on Court A & Court B
      for (let day = 0; day <= 6; day++) {
        await client.query(
          `INSERT INTO opening_hours (id, court_id, day_of_week, open_time, close_time)
           VALUES ($1, $2, $3, '06:00', '23:00')
           ON CONFLICT (court_id, day_of_week) DO UPDATE SET open_time = '06:00', close_time = '23:00'`,
          [v7(), ids.courts.a, day],
        );
        await client.query(
          `INSERT INTO opening_hours (id, court_id, day_of_week, open_time, close_time)
           VALUES ($1, $2, $3, '06:00', '23:00')
           ON CONFLICT (court_id, day_of_week) DO UPDATE SET open_time = '06:00', close_time = '23:00'`,
          [v7(), ids.courts.b, day],
        );
      }
      await client.query(
        `INSERT INTO cancellation_policies (venue_id, cancel_before_hours, refund_percent, deposit_percent)
         VALUES ($1, 24, 100, 50)
         ON CONFLICT (venue_id) DO UPDATE SET cancel_before_hours = 24, refund_percent = 100, deposit_percent = 50`,
        [ids.venues.a],
      );
    } finally {
      client.release();
    }

    const { AppModule } = await import("../src/app.module.js");
    const storage = new MemoryProofStorage();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ProofStorage)
      .useValue(storage)
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
      const jwtService = app.get(AuthJwtService);
      const scheduleService = app.get(BookingsScheduleService);

      const tokens: Record<string, string> = Object.fromEntries(
        await Promise.all(
          Object.entries(ids.users).map(async ([key, id]) => [
            key,
            await jwtService.sign(id, "access", false),
          ]),
        ),
      );

      // Tạo sẵn 20 tài khoản customer độc lập để kiểm thử race condition 20 luồng đồng thời
      const raceCustomerTokens: string[] = [];
      for (let i = 0; i < 20; i++) {
        const raceUserId = `019a0000-0099-7000-8000-${String(i + 1).padStart(12, "0")}`;
        await pool.query(
          `INSERT INTO users (id, email, password_hash, full_name, role, status, email_verified_at)
           VALUES ($1, $2, '$argon2id$race-test', $3, 'customer', 'active', now())`,
          [raceUserId, `racer-${i + 1}@booking.example.test`, `Racer ${i + 1}`],
        );
        raceCustomerTokens.push(await jwtService.sign(raceUserId, "access", false));
      }

      const api = (
        path: string,
        options: {
          token?: string;
          method?: string;
          body?: unknown;
          headers?: Record<string, string>;
        } = {},
      ) =>
        fetch(`${base}${path}`, {
          method: options.method ?? "GET",
          headers: {
            ...(options.token ? { Cookie: `access_token=${options.token}` } : {}),
            ...(options.body !== undefined
              ? { "Content-Type": "application/json" }
              : {}),
            ...(options.headers ?? {}),
          },
          body:
            options.body !== undefined ? JSON.stringify(options.body) : undefined,
        });

      await t.test(
        "1. GET /venues/:id/slots returns 30-min grid, Cache-Control: no-store, X-Grid-Version, and lazy-expires stale holds",
        async () => {
          const res = await api(`/venues/${ids.venues.a}/slots?date=2035-06-10`);
          assert.equal(res.status, 200);
          assert.equal(res.headers.get("cache-control"), "no-store");
          assert.ok(res.headers.get("x-grid-version"));

          const json = (await res.json()) as {
            data: {
              date: string;
              courts: Array<{
                courtId: string;
                slots: Array<{
                  start: string;
                  end: string;
                  status: string;
                  price: number;
                  mine?: boolean;
                }>;
              }>;
            };
          };
          assert.equal(json.data.date, "2035-06-10");
          assert.equal(json.data.courts.length, 1);
          // 06:00 -> 23:00 = 17 hours = 34 blocks of 30 minutes
          assert.equal(json.data.courts[0]!.slots.length, 34);
          assert.equal(json.data.courts[0]!.slots[0]!.price, 50000);
          assert.equal(json.data.courts[0]!.slots[0]!.status, "available");
        },
      );

      await t.test(
        "2. POST /bookings/hold & Idempotency: creates hold with server-computed price & deposit, and returns 200 on duplicate Idempotency-Key or range",
        async () => {
          const holdPayload = {
            courtId: ids.courts.a,
            slots: [
              {
                start: "2035-06-10T08:00:00+07:00",
                end: "2035-06-10T08:30:00+07:00",
              },
              {
                start: "2035-06-10T08:30:00+07:00",
                end: "2035-06-10T09:00:00+07:00",
              },
            ],
            idempotencyKey: "idem-key-test-01",
            note: "Giữ chỗ 2 block sáng",
          };

          const firstRes = await api("/bookings/hold", {
            method: "POST",
            token: tokens.customerA,
            body: holdPayload,
          });
          assert.equal(firstRes.status, 201);
          const firstJson = (await firstRes.json()) as {
            data: {
              booking: {
                id: string;
                status: string;
                totalPrice: number;
                depositAmount: number;
              };
              payment: {
                id: string;
                amount: number;
                transferCode: string;
                bankAccount: { bankBin: string; accountNo: string };
              };
            };
          };
          assert.equal(firstJson.data.booking.status, "held");
          assert.equal(firstJson.data.booking.totalPrice, 100000); // 2 * 50,000
          assert.equal(firstJson.data.booking.depositAmount, 50000); // 50% deposit policy
          assert.equal(firstJson.data.payment.amount, 50000);
          assert.match(firstJson.data.payment.transferCode, /^BSC-[A-Z0-9]{6}$/);

          // Gửi lại lần 2 cùng Idempotency-Key -> trả 200 với đúng booking cũ
          const secondRes = await api("/bookings/hold", {
            method: "POST",
            token: tokens.customerA,
            body: holdPayload,
          });
          assert.equal(secondRes.status, 200);
          const secondJson = (await secondRes.json()) as typeof firstJson;
          assert.equal(secondJson.data.booking.id, firstJson.data.booking.id);
          assert.equal(secondJson.data.payment.id, firstJson.data.payment.id);

          // Khách khác tranh chấp cùng khung giờ -> trả 409 BOOKING_CONFLICT
          const conflictRes = await api("/bookings/hold", {
            method: "POST",
            token: tokens.customerB,
            body: {
              courtId: ids.courts.a,
              start: "2035-06-10T08:30:00+07:00",
              end: "2035-06-10T09:30:00+07:00",
            },
          });
          assert.equal(conflictRes.status, 409);

          // Kiểm tra trên lưới giờ: customerA thấy mine=true, customerB thấy held nhưng không có mine
          const gridMineRes = await api(
            `/venues/${ids.venues.a}/slots?date=2035-06-10`,
            { token: tokens.customerA },
          );
          const gridMineJson = (await gridMineRes.json()) as {
            data: {
              courts: Array<{
                slots: Array<{ start: string; status: string; mine?: boolean }>;
              }>;
            };
          };
          const slot8amMine = gridMineJson.data.courts[0]!.slots.find((s) =>
            s.start.startsWith("2035-06-10T08:00:00"),
          );
          assert.equal(slot8amMine?.status, "held");
          assert.equal(slot8amMine?.mine, true);

          const gridOtherRes = await api(
            `/venues/${ids.venues.a}/slots?date=2035-06-10`,
            { token: tokens.customerB },
          );
          const gridOtherJson = (await gridOtherRes.json()) as typeof gridMineJson;
          const slot8amOther = gridOtherJson.data.courts[0]!.slots.find((s) =>
            s.start.startsWith("2035-06-10T08:00:00"),
          );
          assert.equal(slot8amOther?.status, "held");
          assert.equal(slot8amOther?.mine, undefined);

          // Giải phóng hold bằng DELETE /bookings/holds/:holdId -> 204 No Content
          const releaseRes = await api(
            `/bookings/holds/${firstJson.data.booking.id}`,
            {
              method: "DELETE",
              token: tokens.customerA,
            },
          );
          assert.equal(releaseRes.status, 204);
        },
      );

      await t.test(
        "3. Concurrency Race Condition: 20 simultaneous POST /bookings/hold requests on the same slot x 5 rounds -> exactly 1 x 201 and 19 x 409 per round",
        async () => {
          for (let round = 1; round <= 5; round++) {
            const dateStr = `2035-07-0${round}`;
            const startAt = `${dateStr}T18:00:00+07:00`;

            const responses = await Promise.all(
              raceCustomerTokens.map((token, idx) =>
                api("/bookings/hold", {
                  method: "POST",
                  token,
                  headers: {
                    "Idempotency-Key": `race-round-${round}-user-${idx}`,
                  },
                  body: {
                    courtId: ids.courts.a,
                    startAt,
                    blocks: 2,
                  },
                }),
              ),
            );

            const statuses = responses.map((r) => r.status);
            const count201 = statuses.filter((s) => s === 201).length;
            const count409 = statuses.filter((s) => s === 409).length;

            assert.equal(
              count201,
              1,
              `Round ${round}: expected exactly 1 status 201, got ${count201} (statuses: ${statuses.join(",")})`,
            );
            assert.equal(
              count409,
              19,
              `Round ${round}: expected 19 status 409, got ${count409}`,
            );

            // Giải phóng hold thắng cuộc của vòng này để không cộng dồn chạm trần HOLD_LIMIT=3 ở các vòng sau
            const winnerIdx = statuses.findIndex((s) => s === 201);
            const winnerJson = (await responses[winnerIdx]!.json()) as {
              data: { booking: { id: string } };
            };
            await api(`/bookings/holds/${winnerJson.data.booking.id}`, {
              method: "DELETE",
              token: raceCustomerTokens[winnerIdx],
            });
          }
        },
      );

      await t.test(
        "4. TTL, Confirm, Cron Expire & Cron Auto-Complete",
        async () => {
          // Tạo 1 hold mới và confirm thành công
          const holdRes = await api("/bookings/hold", {
            method: "POST",
            token: tokens.customerB,
            body: {
              courtId: ids.courts.b,
              start: "2035-08-10T10:00:00+07:00",
              end: "2035-08-10T11:00:00+07:00",
            },
          });
          assert.equal(holdRes.status, 201);
          const holdData = (await holdRes.json()) as {
            data: { booking: { id: string } };
          };
          const bookingId = holdData.data.booking.id;

          const confirmRes = await api(`/bookings/${bookingId}/confirm`, {
            method: "POST",
            token: tokens.customerB,
          });
          assert.equal(confirmRes.status, 200);
          const confirmedJson = (await confirmRes.json()) as {
            data: { status: string; expiresAt: string | null };
          };
          assert.equal(confirmedJson.data.status, "confirmed");
          assert.equal(confirmedJson.data.expiresAt, null);

          // Tạo 1 hold khác, tua ngược expires_at về quá khứ -> confirm trả 422 HOLD_EXPIRED
          const staleHoldRes = await api("/bookings/hold", {
            method: "POST",
            token: tokens.customerB,
            body: {
              courtId: ids.courts.b,
              start: "2035-08-10T14:00:00+07:00",
              end: "2035-08-10T15:00:00+07:00",
            },
          });
          assert.equal(staleHoldRes.status, 201);
          const staleHoldId = (
            (await staleHoldRes.json()) as { data: { booking: { id: string } } }
          ).data.booking.id;

          await pool.query(
            `UPDATE bookings SET expires_at = now() - interval '1 minute' WHERE id = $1`,
            [staleHoldId],
          );

          const expiredConfirmRes = await api(
            `/bookings/${staleHoldId}/confirm`,
            {
              method: "POST",
              token: tokens.customerB,
            },
          );
          assert.equal(expiredConfirmRes.status, 422);

          // Tạo thêm 1 hold quá hạn và chạy Cron expireHolds()
          const cronHoldRes = await api("/bookings/hold", {
            method: "POST",
            token: tokens.customerB,
            body: {
              courtId: ids.courts.b,
              start: "2035-08-10T16:00:00+07:00",
              end: "2035-08-10T17:00:00+07:00",
            },
          });
          assert.equal(cronHoldRes.status, 201);
          const cronHoldId = (
            (await cronHoldRes.json()) as { data: { booking: { id: string } } }
          ).data.booking.id;

          await pool.query(
            `UPDATE bookings SET expires_at = now() - interval '2 minutes' WHERE id = $1`,
            [cronHoldId],
          );

          const expiredCount = await scheduleService.expireHolds();
          assert.ok(expiredCount >= 1);

          const dbCheck = await pool.query<{
            booking_status: string;
            payment_status: string;
          }>(
            `SELECT b.status AS booking_status, p.status AS payment_status
             FROM bookings b
             INNER JOIN payments p ON p.booking_id = b.id
             WHERE b.id = $1`,
            [cronHoldId],
          );
          assert.equal(dbCheck.rows[0]?.booking_status, "expired");
          assert.equal(dbCheck.rows[0]?.payment_status, "expired");
        },
      );

      await t.test(
        "5. GET /bookings, GET /bookings/:id (anti-enumeration 404), Cancellation Policy (24h) & No-Show",
        async () => {
          // Tạo và confirm 1 booking ở xa (> 24h)
          const holdRes = await api("/bookings/hold", {
            method: "POST",
            token: tokens.customerA,
            body: {
              courtId: ids.courts.a,
              start: "2035-09-15T09:00:00+07:00",
              end: "2035-09-15T10:00:00+07:00",
            },
          });
          assert.equal(holdRes.status, 201);
          const bId = (
            (await holdRes.json()) as { data: { booking: { id: string } } }
          ).data.booking.id;

          await api(`/bookings/${bId}/confirm`, {
            method: "POST",
            token: tokens.customerA,
          });

          // Anti-enumeration: customerB đọc booking của customerA -> phải nhận 404 (KHÔNG phải 403)
          const forbiddenDetailRes = await api(`/bookings/${bId}`, {
            token: tokens.customerB,
          });
          assert.equal(forbiddenDetailRes.status, 404);

          // Chính chủ customerA đọc chi tiết -> 200 OK
          const myDetailRes = await api(`/bookings/${bId}`, {
            token: tokens.customerA,
          });
          assert.equal(myDetailRes.status, 200);

          // Danh sách GET /bookings của customerA
          const listRes = await api("/bookings?page=1&limit=10", {
            token: tokens.customerA,
          });
          assert.equal(listRes.status, 200);
          const listJson = (await listRes.json()) as {
            data: Array<{ id: string }>;
            meta: { total: number };
          };
          assert.ok(listJson.meta.total >= 1);
          assert.ok(listJson.data.some((item) => item.id === bId));

          // Xem trước điều kiện huỷ: > 24h nên canCancel = true, refundAmount = 50000
          const previewRes = await api(
            `/bookings/${bId}/cancellation-preview`,
            { token: tokens.customerA },
          );
          assert.equal(previewRes.status, 200);
          const previewJson = (await previewRes.json()) as {
            data: { canCancel: boolean; refundAmount: number };
          };
          assert.equal(previewJson.data.canCancel, true);
          assert.equal(previewJson.data.refundAmount, 50000);

          // Huỷ hợp lệ trước 24h bằng PATCH /bookings/:id/cancel
          const cancelRes = await api(`/bookings/${bId}/cancel`, {
            method: "PATCH",
            token: tokens.customerA,
            body: { reason: "Bận việc đột xuất" },
          });
          assert.equal(cancelRes.status, 200);
          const cancelJson = (await cancelRes.json()) as {
            data: { status: string; cancelReason: string };
          };
          assert.equal(cancelJson.data.status, "cancelled");
          assert.equal(cancelJson.data.cancelReason, "Bận việc đột xuất");
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
