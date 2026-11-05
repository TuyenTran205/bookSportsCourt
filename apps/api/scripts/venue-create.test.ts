import "reflect-metadata";
import { runVenueReadCases } from "./fixtures/venue-read-cases.js";
import { runVenueMutationCases } from "./fixtures/venue-mutation-cases.js";
import { runVenueModerationCases } from "./fixtures/venue-moderation-cases.js";
import { runVenueAcceptanceCases } from "./fixtures/venue-acceptance-cases.js";
import type {
  OwnerVenueResponse,
  ApiErrorBody,
} from "../../../packages/shared/src/types.js";
const responseBody = (response: Response) =>
  response.json() as Promise<{ data: OwnerVenueResponse } & ApiErrorBody>;
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes } from "node:crypto";
import { readdir } from "node:fs/promises";
import { Pool } from "pg";
import { ConfigModule } from "@nestjs/config";
import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { drizzle } from "drizzle-orm/node-postgres";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { DATABASE, DatabaseModule } from "../src/database/database.module.js";
import * as schema from "../src/database/schema/index.js";
import { VenuesModule } from "../src/modules/venues/venues.module.js";
import { AuthJwtService } from "../src/modules/auth/auth-jwt.service.js";
import { AuthService } from "../src/modules/auth/auth.service.js";
import { VenuesService } from "../src/modules/venues/venues.service.js";
import { venueSlug } from "../src/modules/venues/venue-slug.js";
import { GlobalExceptionFilter } from "../src/common/filters/global-exception.filter.js";
import { TransformResponseInterceptor } from "../src/common/interceptors/transform-response.interceptor.js";
import { configureHttpSecurity } from "../src/config/http-security.js";
import { readVenueTestMigration } from "./fixtures/venue-test-db.js";
import {
  seedVenueFixtures,
  venueFixtureIds as ids,
  venueCreatePayload,
  venueInvalidPayloads,
} from "./fixtures/venues.fixture.js";

test("slug normalizes Vietnamese, fallback and length", () => {
  assert.equal(
    venueSlug("  Sân Đẹp!  ", ids.missing),
    `san-dep-${ids.missing}`,
  );
  assert.equal(venueSlug("東京", ids.missing), `venue-${ids.missing}`);
  assert.equal(venueSlug("a".repeat(200), ids.missing).length, 117);
});

test("create and read Venue against isolated PostgreSQL", async (t) => {
  const connectionString = process.env.VENUE_TEST_DATABASE_URL;
  assert.ok(
    connectionString,
    "Set VENUE_TEST_DATABASE_URL to local PostgreSQL",
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
  await admin.query(`CREATE SCHEMA "${name}"`);
  try {
    for (const filename of (
      await readdir(new URL("../src/database/migrations/", import.meta.url))
    )
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      await pool.query(await readVenueTestMigration(filename));
    }
    const client = await pool.connect();
    try {
      await seedVenueFixtures(client, "$argon2id$test-fixture-not-for-login");
    } finally {
      client.release();
    }
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              DATABASE_URL: connectionString,
              NODE_ENV: "test",
              ALLOWED_ORIGINS: "http://localhost:3000",
              JWT_ACCESS_SECRET: randomBytes(32).toString("hex"),
              JWT_REFRESH_SECRET: randomBytes(32).toString("hex"),
            }),
          ],
        }),
        DatabaseModule,
        VenuesModule,
      ],
    })
      .overrideProvider(DATABASE)
      .useValue(drizzle(pool, { schema }))
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
      const base = await app.getUrl();
      await runVenueReadCases(t, app, pool);
      const tokens = Object.fromEntries(
        await Promise.all(
          Object.entries(ids.users).map(async ([key, id]) => [
            key,
            await app.get(AuthJwtService).sign(id, "access", false),
          ]),
        ),
      );
      const request = (body: unknown, who: string = "ownerA") =>
        fetch(`${base}/api/v1/venues`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(tokens[who] ? { Cookie: `access_token=${tokens[who]}` } : {}),
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(20000),
        });
      const counts = async () =>
        (
          await pool.query(
            "SELECT (SELECT count(*)::int FROM venues) AS venues, (SELECT count(*)::int FROM venue_sports) AS sports, (SELECT count(*)::int FROM venue_amenities) AS amenities",
          )
        ).rows[0];

      await t.test(
        "real auth denies anonymous, Customer, Admin and suspended Owner",
        async () => {
          const before = await counts();
          for (const [who, status] of [
            ["anonymous", 401],
            ["customer", 403],
            ["admin", 403],
            ["suspendedOwner", 403],
          ] as const) {
            const response = await request(venueCreatePayload(), who);
            assert.equal(response.status, status);
            assert.ok((await responseBody(response)).error.code);
          }
          assert.deepEqual(await counts(), before);
        },
      );
      await t.test(
        "strict input and reference validation leave no rows",
        async () => {
          const before = await counts();
          for (const body of [
            ...Object.values(venueInvalidPayloads()),
            { ...venueCreatePayload(), name: "  " },
            { ...venueCreatePayload(), ownerId: ids.users.ownerB },
            { ...venueCreatePayload(), status: "approved" },
            { ...venueCreatePayload(), provinceId: ids.missing },
          ]) {
            const response = await request(body);
            assert.equal(response.status, 400);
            assert.equal(
              (await responseBody(response)).error.code,
              "VALIDATION_ERROR",
            );
          }
          assert.deepEqual(await counts(), before);
        },
      );
      await t.test(
        "201 projects pending owner venue, normalizes numbers and deduplicates links",
        async () => {
          const body = venueCreatePayload();
          const response = await request({
            ...body,
            name: "  Sân Đẹp  ",
            lat: 10.123456789,
            sportIds: [...body.sportIds, ...body.sportIds],
          });
          assert.equal(response.status, 201);
          const { data } = await responseBody(response);
          assert.equal(data.ownerId, ids.users.ownerA);
          assert.equal(data.status, "pending");
          assert.equal(data.rejectionReason, null);
          assert.equal(data.description, null);
          assert.equal(data.name, "Sân Đẹp");
          assert.equal(data.lat, 10.1234568);
          assert.match(
            data.id,
            /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
          );
          assert.equal(data.slug, `san-dep-${data.id}`);
          assert.equal("deletedAt" in data, false);
          assert.equal("fromPrice" in data, false);
          assert.deepEqual(data.sportIds, body.sportIds);
          assert.equal(
            (
              await pool.query("SELECT * FROM venue_sports WHERE venue_id=$1", [
                data.id,
              ])
            ).rowCount,
            1,
          );
          assert.equal(
            (
              await pool.query(
                "SELECT * FROM venue_amenities WHERE venue_id=$1",
                [data.id],
              )
            ).rowCount,
            1,
          );
          const empty = await request(
            { ...body, sportIds: [], amenityIds: [] },
            "ownerB",
          );
          assert.equal(empty.status, 201);
          assert.equal(
            (await responseBody(empty)).data.ownerId,
            ids.users.ownerB,
          );
        },
      );
      await t.test(
        "link failure rolls back venue and earlier links; SQL stays private",
        async () => {
          const before = await counts();
          await pool.query(
            "CREATE FUNCTION fail_link() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private SQL diagnostic' USING ERRCODE='23503'; END $$; CREATE TRIGGER fail_link BEFORE INSERT ON venue_amenities FOR EACH ROW EXECUTE FUNCTION fail_link()",
          );
          try {
            const response = await request(venueCreatePayload());
            assert.equal(response.status, 400);
            const body = await responseBody(response);
            assert.equal(body.error.code, "VALIDATION_ERROR");
            assert.ok(!JSON.stringify(body).includes("private SQL"));
            assert.deepEqual(await counts(), before);
          } finally {
            await pool.query(
              "DROP TRIGGER fail_link ON venue_amenities; DROP FUNCTION fail_link()",
            );
          }
        },
      );
      await t.test(
        "unique slug conflict maps to 409 and rolls back",
        async () => {
          const before = await counts();
          await pool.query(
            "CREATE FUNCTION collide_slug() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.slug := (SELECT slug FROM venues LIMIT 1); RETURN NEW; END $$; CREATE TRIGGER collide_slug BEFORE INSERT ON venues FOR EACH ROW EXECUTE FUNCTION collide_slug()",
          );
          try {
            const response = await request(venueCreatePayload());
            assert.equal(response.status, 409);
            assert.equal(
              (await responseBody(response)).error.code,
              "ALREADY_EXISTS",
            );
            assert.deepEqual(await counts(), before);
          } finally {
            await pool.query(
              "DROP TRIGGER collide_slug ON venues; DROP FUNCTION collide_slug()",
            );
          }
        },
      );
      await t.test(
        "concurrent same-name requests create distinct slugs and complete links",
        async () => {
          const before = await counts();
          const responses = await Promise.all(
            Array.from({ length: 4 }, () => request(venueCreatePayload())),
          );
          assert.ok(responses.every((r) => r.status === 201));
          const bodies = await Promise.all(responses.map(responseBody));
          assert.equal(new Set(bodies.map((b) => b.data.slug)).size, 4);
          const after = await counts();
          for (const key of ["venues", "sports", "amenities"])
            assert.equal(after[key], before[key] + 4);
        },
      );
      await t.test(
        "transaction rechecks role after a concurrent role update",
        async () => {
          const before = await counts();
          const blocker = await pool.connect();
          const auth = app.get(AuthService);
          const original = auth.requireActiveUser.bind(auth);
          let reached!: () => void;
          const entered = new Promise<void>((resolve) => {
            reached = resolve;
          });
          auth.requireActiveUser = (...args) => {
            if (args[1]) reached();
            return original(...args);
          };
          try {
            await blocker.query("BEGIN");
            await blocker.query(
              "UPDATE users SET role='customer' WHERE id=$1",
              [ids.users.ownerA],
            );
            const pending = request(venueCreatePayload());
            await Promise.race([
              entered,
              new Promise<never>((_, reject) => {
                const timer = setTimeout(
                  () => reject(new Error("Transaction was not reached")),
                  10000,
                );
                timer.unref();
              }),
            ]);
            await blocker.query("COMMIT");
            assert.equal((await pending).status, 403);
            assert.deepEqual(await counts(), before);
          } finally {
            auth.requireActiveUser = original;
            await blocker.query("ROLLBACK");
            await blocker.query("UPDATE users SET role='owner' WHERE id=$1", [
              ids.users.ownerA,
            ]);
            blocker.release();
          }
        },
      );
      await t.test("Swagger exposes protected CRUD together with incoming public search/map", () => {
        const doc = SwaggerModule.createDocument(
          app,
          new DocumentBuilder().build(),
        );
        assert.ok(doc.paths["/api/v1/venues"]?.post?.responses["201"]);
        assert.ok(doc.paths["/api/v1/venues"]?.get);
        assert.ok(doc.paths["/api/v1/venues/map"]?.get);
        assert.ok(doc.paths["/api/v1/venues/{id}"]?.patch?.responses["200"]);
        assert.deepEqual(
          doc.paths["/api/v1/venues/{id}"]?.delete?.responses["204"],
          { description: "Deleted; no body" },
        );
      });
      // Service is actually resolved by Nest, not a test replacement.
      await runVenueMutationCases(t, app, pool);
      await runVenueModerationCases(t, app, pool);
      await runVenueAcceptanceCases(t, app, pool);
      assert.ok(app.get(VenuesService));
    } finally {
      await app.close();
    }
  } finally {
    await pool.end();
    try {
      await admin.query(`DROP SCHEMA "${name}" CASCADE`);
    } finally {
      await admin.end();
    }
  }
});
