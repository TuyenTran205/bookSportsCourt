import "reflect-metadata";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readdir } from "node:fs/promises";
import { test } from "node:test";
import { ValidationPipe } from "@nestjs/common";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { Test } from "@nestjs/testing";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { io as createSocketClient, type Socket } from "socket.io-client";
import { v7 } from "uuid";
import { SOCKET_EVENTS } from "../../../packages/shared/src/constants.js";
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

function waitForSocketEvent<T = unknown>(
  socket: Socket,
  event: string,
  timeoutMs = 5000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for socket event "${event}"`));
    }, timeoutMs);
    const handler = (payload: T) => {
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
  });
}

function connectSocket(
  url: string,
  auth: Record<string, unknown>,
  extraHeaders?: Record<string, string>,
): Promise<Socket> {
  return new Promise<Socket>((resolve, reject) => {
    const socket = createSocketClient(url, {
      auth,
      extraHeaders,
      transports: ["websocket"],
      reconnection: false,
      timeout: 5000,
    });
    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error("Timed out connecting Socket.IO client"));
    }, 5000);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once("connect_error", (err) => {
      clearTimeout(timer);
      socket.disconnect();
      reject(err);
    });
  });
}

test("Realtime Socket.IO cross-client flow, ws-token auth & DB-free /health/ping", async (t) => {
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
    max: 15,
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

  let dbQueriesOnPingTest = 0;
  let countingDbCalls = false;

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
      for (let day = 0; day <= 6; day++) {
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
        query: (text: string, values?: unknown[]) => {
          if (countingDbCalls) dbQueriesOnPingTest++;
          return pool.query(text, values);
        },
      })
      .compile();

    const app = module.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useWebSocketAdapter(new IoAdapter(app));
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

    let ownerSocket: Socket | null = null;
    let guestSocket: Socket | null = null;

    try {
      await app.listen(0, "127.0.0.1");
      const baseOrigin = await app.getUrl();
      const apiBase = `${baseOrigin}/api/v1`;
      const wsBase = `${baseOrigin}/ws`;

      // 1. /health/ping must NOT execute any PostgreSQL queries
      countingDbCalls = true;
      const pingRes = await fetch(`${apiBase}/health/ping`);
      countingDbCalls = false;
      assert.equal(pingRes.status, 200);
      const pingBody = (await pingRes.json()) as {
        data: { status: string; timestamp: string };
      };
      assert.equal(pingBody.data.status, "ok");
      assert.ok(typeof pingBody.data.timestamp === "string");
      assert.equal(dbQueriesOnPingTest, 0);

      // 2. POST /auth/ws-token requires valid access_token cookie
      const unauthWsRes = await fetch(`${apiBase}/auth/ws-token`, {
        method: "POST",
        headers: { "X-Request-Origin": "http://localhost:3000" },
      });
      assert.equal(unauthWsRes.status, 401);

      const jwt = app.get(AuthJwtService);
      const customerAccess = await jwt.sign(ids.users.customerA, "access", false);
      const ownerAccess = await jwt.sign(ids.users.ownerA, "access", false);

      const ownerWsRes = await fetch(`${apiBase}/auth/ws-token`, {
        method: "POST",
        headers: {
          "X-Request-Origin": "http://localhost:3000",
          Cookie: `access_token=${ownerAccess}`,
        },
      });
      assert.equal(ownerWsRes.status, 200);
      const ownerWsJson = (await ownerWsRes.json()) as {
        data: { token: string; expiresInSeconds: number };
      };
      assert.equal(ownerWsJson.data.expiresInSeconds, 900);
      assert.ok(ownerWsJson.data.token.length > 20);

      // 3. Socket auth enforcement: bare & bad-origin sockets fail; owner ws-token & guest succeed
      await assert.rejects(() =>
        connectSocket(wsBase, {}, { Origin: "http://localhost:3000" }),
      );
      await assert.rejects(() =>
        connectSocket(
          wsBase,
          { guest: true },
          { Origin: "https://evil.example.test" },
        ),
      );

      ownerSocket = await connectSocket(
        wsBase,
        { token: ownerWsJson.data.token },
        { Origin: "http://localhost:3000" },
      );
      guestSocket = await connectSocket(
        wsBase,
        { guest: true },
        { Origin: "http://localhost:3000" },
      );

      let guestReceivedPrivate = false;
      guestSocket.on(SOCKET_EVENTS.BOOKING_CREATED, () => {
        guestReceivedPrivate = true;
      });

      // Compute date 2 days ahead in +07:00 VN timezone
      const future = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const vnDate = new Date(future.getTime() + 7 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

      const joinAck = await new Promise<{ ok: boolean; room?: string }>(
        (resolve) => {
          guestSocket!.emit(
            SOCKET_EVENTS.JOIN_VENUE,
            { venueId: ids.venues.a, date: vnDate },
            resolve,
          );
        },
      );
      assert.equal(joinAck.ok, true);

      // 4. Customer creates a hold -> Owner receives booking_created, Guest receives slot_updated (without leaking booking_created)
      const ownerCreatedPromise = waitForSocketEvent<{
        bookingId: string;
        venueId: string;
        courtId: string;
      }>(ownerSocket, SOCKET_EVENTS.BOOKING_CREATED);
      const guestSlotPromise = waitForSocketEvent<{
        venueId: string;
        courtId: string;
        date: string;
        slots: Array<{ start: string; status: string }>;
      }>(guestSocket, SOCKET_EVENTS.SLOT_UPDATED);

      const slotStartIso = `${vnDate}T10:00:00+07:00`;
      const slotEndIso = `${vnDate}T11:00:00+07:00`;

      const holdRes = await fetch(`${apiBase}/bookings/hold`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Request-Origin": "http://localhost:3000",
          Cookie: `access_token=${customerAccess}`,
        },
        body: JSON.stringify({
          courtId: ids.courts.a,
          start: slotStartIso,
          end: slotEndIso,
          idempotencyKey: "rt-test-hold-1",
        }),
      });
      assert.equal(holdRes.status, 201);
      const holdJson = (await holdRes.json()) as {
        data: { booking: { id: string } };
      };
      const holdId = holdJson.data.booking.id;
      assert.ok(holdId, "hold response must include booking.id");

      const [ownerCreated, guestSlotUpdated] = await Promise.all([
        ownerCreatedPromise,
        guestSlotPromise,
      ]);
      assert.equal(ownerCreated.bookingId, holdId);
      assert.equal(ownerCreated.venueId, ids.venues.a);
      assert.equal(guestSlotUpdated.venueId, ids.venues.a);
      assert.equal(guestSlotUpdated.date, vnDate);
      assert.ok(guestSlotUpdated.slots.length > 0);
      assert.equal(guestReceivedPrivate, false);

      // 5. Customer releases the hold -> Owner gets booking_cancelled & Guest gets fresh slot_updated
      const ownerCancelledPromise = waitForSocketEvent<{
        bookingId: string;
        reason: string;
      }>(ownerSocket, SOCKET_EVENTS.BOOKING_CANCELLED);
      const guestSlotReleasePromise = waitForSocketEvent<{
        venueId: string;
        courtId: string;
        date: string;
        slots: Array<{ start: string; status: string }>;
      }>(guestSocket, SOCKET_EVENTS.SLOT_UPDATED);

      const releaseRes = await fetch(
        `${apiBase}/bookings/holds/${holdId}`,
        {
          method: "DELETE",
          headers: {
            "X-Request-Origin": "http://localhost:3000",
            Cookie: `access_token=${customerAccess}`,
          },
        },
      );
      assert.equal(releaseRes.status, 204);

      const [ownerCancelled, guestReleasedSlots] = await Promise.all([
        ownerCancelledPromise,
        guestSlotReleasePromise,
      ]);
      assert.equal(ownerCancelled.bookingId, holdId);
      assert.equal(guestReleasedSlots.venueId, ids.venues.a);
    } finally {
      ownerSocket?.disconnect();
      guestSocket?.disconnect();
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
