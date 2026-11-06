import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes, randomUUID } from "node:crypto";
import { HttpException, type ExecutionContext } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SignJWT } from "jose";
import {
  JwtAuthGuard,
  type AuthenticatedRequest,
} from "../src/common/guards/jwt-auth.guard.js";
import { AuthService } from "../src/modules/auth/auth.service.js";
import { AuthJwtService } from "../src/modules/auth/auth-jwt.service.js";
import {
  AuthRepository,
  type AuthUser,
} from "../src/modules/auth/auth.repository.js";
import { AuthMailService } from "../src/modules/auth/auth-mail.service.js";

function fixture() {
  const secret = randomBytes(32).toString("hex");
  const jwt = new AuthJwtService(
    new ConfigService({
      JWT_ACCESS_SECRET: secret,
      JWT_REFRESH_SECRET: randomBytes(32).toString("hex"),
    }),
  );
  const user: AuthUser = {
    id: randomUUID(),
    email: "guard@example.test",
    fullName: "Guard test",
    phone: null,
    avatarUrl: null,
    passwordHash: null,
    role: "owner",
    status: "active",
    emailVerifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
  const state = { user: user as AuthUser | undefined, reads: 0 };
  const repo = {
    async byId(id: string) {
      state.reads++;
      assert.equal(id, user.id);
      return state.user;
    },
  };
  const auth = new AuthService(
    repo as AuthRepository,
    jwt,
    {} as AuthMailService,
  );
  const guard = new JwtAuthGuard(auth);
  const request = (cookie?: string): AuthenticatedRequest => ({
    method: "GET",
    params: {},
    headers: cookie === undefined ? {} : { cookie },
    user: {
      id: "forged-user",
      email: "forged@example.test",
      fullName: "Forged",
      phone: null,
      avatarUrl: null,
      role: "admin",
      status: "active",
      createdAt: "",
      updatedAt: "",
      emailVerifiedAt: null,
    },
  });
  const run = (req: AuthenticatedRequest) =>
    guard.canActivate({
      switchToHttp: () => ({ getRequest: () => req }),
    } as ExecutionContext);
  const signed = (
    claims: Record<string, unknown> = {},
    expiration = "15m",
    key = secret,
  ) =>
    new SignJWT({ kind: "access", ...claims })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.id)
      .setJti(randomUUID())
      .setIssuer("booksportscourt")
      .setAudience("booksportscourt-api")
      .setIssuedAt()
      .setExpirationTime(expiration)
      .sign(new TextEncoder().encode(key));
  return { jwt, user, state, request, run, signed };
}

function status(expected: number, code?: string) {
  return (error: unknown) => {
    assert.ok(error instanceof HttpException);
    assert.equal(error.getStatus(), expected);
    if (code)
      assert.equal((error.getResponse() as { code: string }).code, code);
    return true;
  };
}

test("JwtAuthGuard rejects invalid cookies and tokens before reading the repository", async (t) => {
  const f = fixture();
  const cases: [string, string | undefined, string][] = [
    ["missing cookie", undefined, "UNAUTHORIZED"],
    ["empty token", "access_token=", "UNAUTHORIZED"],
    ["malformed cookie encoding", "access_token=%E0%A4%A", "UNAUTHORIZED"],
    ["malformed JWT", "access_token=forged", "UNAUTHORIZED"],
    [
      "wrong signature",
      `access_token=${await f.signed({}, "15m", randomBytes(32).toString("hex"))}`,
      "UNAUTHORIZED",
    ],
    [
      "expired JWT",
      `access_token=${await f.signed({}, "-1m")}`,
      "TOKEN_EXPIRED",
    ],
    [
      "refresh token",
      `access_token=${await f.jwt.sign(f.user.id, "refresh", false)}`,
      "UNAUTHORIZED",
    ],
    [
      "wrong kind signed with access key",
      `access_token=${await f.signed({ kind: "refresh" })}`,
      "UNAUTHORIZED",
    ],
  ];
  for (const [name, cookie, code] of cases)
    await t.test(name, async () => {
      const req = f.request(cookie);
      await assert.rejects(f.run(req), status(401, code));
      assert.equal(req.user, undefined);
      assert.equal(f.state.reads, 0);
    });
});

test("JwtAuthGuard uses the current account role, ignores JWT role and excludes passwordHash", async () => {
  const f = fixture();
  const token = await f.signed({ role: "admin" });
  const req = f.request(
    `other=value; access_token=${encodeURIComponent(token)}`,
  );
  assert.equal(await f.run(req), true);
  assert.equal(req.user?.id, f.user.id);
  assert.equal(req.user?.role, "owner");
  assert.equal("passwordHash" in req.user!, false);
  f.user.role = "customer";
  assert.equal(await f.run(req), true);
  assert.equal(req.user?.role, "customer");
  assert.equal(f.state.reads, 2);
});

test("JwtAuthGuard rejects current inactive or deleted accounts and clears old principal", async (t) => {
  const f = fixture();
  const token = await f.jwt.sign(f.user.id, "access", false);
  for (const [name, user, expected, code] of [
    ["missing", undefined, 401, undefined],
    ["soft deleted", { ...f.user, deletedAt: new Date() }, 401, undefined],
    ["suspended", { ...f.user, status: "suspended" }, 403, "ACCOUNT_SUSPENDED"],
    ["pending", { ...f.user, status: "pending" }, 403, "FORBIDDEN"],
  ] as const)
    await t.test(name, async () => {
      f.state.user = user;
      const req = f.request(`access_token=${token}`);
      await assert.rejects(f.run(req), status(expected, code));
      assert.equal(req.user, undefined);
    });
  assert.equal(f.state.reads, 4);
});
