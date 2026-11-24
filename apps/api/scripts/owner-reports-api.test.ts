import "reflect-metadata";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readdir } from "node:fs/promises";
import { test } from "node:test";
import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
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

test("Owner revenue & occupancy reports HTTP (OWN-11, OWN-12) against PostgreSQL", async (t) => {
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
      const request = (path: string, who = "guest") =>
        fetch(base + path, {
          headers: {
            "X-Request-Origin": "http://localhost:3000",
            ...(tokens[who] ? { Cookie: `access_token=${tokens[who]}` } : {}),
          },
          signal: AbortSignal.timeout(10000),
        });

      await t.test("RBAC and foreign venue isolation", async () => {
        assert.equal((await request("/owner/reports/revenue")).status, 401);
        assert.equal((await request("/owner/reports/revenue", "customerA")).status, 403);
        assert.equal((await request("/owner/reports/occupancy", "customerA")).status, 403);
        assert.equal(
          (await request(`/owner/reports/revenue?venueId=${ids.venues.a}`, "ownerB")).status,
          403,
        );
        assert.equal(
          (await request(`/owner/reports/occupancy?venueId=${ids.venues.a}`, "ownerB")).status,
          403,
        );
      });

      await t.test("Revenue report aggregates confirmed+completed bookings in date range", async () => {
        // Seeded completed bookings on Venue A are in 2035-01-03, 2035-01-08, 2035-01-09, 2035-02-02..04 (100k each)
        const res = await request(
          `/owner/reports/revenue?from=2035-01-01&to=2035-01-10&venueId=${ids.venues.a}`,
          "ownerA",
        );
        assert.equal(res.status, 200);
        assert.equal(res.headers.get("cache-control"), "no-store");
        const { data } = (await res.json()) as {
          data: {
            summary: { totalRevenue: number; totalBookings: number; from: string; to: string };
            series: Array<{ date: string; revenue: number; bookings: number }>;
          };
        };
        assert.equal(data.summary.totalBookings, 3);
        assert.equal(data.summary.totalRevenue, 300000);
        assert.equal(data.series.length, 10);

        // Court filter on another court returns 0 for Venue A
        const emptyCourtRes = await request(
          `/owner/reports/revenue?from=2035-01-01&to=2035-01-10&venueId=${ids.venues.a}&courtId=${ids.courts.b}`,
          "ownerA",
        );
        assert.equal(emptyCourtRes.status, 200);
        const emptyData = (await emptyCourtRes.json()) as {
          data: { summary: { totalRevenue: number; totalBookings: number } };
        };
        assert.equal(emptyData.data.summary.totalBookings, 0);
        assert.equal(emptyData.data.summary.totalRevenue, 0);

        // Admin can query across venues
        const adminRes = await request(
          `/owner/reports/revenue?from=2035-02-01&to=2035-02-05&venueId=${ids.venues.b}`,
          "adminA",
        );
        assert.equal(adminRes.status, 200);
        const adminData = (await adminRes.json()) as {
          data: { summary: { totalBookings: number; totalRevenue: number } };
        };
        assert.equal(adminData.data.summary.totalBookings, 1);
        assert.equal(adminData.data.summary.totalRevenue, 100000);
      });

      await t.test("Occupancy report computes bounded rate, bookedSlots and peakHours", async () => {
        const res = await request(
          `/owner/reports/occupancy?from=2035-01-01&to=2035-01-10&venueId=${ids.venues.a}`,
          "ownerA",
        );
        assert.equal(res.status, 200);
        const { data } = (await res.json()) as {
          data: {
            summary: {
              occupancyRate: number;
              bookedSlots: number;
              availableSlots: number;
              peakHours: Array<{ startTime: string; endTime: string; bookedSlots: number }>;
            };
            series: Array<{ date: string; occupancyRate: number; bookedSlots: number }>;
          };
        };
        assert.ok(data.summary.bookedSlots > 0);
        assert.ok(data.summary.occupancyRate >= 0 && data.summary.occupancyRate <= 1);
        assert.equal(data.series.length, 10);
        assert.ok(data.summary.peakHours.length >= 1);
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
