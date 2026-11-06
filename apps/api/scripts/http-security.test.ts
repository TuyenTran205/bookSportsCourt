import "reflect-metadata";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { Controller, Get, Post, Res, HttpCode, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { SignJWT } from "jose";
import {
  AuthCookies,
  type AuthResponse,
} from "../src/modules/auth/auth-http.js";
import { configureHttpSecurity } from "../src/config/http-security.js";
import { AppConfigSchema } from "../src/config/app-config.js";
import { GlobalExceptionFilter } from "../src/common/filters/global-exception.filter.js";
import { TransformResponseInterceptor } from "../src/common/interceptors/transform-response.interceptor.js";

let accessToken = "";
let refreshToken = "";
let mutations = 0;

// Test-only handlers use the same cookie service and middleware as production.
@Controller("auth")
class SecurityProbeController {
  constructor(private readonly cookies: AuthCookies) {}
  @Post("session")
  @HttpCode(200)
  session(@Res({ passthrough: true }) response: AuthResponse) {
    mutations++;
    this.cookies.set(response, { accessToken, refreshToken, persistent: true });
    return { ok: true };
  }
  @Post("logout")
  @HttpCode(204)
  logout(@Res({ passthrough: true }) response: AuthResponse) {
    this.cookies.clear(response);
  }
  @Get("error")
  error() {
    throw new Error(
      `Failure: ${JSON.stringify({ accessToken, refreshToken })}; Cookie access_token=${accessToken}; refresh_token=${refreshToken}`,
    );
  }
}

test("origin configuration rejects wildcards, malformed origins and non-HTTPS production", () => {
  const base = {
    DATABASE_URL: "postgresql://localhost/test",
    JWT_ACCESS_SECRET: randomBytes(32).toString("hex"),
    JWT_REFRESH_SECRET: randomBytes(32).toString("hex"),
    NODE_ENV: "production",
  };
  for (const origin of [
    "",
    " ",
    "*",
    "null",
    "https://*.example.test",
    "https://app.example.test/",
    "https://app.example.test/path",
    "https://app.example.test?x=1",
    "https://app.example.test#x",
    "https://user:pass@example.test",
    "http://app.example.test",
    "https://app.example.test,",
  ]) {
    assert.equal(
      AppConfigSchema.safeParse({ ...base, ALLOWED_ORIGINS: origin }).success,
      false,
      origin,
    );
  }
  assert.equal(
    AppConfigSchema.safeParse({
      ...base,
      ALLOWED_ORIGINS: "https://app.example.test, https://admin.example.test",
    }).success,
    true,
  );
  assert.equal(
    AppConfigSchema.safeParse({
      ...base,
      NODE_ENV: "development",
      ALLOWED_ORIGINS: "http://localhost:3000",
    }).success,
    true,
  );
});

test("production cookie and CORS on real HTTP transport", async (t) => {
  const key = randomBytes(32);
  accessToken = await new SignJWT({ kind: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("test")
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(key);
  refreshToken = await new SignJWT({ kind: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("test")
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(key);
  const allowed = "https://app.example.test";
  const module = await Test.createTestingModule({
    controllers: [SecurityProbeController],
    providers: [
      AuthCookies,
      {
        provide: ConfigService,
        useValue: new ConfigService({
          NODE_ENV: "production",
          ALLOWED_ORIGINS: `${allowed},https://admin.example.test`,
        }),
      },
    ],
  }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix("api/v1");
  configureHttpSecurity(app);
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new TransformResponseInterceptor());
  await app.listen(0, "127.0.0.1");
  const base = `${await app.getUrl()}/api/v1/auth`;
  try {
    await t.test(
      "allowed preflight has exact origin, credentials, methods and explicit headers",
      async () => {
        for (const origin of [allowed, "https://admin.example.test"]) {
          const response = await fetch(`${base}/session`, {
            method: "OPTIONS",
            headers: {
              Origin: origin,
              "Access-Control-Request-Method": "POST",
              "Access-Control-Request-Headers": "content-type",
            },
          });
          assert.equal(response.status, 204);
          assert.equal(
            response.headers.get("access-control-allow-origin"),
            origin,
          );
          assert.equal(
            response.headers.get("access-control-allow-credentials"),
            "true",
          );
          assert.match(response.headers.get("vary") ?? "", /Origin/u);
          assert.match(
            response.headers.get("access-control-allow-methods") ?? "",
            /POST/u,
          );
          assert.equal(
            response.headers.get("access-control-allow-headers"),
            "Content-Type,X-Request-Origin",
          );
          assert.equal(response.headers.get("set-cookie"), null);
        }
      },
    );

    await t.test(
      "disallowed origins cannot execute mutations or obtain CORS headers/cookies",
      async () => {
        const before = mutations;
        for (const origin of [
          "https://evil.example",
          "https://app.example.test.evil.example",
          "http://app.example.test",
          "https://app.example.test:444",
          "null",
        ]) {
          for (const method of ["OPTIONS", "POST"]) {
            const response = await fetch(`${base}/session`, {
              method,
              headers: { Origin: origin },
            });
            assert.equal(response.status, 403);
            assert.equal(
              response.headers.get("access-control-allow-origin"),
              null,
            );
            assert.equal(response.headers.get("set-cookie"), null);
            assert.equal(
              ((await response.json()) as { error: { code: string } }).error
                .code,
              "FORBIDDEN",
            );
          }
        }
        assert.equal(mutations, before);
      },
    );

    await t.test(
      "production issues and clears HttpOnly Secure Lax host-only cookies on matching paths",
      async () => {
        const response = await fetch(`${base}/session`, {
          method: "POST",
          headers: { Origin: allowed },
        });
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("cache-control"), "no-store");
        assert.equal(
          response.headers.get("access-control-allow-origin"),
          allowed,
        );
        const cookies = response.headers.getSetCookie();
        assert.equal(cookies.length, 2);
        for (const header of cookies) {
          for (const flag of [
            "HttpOnly",
            "Secure",
            "SameSite=Lax",
            "Path=/api/v1",
          ])
            assert.ok(header.includes(flag));
          assert.ok(!header.includes("Domain="));
        }
        assert.ok(cookies[0]?.includes("Max-Age=900"));
        assert.ok(cookies[1]?.includes("Max-Age=2592000"));
        const body = await response.text();
        assert.ok(!body.includes(accessToken) && !body.includes(refreshToken));
        assert.deepEqual(JSON.parse(body), { data: { ok: true } });
        const logout = await fetch(`${base}/logout`, {
          method: "POST",
          headers: { Origin: allowed },
        });
        assert.equal(logout.status, 204);
        assert.equal(await logout.text(), "");
        assert.equal(logout.headers.getSetCookie().length, 2);
        for (const header of logout.headers.getSetCookie()) {
          for (const flag of [
            "HttpOnly",
            "Secure",
            "SameSite=Lax",
            "Path=/api/v1",
          ])
            assert.ok(header.includes(flag));
          assert.ok(!header.includes("Domain="));
          assert.ok(
            Date.parse(header.split("Expires=")[1]?.split(";")[0] ?? "") <
              Date.now(),
          );
        }
      },
    );

    await t.test(
      "requests without Origin remain available for non-browser clients without wildcard CORS",
      async () => {
        const response = await fetch(`${base}/session`, { method: "POST" });
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("access-control-allow-origin"), null);
      },
    );

    await t.test(
      "unexpected exceptions redact JWT/cookie secrets in logs and omit secrets in response",
      async (subtest) => {
        const captured: unknown[][] = [];
        subtest.mock.method(Logger.prototype, "error", (...args: unknown[]) =>
          captured.push(args),
        );
        const response = await fetch(`${base}/error`, {
          headers: { Origin: allowed },
        });
        assert.equal(response.status, 500);
        assert.equal(
          response.headers.get("access-control-allow-origin"),
          allowed,
        );
        const body = await response.text();
        const logs = JSON.stringify(captured);
        assert.ok(captured.length > 0);
        for (const value of [body, logs])
          assert.ok(
            !value.includes(accessToken) && !value.includes(refreshToken),
          );
        assert.match(logs, /REDACTED/u);
      },
    );
  } finally {
    await app.close();
  }
});
