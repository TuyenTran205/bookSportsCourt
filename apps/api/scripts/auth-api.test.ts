import "reflect-metadata";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { Pool } from "pg";
import { DATABASE, DatabaseModule } from "../src/database/database.module.js";
import * as schema from "../src/database/schema/index.js";
import { AuthModule } from "../src/modules/auth/auth.module.js";
import { AuthMailService } from "../src/modules/auth/auth-mail.service.js";
import { AuthService } from "../src/modules/auth/auth.service.js";
import { AuthJwtService } from "../src/modules/auth/auth-jwt.service.js";
import {
  AuthCookies,
  AuthRequestGuard,
} from "../src/modules/auth/auth-http.js";
import { hashToken } from "../src/modules/auth/auth-secrets.js";
import { GlobalExceptionFilter } from "../src/common/filters/global-exception.filter.js";
import { TransformResponseInterceptor } from "../src/common/interceptors/transform-response.interceptor.js";
import { ConfigService } from "@nestjs/config";
import type { ExecutionContext } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { SignJWT } from "jose";
import { configureHttpSecurity } from "../src/config/http-security.js";
import {
  Controller,
  Module,
  Get,
  Param,
  UseGuards,
  UnauthorizedException,
  ForbiddenException,
  HttpException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AuthenticatedRequest } from "../src/common/guards/jwt-auth.guard.js";
import { JwtAuthGuard } from "../src/common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../src/common/guards/roles.guard.js";
import { OwnershipGuard } from "../src/common/guards/ownership.guard.js";
import { Roles } from "../src/common/decorators/roles.decorator.js";
import { CurrentUser } from "../src/common/decorators/current-user.decorator.js";
import { CheckOwnership } from "../src/common/decorators/check-ownership.decorator.js";
import { OwnershipService } from "../src/modules/auth/ownership.service.js";
import type { AuthenticatedUser } from "../../../packages/shared/src/types.js";

// Test-only routes exercise real Nest metadata, DI, guard order and decorators.
@Controller("guard-test")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("owner")
class GuardTestController {
  @Get("role") role(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Get("customer")
  @Roles("customer")
  customer(@CurrentUser() user: AuthenticatedUser) {
    return { id: user.id };
  }

  @Get("admin")
  @Roles("admin")
  admin() {
    return { allowed: true };
  }

  @Get("venues/:id")
  @UseGuards(OwnershipGuard)
  @CheckOwnership("venue")
  venue(@Param("id") id: string) {
    return { id };
  }

  @Get("courts/:courtId")
  @UseGuards(OwnershipGuard)
  @CheckOwnership("court", "courtId")
  court(@Param("courtId") id: string) {
    return { id };
  }

  @Get("managed/:id")
  @Roles("owner", "admin")
  @UseGuards(OwnershipGuard)
  @CheckOwnership("venue", "id", { allowAdmin: true })
  managed() {
    return { allowed: true };
  }

  @Get("no-bypass/:id")
  @Roles("owner", "admin")
  @UseGuards(OwnershipGuard)
  @CheckOwnership("venue")
  noBypass() {
    return { allowed: true };
  }

  @Get("missing-policy/:id")
  @UseGuards(OwnershipGuard)
  missingPolicy() {
    return { allowed: true };
  }

  @Get("wrong-param/:id")
  @UseGuards(OwnershipGuard)
  @CheckOwnership("court", "courtId")
  wrongParam() {
    throw new Error("Ownership must reject a missing route parameter");
  }

  @Get("empty-roles/:id")
  @Roles()
  @UseGuards(OwnershipGuard)
  @CheckOwnership("venue")
  emptyRoles() {
    throw new Error("Empty roles must deny access");
  }
}

// No class or method role metadata: ownership must fail closed on its own.
@Controller("ownership-config-test")
@UseGuards(JwtAuthGuard, OwnershipGuard)
class OwnershipConfigTestController {
  @Get("missing-roles/:id")
  @CheckOwnership("venue")
  missingRoles() {
    throw new Error("Ownership must reject missing role metadata");
  }
}

// Model a business module consuming AuthModule exports without redeclaring providers.
@Module({
  imports: [AuthModule],
  controllers: [GuardTestController, OwnershipConfigTestController],
})
class PermissionsConsumerTestModule {}

test("auth HTTP endpoints with isolated PostgreSQL schema", async (t) => {
  const connectionString = process.env.AUTH_TEST_DATABASE_URL;
  assert.ok(
    connectionString,
    "Set AUTH_TEST_DATABASE_URL to a local development PostgreSQL database",
  );
  const schemaName = `auth_test_${randomBytes(8).toString("hex")}`;
  const admin = new Pool({ connectionString, connectionTimeoutMillis: 5000 });
  await admin.query(`CREATE SCHEMA "${schemaName}"`);
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 5000,
    options: `-c search_path=${schemaName},public`,
  });
  const messages: { email: string; token: string; type: string }[] = [];
  let failMail = false;
  const config = {
    DATABASE_URL: connectionString,
    JWT_ACCESS_SECRET: randomBytes(32).toString("hex"),
    JWT_REFRESH_SECRET: randomBytes(32).toString("hex"),
    NODE_ENV: "test",
    ALLOWED_ORIGINS: "http://localhost:3000",
  };
  try {
    await pool.query(
      await readFile(
        new URL(
          "../src/database/migrations/0001_init-users-and-auth.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => config],
        }),
        DatabaseModule,
        PermissionsConsumerTestModule,
      ],
    })
      .overrideProvider(DATABASE)
      .useValue(drizzle(pool, { schema }))
      .overrideProvider(AuthMailService)
      .useValue({
        assertConfigured() {},
        async send(email: string, token: string, type: string) {
          if (failMail) throw new Error("Simulated mail failure");
          messages.push({ email, token, type });
        },
      })
      .overrideGuard(AuthRequestGuard)
      .useValue({ canActivate: () => true })
      .compile();
    const app = module.createNestApplication();
    app.setGlobalPrefix("api/v1");
    configureHttpSecurity(app);
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new TransformResponseInterceptor());
    await app.listen(0, "127.0.0.1");
    try {
      const base = await app.getUrl();
      const password = randomBytes(16).toString("hex");
      const email = "auth-test@example.test";
      const payload = {
        fullName: "Khách kiểm thử",
        email,
        phone: "0912345678",
        password,
        confirmPassword: password,
      };
      const request = (path: string, body?: unknown, cookies?: string) =>
        fetch(`${base}/api/v1${path}`, {
          method: body === undefined ? "GET" : "POST",
          headers: {
            "Content-Type": "application/json",
            ...(cookies ? { Cookie: cookies } : {}),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
      const cookieHeader = (response: Response) =>
        response.headers
          .getSetCookie()
          .map((value) => value.split(";")[0])
          .join("; ");
      const rawRefresh = (header: string) =>
        header
          .split("; ")
          .find((value) => value.startsWith("refresh_token="))
          ?.slice("refresh_token=".length) ?? "";
      const drain = () => app.get(AuthService).onModuleDestroy();

      await t.test(
        "register validates input, prevents role injection and concurrent duplicate email",
        async () => {
          assert.equal(
            (await request("/auth/register", { ...payload, email: "invalid" }))
              .status,
            400,
          );
          const results = await Promise.all([
            request("/auth/register", { ...payload, role: "admin" }),
            request("/auth/register", payload),
          ]);
          assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
          const success = results.find((r) => r.status === 201);
          assert.ok(success);
          const body = (await success.json()) as {
            data: { role: string; passwordHash?: string };
          };
          assert.equal(body.data.role, "customer");
          assert.equal(body.data.passwordHash, undefined);
          const row = (
            await pool.query(
              "SELECT password_hash FROM users WHERE email = $1",
              [email],
            )
          ).rows[0] as { password_hash: string };
          assert.ok(row.password_hash.startsWith("$argon2id$"));
          const token = messages.find((m) => m.type === "email_verify");
          assert.ok(token);
          const stored = await pool.query(
            "SELECT 1 FROM auth_tokens WHERE token_hash = $1",
            [hashToken(token.token)],
          );
          assert.equal(stored.rowCount, 1);
        },
      );

      await t.test(
        "login cookies, safe /users/me, missing/forged token and suspended account",
        async () => {
          assert.equal(
            (await request("/auth/login", { email, password: "wrong" })).status,
            401,
          );
          const response = await request("/auth/login", {
            email,
            password,
            rememberMe: true,
          });
          assert.equal(response.status, 200);
          const cookies = response.headers.getSetCookie();
          assert.equal(cookies.length, 2);
          assert.ok(
            cookies.every(
              (value) =>
                value.includes("HttpOnly") &&
                value.includes("SameSite=Lax") &&
                value.includes("Path=/api/v1") &&
                value.includes("Max-Age="),
            ),
          );
          const header = cookieHeader(response);
          const loginBody = await response.text();
          for (const part of header.split("; ")) {
            assert.ok(!loginBody.includes(part.slice(part.indexOf("=") + 1)));
          }
          assert.equal(response.headers.get("cache-control"), "no-store");
          assert.equal(
            (await request("/users/me", undefined, header)).status,
            200,
          );
          assert.equal((await request("/users/me")).status, 401);
          assert.equal(
            (await request("/users/me", undefined, "access_token=forged"))
              .status,
            401,
          );
          await pool.query(
            "UPDATE users SET status = 'suspended' WHERE email = $1",
            [email],
          );
          assert.equal(
            (await request("/users/me", undefined, header)).status,
            403,
          );
          assert.equal(
            (await request("/auth/login", { email, password })).status,
            403,
          );
          await pool.query(
            "UPDATE users SET status = 'active' WHERE email = $1",
            [email],
          );
          const transient = await request("/auth/login", { email, password });
          assert.ok(
            transient.headers
              .getSetCookie()
              .every((value) => !value.includes("Max-Age=")),
          );
        },
      );

      await t.test(
        "refresh rotates hashes and concurrent reuse revokes all sessions",
        async () => {
          const initial = cookieHeader(
            await request("/auth/login", { email, password }),
          );
          const results = await Promise.all([
            request("/auth/refresh", {}, initial),
            request("/auth/refresh", {}, initial),
          ]);
          assert.deepEqual(results.map((r) => r.status).sort(), [200, 401]);
          const winner = results.find((r) => r.status === 200);
          assert.ok(winner);
          const renewed = cookieHeader(winner);
          assert.notEqual(rawRefresh(initial), rawRefresh(renewed));
          assert.equal(
            (await request("/auth/refresh", {}, renewed)).status,
            401,
          );
          const rows = await pool.query(
            "SELECT token_hash, revoked FROM refresh_tokens",
          );
          assert.ok(
            rows.rows.every(
              (row: { token_hash: string; revoked: boolean }) =>
                /^[a-f0-9]{64}$/u.test(row.token_hash) && row.revoked,
            ),
          );
        },
      );

      await t.test(
        "logout revokes refresh token, clears cookies and is idempotent",
        async () => {
          const header = cookieHeader(
            await request("/auth/login", { email, password }),
          );
          const response = await request("/auth/logout", {}, header);
          assert.equal(response.status, 204);
          assert.equal(await response.text(), "");
          assert.equal(response.headers.getSetCookie().length, 2);
          assert.equal(
            (await request("/auth/refresh", {}, header)).status,
            401,
          );
          assert.equal((await request("/auth/logout", {}, header)).status, 204);
        },
      );

      await t.test(
        "email verification is single-use under concurrent requests",
        async () => {
          const verification = messages.find((m) => m.type === "email_verify");
          assert.ok(verification);
          const results = await Promise.all([
            request("/auth/verify-email", { token: verification.token }),
            request("/auth/verify-email", { token: verification.token }),
          ]);
          assert.deepEqual(results.map((r) => r.status).sort(), [204, 401]);
          assert.equal(
            (
              await pool.query(
                "SELECT 1 FROM users WHERE email = $1 AND email_verified_at IS NOT NULL",
                [email],
              )
            ).rowCount,
            1,
          );
        },
      );

      await t.test(
        "forgot password hides account existence and delivery failure",
        async () => {
          for (const address of [email, "missing@example.test"]) {
            const response = await request("/auth/forgot-password", {
              email: address,
            });
            assert.equal(response.status, 204);
            assert.equal(await response.text(), "");
          }
          await drain();
          assert.ok(messages.some((m) => m.type === "password_reset"));
          failMail = true;
          assert.equal(
            (await request("/auth/forgot-password", { email })).status,
            204,
          );
          await drain();
          failMail = false;
        },
      );

      await t.test(
        "reset rejects expired/wrong-purpose tokens and consumes a token exactly once",
        async () => {
          await request("/auth/forgot-password", { email });
          await drain();
          const reset = messages
            .filter((m) => m.type === "password_reset")
            .at(-1);
          assert.ok(reset);
          const newPassword = randomBytes(16).toString("hex");
          const body = {
            token: reset.token,
            password: newPassword,
            confirmPassword: newPassword,
          };
          assert.equal(
            (await request("/auth/verify-email", { token: reset.token }))
              .status,
            401,
          );
          await pool.query(
            "UPDATE auth_tokens SET expires_at = now() - interval '1 second' WHERE token_hash = $1",
            [hashToken(reset.token)],
          );
          assert.equal(
            (await request("/auth/reset-password", body)).status,
            401,
          );
          await pool.query(
            "UPDATE auth_tokens SET expires_at = now() + interval '1 hour' WHERE token_hash = $1",
            [hashToken(reset.token)],
          );
          const oldSession = cookieHeader(
            await request("/auth/login", { email, password }),
          );
          const results = await Promise.all([
            request("/auth/reset-password", body),
            request("/auth/reset-password", body),
          ]);
          assert.deepEqual(results.map((r) => r.status).sort(), [204, 401]);
          assert.equal(
            (await request("/auth/refresh", {}, oldSession)).status,
            401,
          );
          assert.equal(
            (await request("/auth/login", { email, password })).status,
            401,
          );
          assert.equal(
            (await request("/auth/login", { email, password: newPassword }))
              .status,
            200,
          );
        },
      );

      await t.test(
        "JWT token kind separation, Swagger and production cookie options",
        async () => {
          const user = (
            await pool.query("SELECT id FROM users WHERE email = $1", [email])
          ).rows[0] as { id: string };
          const refresh = await app
            .get(AuthJwtService)
            .sign(user.id, "refresh", true);
          assert.equal(
            (await request("/users/me", undefined, `access_token=${refresh}`))
              .status,
            401,
          );
          const expired = await new SignJWT({ kind: "access" })
            .setProtectedHeader({ alg: "HS256" })
            .setSubject(user.id)
            .setJti("expired-test")
            .setIssuer("booksportscourt")
            .setAudience("booksportscourt-api")
            .setIssuedAt()
            .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
            .sign(new TextEncoder().encode(config.JWT_ACCESS_SECRET));
          const expiredResponse = await request(
            "/users/me",
            undefined,
            `access_token=${expired}`,
          );
          assert.equal(expiredResponse.status, 401);
          assert.equal(
            ((await expiredResponse.json()) as { error: { code: string } })
              .error.code,
            "TOKEN_EXPIRED",
          );
          const access = await app
            .get(AuthJwtService)
            .sign(user.id, "access", true);
          await pool.query(
            "UPDATE users SET deleted_at = now() WHERE id = $1",
            [user.id],
          );
          assert.equal(
            (await request("/users/me", undefined, `access_token=${access}`))
              .status,
            401,
          );
          await pool.query("UPDATE users SET deleted_at = NULL WHERE id = $1", [
            user.id,
          ]);
          const document = SwaggerModule.createDocument(
            app,
            new DocumentBuilder().setTitle("Auth test").setVersion("1").build(),
          );
          for (const path of [
            "/auth/register",
            "/auth/login",
            "/auth/refresh",
            "/auth/logout",
            "/auth/forgot-password",
            "/auth/reset-password",
            "/auth/verify-email",
            "/users/me",
          ]) {
            assert.ok(document.paths[`/api/v1${path}`]);
          }
          const options: unknown[] = [];
          new AuthCookies(new ConfigService({ NODE_ENV: "production" })).set(
            {
              cookie(_name, _value, option) {
                options.push(option);
              },
              clearCookie() {},
            },
            { accessToken: "test", refreshToken: "test", persistent: true },
          );
          assert.ok(
            options.every((option) => (option as { secure: boolean }).secure),
          );
        },
      );
      for (const file of [
        "0002_init-catalogs-and-venues.sql",
        "0003_init-courts-pricing-and-blackouts.sql",
      ]) {
        await pool.query(
          await readFile(
            new URL(`../src/database/migrations/${file}`, import.meta.url),
            "utf8",
          ),
        );
      }
      const ownerId = randomUUID(),
        otherId = randomUUID(),
        customerId = randomUUID(),
        adminId = randomUUID();
      const provinceId = randomUUID(),
        districtId = randomUUID(),
        venueId = randomUUID(),
        courtId = randomUUID();
      for (const [id, role] of [
        [ownerId, "owner"],
        [otherId, "owner"],
        [customerId, "customer"],
        [adminId, "admin"],
      ]) {
        await pool.query(
          "INSERT INTO users (id, email, full_name, role) VALUES ($1, $2, $3, $4)",
          [id, `${id}@example.test`, "Guard test", role],
        );
      }
      await pool.query(
        "INSERT INTO areas (id, type, name, slug) VALUES ($1, 'province', 'Test', 'test')",
        [provinceId],
      );
      await pool.query(
        "INSERT INTO areas (id, type, name, slug, parent_id) VALUES ($1, 'district', 'Test', 'test', $2)",
        [districtId, provinceId],
      );
      await pool.query(
        "INSERT INTO venues (id, owner_id, name, slug, address, province_id, district_id) VALUES ($1, $2, 'Test', 'test', 'Test', $3, $4)",
        [venueId, ownerId, provinceId, districtId],
      );
      await pool.query(
        "INSERT INTO courts (id, venue_id, name) VALUES ($1, $2, 'Test')",
        [courtId, venueId],
      );
      const ownerCookie = `access_token=${await app.get(AuthJwtService).sign(ownerId, "access", true)}`;
      const otherCookie = `access_token=${await app.get(AuthJwtService).sign(otherId, "access", true)}`;
      const adminCookie = `access_token=${await app.get(AuthJwtService).sign(adminId, "access", true)}`;

      await t.test(
        "users/me returns only the authenticated account for every role",
        async () => {
          for (const [id, role] of [
            [customerId, "customer"],
            [ownerId, "owner"],
            [adminId, "admin"],
          ] as const) {
            const token = await app
              .get(AuthJwtService)
              .sign(id, "access", false);
            const response = await request(
              `/users/me?id=${otherId}&userId=${otherId}&role=admin`,
              undefined,
              `access_token=${token}`,
            );
            assert.equal(response.status, 200);
            const body = (await response.json()) as { data: AuthenticatedUser };
            assert.equal(body.data.id, id);
            assert.equal(body.data.role, role);
            assert.equal("passwordHash" in body.data, false);
            assert.equal("accessToken" in body.data, false);
            assert.equal("refreshToken" in body.data, false);
          }
        },
      );

      await t.test(
        "roles use live database role, handler metadata overrides class and admin has no implicit access",
        async () => {
          assert.equal((await request("/guard-test/role")).status, 401);
          assert.equal(
            (await request("/guard-test/role", undefined, ownerCookie)).status,
            200,
          );
          assert.equal(
            (await request("/guard-test/customer", undefined, ownerCookie))
              .status,
            403,
          );
          assert.equal(
            (await request("/guard-test/role", undefined, adminCookie)).status,
            403,
          );
          const claimedAdmin = await new SignJWT({
            kind: "access",
            role: "admin",
          })
            .setProtectedHeader({ alg: "HS256" })
            .setSubject(ownerId)
            .setJti(randomUUID())
            .setIssuer("booksportscourt")
            .setAudience("booksportscourt-api")
            .setIssuedAt()
            .setExpirationTime("15m")
            .sign(new TextEncoder().encode(config.JWT_ACCESS_SECRET));
          assert.equal(
            (
              await request(
                "/guard-test/admin",
                undefined,
                `access_token=${claimedAdmin}`,
              )
            ).status,
            403,
          );
          await pool.query("UPDATE users SET role = 'customer' WHERE id = $1", [
            ownerId,
          ]);
          assert.equal(
            (await request("/guard-test/role", undefined, ownerCookie)).status,
            403,
          );
          assert.equal(
            (await request("/guard-test/customer", undefined, ownerCookie))
              .status,
            200,
          );
          await pool.query("UPDATE users SET role = 'owner' WHERE id = $1", [
            ownerId,
          ]);
        },
      );

      await t.test(
        "ownership resolves venue and court parent; rejects other owner and invalid/missing resources",
        async () => {
          for (const path of [
            `/guard-test/venues/${venueId}`,
            `/guard-test/courts/${courtId}`,
          ]) {
            assert.equal(
              (await request(path, undefined, ownerCookie)).status,
              200,
            );
            const denied = await request(path, undefined, otherCookie);
            assert.equal(denied.status, 403);
            assert.equal(
              ((await denied.json()) as { error: { code: string } }).error.code,
              "NOT_VENUE_OWNER",
            );
          }
          assert.equal(
            (
              await request(
                "/guard-test/venues/invalid",
                undefined,
                ownerCookie,
              )
            ).status,
            400,
          );
          assert.equal(
            (
              await request(
                `/guard-test/venues/${randomUUID()}`,
                undefined,
                ownerCookie,
              )
            ).status,
            404,
          );
          assert.equal(
            (
              await request(
                `/guard-test/missing-policy/${venueId}`,
                undefined,
                ownerCookie,
              )
            ).status,
            403,
          );
        },
      );

      await t.test(
        "ownership rejects missing roles, empty roles and mismatched route parameters",
        async () => {
          for (const path of [
            `/ownership-config-test/missing-roles/${venueId}`,
            `/guard-test/empty-roles/${venueId}`,
          ]) {
            assert.equal(
              (await request(path, undefined, ownerCookie)).status,
              403,
            );
          }
          const response = await request(
            `/guard-test/wrong-param/${courtId}`,
            undefined,
            ownerCookie,
          );
          assert.equal(response.status, 400);
          assert.equal(
            ((await response.json()) as { error: { code: string } }).error.code,
            "VALIDATION_ERROR",
          );
          // The role check runs before resource validation, so Customer cannot probe IDs.
          const customerToken = await app
            .get(AuthJwtService)
            .sign(customerId, "access", false);
          assert.equal(
            (
              await request(
                "/guard-test/courts/invalid",
                undefined,
                `access_token=${customerToken}`,
              )
            ).status,
            403,
          );
        },
      );

      await t.test(
        "ownership validates court IDs and returns 404 for missing courts",
        async () => {
          const invalid = await request(
            "/guard-test/courts/invalid",
            undefined,
            ownerCookie,
          );
          assert.equal(invalid.status, 400);
          assert.equal(
            ((await invalid.json()) as { error: { code: string } }).error.code,
            "VALIDATION_ERROR",
          );
          assert.equal(
            (
              await request(
                `/guard-test/courts/${randomUUID()}`,
                undefined,
                ownerCookie,
              )
            ).status,
            404,
          );
        },
      );

      await t.test(
        "ownership service checks live roles before resource validation",
        async () => {
          const ownership = app.get(OwnershipService);
          const policy = {
            resource: "venue" as const,
            param: "id",
            allowAdmin: true,
          };
          for (const [id, roles] of [
            [customerId, ["customer"]],
            [ownerId, []],
            [adminId, ["owner"]],
          ] as const) {
            await assert.rejects(
              ownership.assertOwnership(id, "invalid", policy, roles),
              (error: unknown) =>
                error instanceof ForbiddenException &&
                error.getStatus() === 403,
            );
          }
        },
      );

      await t.test(
        "admin bypass requires explicit policy and route role; resource must still exist",
        async () => {
          assert.equal(
            (
              await request(
                `/guard-test/venues/${venueId}`,
                undefined,
                adminCookie,
              )
            ).status,
            403,
          );
          assert.equal(
            (
              await request(
                `/guard-test/no-bypass/${venueId}`,
                undefined,
                adminCookie,
              )
            ).status,
            403,
          );
          assert.equal(
            (
              await request(
                `/guard-test/managed/${venueId}`,
                undefined,
                adminCookie,
              )
            ).status,
            200,
          );
          assert.equal(
            (
              await request(
                `/guard-test/managed/${randomUUID()}`,
                undefined,
                adminCookie,
              )
            ).status,
            404,
          );
        },
      );

      await t.test(
        "deleted courts or parent venues deny ownership; inactive accounts denied immediately",
        async () => {
          await pool.query(
            "UPDATE courts SET deleted_at = now() WHERE id = $1",
            [courtId],
          );
          assert.equal(
            (
              await request(
                `/guard-test/courts/${courtId}`,
                undefined,
                ownerCookie,
              )
            ).status,
            404,
          );
          await pool.query(
            "UPDATE courts SET deleted_at = NULL WHERE id = $1",
            [courtId],
          );
          await pool.query(
            "UPDATE venues SET deleted_at = now() WHERE id = $1",
            [venueId],
          );
          assert.equal(
            (
              await request(
                `/guard-test/courts/${courtId}`,
                undefined,
                ownerCookie,
              )
            ).status,
            404,
          );
          assert.equal(
            (
              await request(
                `/guard-test/venues/${venueId}`,
                undefined,
                ownerCookie,
              )
            ).status,
            404,
          );
          await pool.query(
            "UPDATE venues SET deleted_at = NULL WHERE id = $1",
            [venueId],
          );
          for (const status of ["suspended", "pending"]) {
            await pool.query("UPDATE users SET status = $1 WHERE id = $2", [
              status,
              ownerId,
            ]);
            assert.equal(
              (await request("/guard-test/role", undefined, ownerCookie))
                .status,
              403,
            );
          }
          await pool.query("UPDATE users SET status = 'active' WHERE id = $1", [
            ownerId,
          ]);
        },
      );

      await t.test(
        "service rechecks account and ownership in transaction instead of trusting a prior guard",
        async () => {
          const ownership = app.get(OwnershipService);
          const policy = {
            resource: "court" as const,
            param: "courtId",
            allowAdmin: false,
          };
          const db = drizzle(pool, { schema });
          await db.transaction((tx) =>
            ownership.assertOwnership(ownerId, courtId, policy, ["owner"], tx),
          );
          await db.transaction(async (tx) => {
            await ownership.assertOwnership(
              ownerId,
              courtId,
              policy,
              ["owner"],
              tx,
            );
            const concurrent = await pool.connect();
            try {
              await concurrent.query("BEGIN");
              await concurrent.query("SET LOCAL lock_timeout = '100ms'");
              await assert.rejects(
                concurrent.query(
                  "UPDATE venues SET owner_id = $1 WHERE id = $2",
                  [otherId, venueId],
                ),
                (error: unknown) =>
                  typeof error === "object" &&
                  error !== null &&
                  "code" in error &&
                  error.code === "55P03",
              );
            } finally {
              await concurrent.query("ROLLBACK");
              concurrent.release();
            }
          });
          await pool.query("UPDATE venues SET owner_id = $1 WHERE id = $2", [
            otherId,
            venueId,
          ]);
          await assert.rejects(
            db.transaction((tx) =>
              ownership.assertOwnership(
                ownerId,
                courtId,
                policy,
                ["owner"],
                tx,
              ),
            ),
          );
          await pool.query("UPDATE venues SET owner_id = $1 WHERE id = $2", [
            ownerId,
            venueId,
          ]);
          await pool.query(
            "UPDATE users SET status = 'suspended' WHERE id = $1",
            [ownerId],
          );
          await assert.rejects(
            db.transaction((tx) =>
              ownership.assertOwnership(
                ownerId,
                courtId,
                policy,
                ["owner"],
                tx,
              ),
            ),
          );
          await pool.query("UPDATE users SET status = 'active' WHERE id = $1", [
            ownerId,
          ]);
        },
      );
      await t.test(
        "transaction recheck prevents writes after a successful guard when permissions change",
        async (t) => {
          const ownership = app.get(OwnershipService);
          const db = drizzle(pool, { schema });
          const policy = {
            resource: "court" as const,
            param: "courtId",
            allowAdmin: false,
          };
          for (const scenario of [
            {
              name: "venue transferred",
              change: "UPDATE venues SET owner_id = $1 WHERE id = $2",
              values: [otherId, venueId],
              restore: "UPDATE venues SET owner_id = $1 WHERE id = $2",
              restored: [ownerId, venueId],
              status: 403,
            },
            {
              name: "role revoked",
              change: "UPDATE users SET role = 'customer' WHERE id = $1",
              values: [ownerId],
              restore: "UPDATE users SET role = 'owner' WHERE id = $1",
              restored: [ownerId],
              status: 403,
            },
            {
              name: "account suspended",
              change: "UPDATE users SET status = 'suspended' WHERE id = $1",
              values: [ownerId],
              restore: "UPDATE users SET status = 'active' WHERE id = $1",
              restored: [ownerId],
              status: 403,
            },
            {
              name: "account deleted",
              change: "UPDATE users SET deleted_at = now() WHERE id = $1",
              values: [ownerId],
              restore: "UPDATE users SET deleted_at = NULL WHERE id = $1",
              restored: [ownerId],
              status: 401,
            },
            {
              name: "court deleted",
              change: "UPDATE courts SET deleted_at = now() WHERE id = $1",
              values: [courtId],
              restore: "UPDATE courts SET deleted_at = NULL WHERE id = $1",
              restored: [courtId],
              status: 404,
            },
            {
              name: "parent venue deleted",
              change: "UPDATE venues SET deleted_at = now() WHERE id = $1",
              values: [venueId],
              restore: "UPDATE venues SET deleted_at = NULL WHERE id = $1",
              restored: [venueId],
              status: 404,
            },
          ])
            await t.test(scenario.name, async () => {
              assert.equal(
                (
                  await request(
                    `/guard-test/courts/${courtId}`,
                    undefined,
                    ownerCookie,
                  )
                ).status,
                200,
              );
              const before = await pool.query<{ name: string }>(
                "SELECT name FROM courts WHERE id = $1",
                [courtId],
              );
              await pool.query(scenario.change, scenario.values);
              try {
                await assert.rejects(
                  db.transaction(async (tx) => {
                    await ownership.assertOwnership(
                      ownerId,
                      courtId,
                      policy,
                      ["owner"],
                      tx,
                    );
                    const changed = await tx
                      .update(schema.courts)
                      .set({ name: "Unauthorized change" })
                      .where(eq(schema.courts.id, courtId))
                      .returning({ id: schema.courts.id });
                    assert.equal(changed.length, 1);
                  }),
                  (error: unknown) =>
                    error instanceof HttpException &&
                    error.getStatus() === scenario.status,
                );
                const after = await pool.query<{ name: string }>(
                  "SELECT name FROM courts WHERE id = $1",
                  [courtId],
                );
                assert.deepEqual(after.rows, before.rows);
              } finally {
                await pool.query(scenario.restore, scenario.restored);
              }
            });
        },
      );

      await t.test(
        "authorized mutation commits and later failure rolls back writes on the same transaction",
        async () => {
          const ownership = app.get(OwnershipService);
          const db = drizzle(pool, { schema });
          const policy = {
            resource: "court" as const,
            param: "courtId",
            allowAdmin: false,
          };
          const rename = async (name: string, fail: boolean) =>
            db.transaction(async (tx) => {
              await ownership.assertOwnership(
                ownerId,
                courtId,
                policy,
                ["owner"],
                tx,
              );
              const changed = await tx
                .update(schema.courts)
                .set({ name })
                .where(eq(schema.courts.id, courtId))
                .returning({ id: schema.courts.id });
              assert.deepEqual(changed, [{ id: courtId }]);
              if (fail) throw new Error("Simulated failure after write");
            });
          try {
            await rename("Authorized change", false);
            assert.equal(
              (
                await pool.query<{ name: string }>(
                  "SELECT name FROM courts WHERE id = $1",
                  [courtId],
                )
              ).rows[0]?.name,
              "Authorized change",
            );
            await assert.rejects(
              rename("Must roll back", true),
              /Simulated failure after write/,
            );
            assert.equal(
              (
                await pool.query<{ name: string }>(
                  "SELECT name FROM courts WHERE id = $1",
                  [courtId],
                )
              ).rows[0]?.name,
              "Authorized change",
            );
          } finally {
            await pool.query("UPDATE courts SET name = 'Test' WHERE id = $1", [
              courtId,
            ]);
          }
        },
      );

      await t.test(
        "transaction holds user and court locks until the authorized write completes",
        async () => {
          const ownership = app.get(OwnershipService);
          const db = drizzle(pool, { schema });
          const policy = {
            resource: "court" as const,
            param: "courtId",
            allowAdmin: false,
          };
          try {
            await db.transaction(async (tx) => {
              await ownership.assertOwnership(
                ownerId,
                courtId,
                policy,
                ["owner"],
                tx,
              );
              const concurrent = await pool.connect();
              try {
                for (const [statement, id] of [
                  ["UPDATE users SET role = 'customer' WHERE id = $1", ownerId],
                  [
                    "UPDATE courts SET deleted_at = now() WHERE id = $1",
                    courtId,
                  ],
                ] as const) {
                  await concurrent.query("BEGIN");
                  try {
                    await concurrent.query("SET LOCAL lock_timeout = '100ms'");
                    await assert.rejects(
                      concurrent.query(statement, [id]),
                      (error: unknown) =>
                        typeof error === "object" &&
                        error !== null &&
                        "code" in error &&
                        error.code === "55P03",
                    );
                  } finally {
                    await concurrent.query("ROLLBACK");
                  }
                }
              } finally {
                concurrent.release();
              }
              const changed = await tx
                .update(schema.courts)
                .set({ name: "Written under lock" })
                .where(eq(schema.courts.id, courtId))
                .returning({ id: schema.courts.id });
              assert.deepEqual(changed, [{ id: courtId }]);
            });
            assert.equal(
              (
                await pool.query<{ name: string }>(
                  "SELECT name FROM courts WHERE id = $1",
                  [courtId],
                )
              ).rows[0]?.name,
              "Written under lock",
            );
          } finally {
            await pool.query("UPDATE courts SET name = 'Test' WHERE id = $1", [
              courtId,
            ]);
          }
        },
      );
    } finally {
      await app.close();
    }
  } finally {
    await pool.end();
    // Only the randomly generated schema created by this test is removed.
    assert.match(schemaName, /^auth_test_[a-f0-9]{16}$/u);
    await admin.query(`DROP SCHEMA "${schemaName}" CASCADE`);
    await admin.end();
  }
});

function guardContext(
  request: AuthenticatedRequest,
  handler: ReturnType<ExecutionContext["getHandler"]> = GuardTestController
    .prototype.role,
) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => GuardTestController,
  } as unknown as ExecutionContext;
}

function principal(): AuthenticatedUser {
  return {
    id: randomUUID(),
    email: "unit@example.test",
    fullName: "Unit",
    phone: null,
    avatarUrl: null,
    role: "owner",
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    emailVerifiedAt: null,
  };
}

test("JwtAuthGuard replaces existing principal and removes it if authentication fails", async () => {
  const verified = principal();
  const request: AuthenticatedRequest = {
    method: "GET",
    params: {},
    headers: { cookie: "access_token=verified" },
    user: { ...principal(), role: "admin" },
  };
  const guard = new JwtAuthGuard({
    async me(raw: string) {
      assert.equal(raw, "verified");
      return verified;
    },
  } as unknown as AuthService);
  assert.equal(await guard.canActivate(guardContext(request)), true);
  assert.equal(request.user, verified);
  const denied = new JwtAuthGuard({
    async me() {
      throw new UnauthorizedException();
    },
  } as unknown as AuthService);
  await assert.rejects(denied.canActivate(guardContext(request)));
  assert.equal(request.user, undefined);
});

test("RolesGuard denies missing principal and uses method role metadata without admin bypass", () => {
  const guard = new RolesGuard(new Reflector());
  const request: AuthenticatedRequest = {
    method: "GET",
    params: {},
    headers: {},
  };
  assert.throws(() => guard.canActivate(guardContext(request)));
  request.user = principal();
  assert.equal(guard.canActivate(guardContext(request)), true);
  assert.throws(() =>
    guard.canActivate(
      guardContext(request, GuardTestController.prototype.admin),
    ),
  );
  request.user.role = "admin";
  assert.throws(() => guard.canActivate(guardContext(request)));
  assert.equal(
    guard.canActivate(
      guardContext(request, GuardTestController.prototype.admin),
    ),
    true,
  );
});

test("OwnershipGuard fails closed when authentication or ownership metadata is missing", async () => {
  let calls = 0;
  const guard = new OwnershipGuard(new Reflector(), {
    async assertOwnership() {
      calls++;
    },
  } as unknown as OwnershipService);
  const request: AuthenticatedRequest = {
    method: "GET",
    params: {},
    headers: {},
  };
  await assert.rejects(guard.canActivate(guardContext(request)));
  request.user = principal();
  await assert.rejects(guard.canActivate(guardContext(request)));
  assert.equal(calls, 0);
});

test("auth origin check and per-IP rate limit", () => {
  const guard = new AuthRequestGuard(
    new ConfigService({ ALLOWED_ORIGINS: "http://localhost:3000" }),
  );
  const context = (origin: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          method: "POST",
          ip: "127.0.0.1",
          headers: { origin },
        }),
      }),
    }) as ExecutionContext;
  assert.throws(() => guard.canActivate(context("https://invalid.example")));
  for (let i = 0; i < 10; i++)
    assert.equal(guard.canActivate(context("http://localhost:3000")), true);
  assert.throws(() => guard.canActivate(context("http://localhost:3000")));
});
