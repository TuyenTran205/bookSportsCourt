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
import { MemoryProofStorage } from "./fixtures/payment-cases.js";
import {
  phase4FixtureIds as ids,
  seedPhase4Fixtures,
} from "./fixtures/phase4.fixture.js";
import { readVenueTestMigration } from "./fixtures/venue-test-db.js";

test("Notifications HTTP endpoints (CUS-14 / OWN-14) enforce user isolation and read states against PostgreSQL", async (t) => {
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

    const nCustUnread1 = v7();
    const nCustUnread2 = v7();
    const nCustRead = v7();
    const nOwnerUnread = v7();

    const client = await pool.connect();
    try {
      await seedPhase4Fixtures(client, "$argon2id$test-fixture-not-for-login");
      await client.query(
        `INSERT INTO notifications (id, user_id, type, title, body, data, read_at) VALUES
         ($1, $5, 'booking_confirmed', 'Đơn đã xác nhận', 'Lịch 08:00 đã được duyệt', '{"bookingId":"b1"}'::jsonb, NULL),
         ($2, $5, 'booking_reminder', 'Sắp đến giờ chơi', 'Còn 2 giờ nữa đến lịch', '{"bookingId":"b2"}'::jsonb, NULL),
         ($3, $5, 'booking_cancelled', 'Đơn đã huỷ', 'Đơn cũ đã huỷ', NULL, now()),
         ($4, $6, 'payment_submitted', 'Có minh chứng mới', 'Khách đã tải ảnh chuyển khoản', '{"bookingId":"b3"}'::jsonb, NULL)`,
        [nCustUnread1, nCustUnread2, nCustRead, nOwnerUnread, ids.users.customerA, ids.users.ownerA],
      );
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
      const request = (path: string, who = "guest", method = "GET") =>
        fetch(base + path, {
          method,
          headers: {
            "X-Request-Origin": "http://localhost:3000",
            ...(tokens[who] ? { Cookie: `access_token=${tokens[who]}` } : {}),
          },
          signal: AbortSignal.timeout(10000),
        });

      await t.test("Auth required, list filters and user isolation", async () => {
        assert.equal((await request("/notifications")).status, 401);
        assert.equal((await request("/notifications/unread-count")).status, 401);

        const allCust = (await (await request("/notifications", "customerA")).json()) as {
          data: Array<{ id: string; type: string; payload: Record<string, unknown> | null }>;
          meta: { total: number };
        };
        assert.equal(allCust.meta.total, 3);
        assert.ok(!allCust.data.some((n) => n.id === nOwnerUnread));

        const unreadCust = (await (
          await request("/notifications?unreadOnly=true", "customerA")
        ).json()) as { data: Array<{ id: string }>; meta: { total: number } };
        assert.equal(unreadCust.meta.total, 2);

        const typedCust = (await (
          await request("/notifications?type=booking_reminder", "customerA")
        ).json()) as { data: Array<{ id: string }>; meta: { total: number } };
        assert.equal(typedCust.meta.total, 1);
        assert.equal(typedCust.data[0]?.id, nCustUnread2);

        const countRes = (await (
          await request("/notifications/unread-count", "customerA")
        ).json()) as { data: { count: number } };
        assert.equal(countRes.data.count, 2);
      });

      await t.test("PATCH :id/read & POST /read-all only mutate caller notifications", async () => {
        // CustomerB cannot mark CustomerA's notification read
        assert.equal(
          (await request(`/notifications/${nCustUnread1}/read`, "customerB", "PATCH")).status,
          404,
        );

        // CustomerA marks one read
        const markOne = await request(`/notifications/${nCustUnread1}/read`, "customerA", "PATCH");
        assert.equal(markOne.status, 200);
        const markOneBody = (await markOne.json()) as { data: { readAt: string | null } };
        assert.ok(markOneBody.data.readAt);

        const afterOne = (await (
          await request("/notifications/unread-count", "customerA")
        ).json()) as { data: { count: number } };
        assert.equal(afterOne.data.count, 1);

        // CustomerA marks all remaining read
        const markAll = await request("/notifications/read-all", "customerA", "POST");
        assert.equal(markAll.status, 200);
        const markAllBody = (await markAll.json()) as { data: { updated: number } };
        assert.equal(markAllBody.data.updated, 1);

        // OwnerA's unread notification stays untouched
        const ownerUnread = (await (
          await request("/notifications/unread-count", "ownerA")
        ).json()) as { data: { count: number } };
        assert.equal(ownerUnread.data.count, 1);
      });
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
