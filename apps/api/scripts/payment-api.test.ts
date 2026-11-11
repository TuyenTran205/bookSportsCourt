import "reflect-metadata";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readdir } from "node:fs/promises";
import { test } from "node:test";
import {
  runPaymentCases,
  MemoryProofStorage,
} from "./fixtures/payment-cases.js";
import { ProofStorage } from "../src/modules/uploads/proof-storage.js";
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
  seedPhase4Fixtures,
  phase4FixtureIds as ids,
} from "./fixtures/phase4.fixture.js";

test("Payment read and private proof HTTP against PostgreSQL", async (t) => {
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
      await seedPhase4Fixtures(client, "$argon2id$test-fixture-not-for-login");
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
      await runPaymentCases(t, app, pool, request, storage);
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
