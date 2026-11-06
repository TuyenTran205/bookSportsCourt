import "reflect-metadata";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readdir } from "node:fs/promises";
import { test } from "node:test";
import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { DATABASE, DatabaseService } from "../src/database/database.module.js";
import * as schema from "../src/database/schema/index.js";
import { GlobalExceptionFilter } from "../src/common/filters/global-exception.filter.js";
import { TransformResponseInterceptor } from "../src/common/interceptors/transform-response.interceptor.js";
import { AuthJwtService } from "../src/modules/auth/auth-jwt.service.js";
import { configureHttpSecurity } from "../src/config/http-security.js";
import { readVenueTestMigration } from "./fixtures/venue-test-db.js";
import {
  seedVenueFixtures,
  venueFixtureIds as ids,
} from "./fixtures/venues.fixture.js";

test("merged AppModule boots all modules with isolated PostgreSQL", async (t) => {
  const connectionString = process.env.VENUE_TEST_DATABASE_URL;
  assert.ok(
    connectionString,
    "Set VENUE_TEST_DATABASE_URL to local test PostgreSQL",
  );
  assert.ok(
    ["localhost", "127.0.0.1", "[::1]"].includes(
      new URL(connectionString).hostname,
    ),
  );
  const name = `bsc014_test_${randomBytes(6).toString("hex")}`;
  const admin = new Pool({ connectionString, connectionTimeoutMillis: 5000 });
  const pool = new Pool({
    connectionString,
    options: `-c search_path=${name},public -c statement_timeout=15000`,
    connectionTimeoutMillis: 5000,
  });
  const config = {
    DATABASE_URL: connectionString,
    JWT_ACCESS_SECRET: randomBytes(32).toString("hex"),
    JWT_REFRESH_SECRET: randomBytes(32).toString("hex"),
    ALLOWED_ORIGINS: "http://localhost:3000",
    NODE_ENV: "test",
  };
  const previous = Object.fromEntries(
    Object.keys(config).map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, config);
  await admin.query(`CREATE SCHEMA "${name}"`);
  try {
    for (const file of (
      await readdir(new URL("../src/database/migrations/", import.meta.url))
    )
      .filter((file) => file.endsWith(".sql"))
      .sort()) {
      await pool.query(await readVenueTestMigration(file));
    }
    const client = await pool.connect();
    try {
      await seedVenueFixtures(client, "$argon2id$test-fixture-not-for-login");
    } finally {
      client.release();
    }
    const { AppModule } = await import("../src/app.module.js");
    const module = await Test.createTestingModule({ imports: [AppModule] })
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
            ...(tokens[who] ? { Cookie: `access_token=${tokens[who]}` } : {}),
            ...(body !== undefined
              ? { "Content-Type": "application/json" }
              : {}),
          },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
          signal: AbortSignal.timeout(10000),
        });
      await t.test(
        "health, catalogs and static map route are registered",
        async () => {
          for (const path of [
            "/health",
            "/sports",
            "/amenities",
            "/areas",
            "/venues/map",
          ]) {
            const response = await request(path);
            assert.equal(response.status, 200, path);
            assert.ok(
              "data" in ((await response.json()) as Record<string, unknown>),
            );
          }
          const response = await request("/venues/map");
          const body = (await response.json()) as {
            data: { lat: number; lng: number; fromPrice: number | null }[];
          };
          assert.ok(body.data.length);
          assert.ok(
            body.data.every(
              (item) =>
                typeof item.lat === "number" && typeof item.lng === "number",
            ),
          );
        },
      );
      await t.test(
        "public search filters use valid SQL and never leak private Venue fields",
        async () => {
          const row = (
            await pool.query(
              "SELECT province_id, district_id FROM venues WHERE id=$1",
              [ids.venues.approvedA],
            )
          ).rows[0];
          const sport = (
            await pool.query(
              "SELECT sport_id FROM venue_sports WHERE venue_id=$1 LIMIT 1",
              [ids.venues.approvedA],
            )
          ).rows[0];
          const amenity = (
            await pool.query(
              "SELECT amenity_id FROM venue_amenities WHERE venue_id=$1 LIMIT 1",
              [ids.venues.approvedA],
            )
          ).rows[0];
          const query = new URLSearchParams({
            provinceId: row.province_id,
            districtId: row.district_id,
            ...(sport ? { sportId: sport.sport_id } : {}),
            ...(amenity ? { amenityIds: amenity.amenity_id } : {}),
          });
          const response = await request(`/venues?${query}`);
          assert.equal(response.status, 200);
          const body = (await response.json()) as {
            data: Record<string, unknown>[];
            meta: { total: number };
          };
          assert.ok(body.data.some((item) => item.id === ids.venues.approvedA));
          for (const item of body.data) {
            assert.equal(item.status, "approved");
            for (const field of [
              "ownerId",
              "rejectionReason",
              "deletedAt",
              "createdAt",
              "updatedAt",
            ])
              assert.equal(field in item, false);
            assert.equal(typeof item.ratingAvg, "number");
          }
          const empty = await request("/venues?q=absent-merge-test");
          assert.deepEqual(((await empty.json()) as { meta: unknown }).meta, {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0,
          });
          for (const query of [
            "sportId=invalid",
            "page=1&page=2",
            "minRating=nope",
          ])
            assert.equal((await request(`/venues?${query}`)).status, 400);
        },
      );
      await t.test(
        "owner settings keep null contract and image changes require moderation",
        async () => {
          const path = `/owner/venues/${ids.venues.approvedA}/payment-account`;
          assert.equal((await request(path)).status, 401);
          assert.equal((await request(path, "admin")).status, 403);
          assert.equal((await request(path, "ownerB")).status, 403);
          const empty = await request(path, "ownerA");
          assert.deepEqual(await empty.json(), { data: null });
          const account = {
            bankBin: "970436",
            accountNo: "0123456789",
            accountName: "TEST OWNER",
          };
          const saved = await request(path, "ownerA", "PUT", account);
          assert.equal(saved.status, 200);
          assert.deepEqual(await saved.json(), { data: account });
          const images = `/venues/${ids.venues.approvedA}/images`;
          assert.equal(
            (
              await request(images, "ownerB", "POST", {
                url: "https://example.com/test.webp",
              })
            ).status,
            403,
          );
          const added = await request(images, "ownerA", "POST", {
            url: "https://example.com/test.webp",
          });
          assert.equal(added.status, 201);
          const image = ((await added.json()) as { data: { id: string } }).data;
          const venue = (
            await pool.query(
              "SELECT status,cover_url FROM venues WHERE id=$1",
              [ids.venues.approvedA],
            )
          ).rows[0];
          assert.equal(venue.status, "pending");
          assert.equal(venue.cover_url, "https://example.com/test.webp");
          assert.equal(
            (await request(`/venues/${ids.venues.approvedA}`)).status,
            404,
          );
          assert.equal(
            (
              await request(images + "/order", "ownerA", "PATCH", {
                imageIds: [ids.missing],
              })
            ).status,
            400,
          );
          assert.equal(
            (await request(`${images}/${image.id}`, "ownerA", "DELETE")).status,
            204,
          );
          assert.equal(
            (
              await pool.query("SELECT cover_url FROM venues WHERE id=$1", [
                ids.venues.approvedA,
              ])
            ).rows[0].cover_url,
            null,
          );
        },
      );
      await t.test(
        "Court module resolves exported Venue repository and Owner application routes coexist",
        async () => {
          assert.equal(
            (
              await request(
                `/venues/${ids.venues.pendingA}/courts`,
                "ownerA",
                "POST",
                { name: "Merge Test Court" },
              )
            ).status,
            201,
          );
          assert.equal(
            (await request("/admin/owner-applications", "admin")).status,
            200,
          );
          assert.equal(
            (
              await request("/owner-applications", "customer", "POST", {
                businessName: "Merge Test Owner",
                phone: "0901234567",
                address: "123 Test Street",
              })
            ).status,
            201,
          );
          assert.equal(
            (await request("/owner-applications/me", "customer")).status,
            200,
          );
        },
      );
      await t.test(
        "profile PATCH does not erase omitted optional fields or change role",
        async () => {
          await pool.query(
            "UPDATE users SET phone='0901234567',avatar_url='https://example.com/avatar.webp' WHERE id=$1",
            [ids.users.customer],
          );
          const response = await request("/users/me", "customer", "PATCH", {
            fullName: "Merge Test Customer",
            role: "admin",
          });
          assert.equal(response.status, 200);
          const user = (
            await pool.query(
              "SELECT role,phone,avatar_url FROM users WHERE id=$1",
              [ids.users.customer],
            )
          ).rows[0];
          assert.equal(user.role, "customer");
          assert.equal(user.phone, "0901234567");
          assert.equal(user.avatar_url, "https://example.com/avatar.webp");
        },
      );
      await t.test(
        "Swagger has unique handlers for overlapping branch routes",
        () => {
          const document = SwaggerModule.createDocument(
            app,
            new DocumentBuilder().build(),
          );
          assert.equal(
            document.paths["/api/v1/venues/{slug}"]?.get?.operationId,
            "PublicVenuesController_detail",
          );
          assert.equal(
            document.paths["/api/v1/venues/{id}/status"]?.patch?.operationId,
            "VenuesModerationController_status",
          );
          assert.ok(document.paths["/api/v1/venues/map"]?.get);
          assert.ok(document.paths["/api/v1/courts/{id}/pricing-rules"]?.post);
        },
      );
    } finally {
      await app.close();
    }
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${name}" CASCADE`);
    await admin.end();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
