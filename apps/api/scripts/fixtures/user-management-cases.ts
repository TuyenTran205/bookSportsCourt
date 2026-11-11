import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import type { INestApplication } from "@nestjs/common";
import type { Pool } from "pg";
import type { Socket } from "socket.io";
import { v7 } from "uuid";
import { SignJWT } from "jose";
import { AuthService } from "../../src/modules/auth/auth.service.js";
import { AuthJwtService } from "../../src/modules/auth/auth-jwt.service.js";
import { RealtimeSessionsService } from "../../src/modules/auth/realtime-sessions.service.js";
import { UsersRepository } from "../../src/modules/users/users.repository.js";
import { PaymentsRepository } from "../../src/modules/payments/payments.repository.js";
import {
  hashPassword,
  hashToken,
} from "../../src/modules/auth/auth-secrets.js";
import { phase4FixtureIds as ids } from "./phase4.fixture.js";
import {
  userAdminDetailSchema,
  userListItemSchema,
  phase4ListEnvelope,
  phase4DataEnvelope,
  phase4ErrorEnvelopeSchema,
} from "../../../../packages/shared/src/phase4-responses.js";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
type Request = (
  path: string,
  who?: string,
  method?: string,
  body?: unknown,
) => Promise<Response>;
class TestSocket {
  handshake: { headers: { cookie: string; origin?: string } };
  data: Record<string, unknown> = {};
  disconnected = false;
  sent: unknown[] = [];
  private closed: () => void = () => {};
  packet: (packet: unknown[], next: (error?: Error) => void) => void = () => {};
  constructor(token: string) {
    this.handshake = { headers: { cookie: `access_token=${token}` } };
  }
  once(_event: string, callback: () => void) {
    this.closed = callback;
  }
  use(callback: typeof this.packet) {
    this.packet = callback;
  }
  emit(event: string, payload: unknown) {
    this.sent.push({ event, payload });
  }
  disconnect() {
    this.disconnected = true;
    this.closed();
  }
}
export async function runUserManagementCases(
  t: TestContext,
  app: INestApplication,
  pool: Pool,
  request: Request,
) {
  const auth = app.get(AuthService),
    jwt = app.get(AuthJwtService),
    repo = app.get(UsersRepository),
    payments = app.get(PaymentsRepository),
    realtime = app.get(RealtimeSessionsService);
  const owner = ids.users.ownerA,
    route = `/users/${owner}/status`,
    password = "Owner-test-password-123!",
    passwordHash = await hashPassword(password);
  await pool.query(
    "UPDATE users SET password_hash=$2,phone='0901234567' WHERE id=$1",
    [owner, passwordHash],
  );
  const reset = async () => {
    realtime.disconnectUser(owner);
    await pool.query(
      "UPDATE users SET status='active',role='owner',deleted_at=NULL,session_version=0,password_hash=$2 WHERE id=$1",
      [owner, passwordHash],
    );
    await pool.query("DELETE FROM refresh_tokens WHERE user_id=$1", [owner]);
    await pool.query("DELETE FROM audit_logs WHERE entity_id=$1", [owner]);
  };
  const state = async () =>
    (
      await pool.query(
        "SELECT status,role,session_version,updated_at FROM users WHERE id=$1",
        [owner],
      )
    ).rows[0];
  const counts = async () =>
    (
      await pool.query(
        "SELECT count(*)::int AS n FROM audit_logs WHERE entity_id=$1",
        [owner],
      )
    ).rows[0].n;
  const issue = async () => {
    const row = (
      await pool.query("SELECT email FROM users WHERE id=$1", [owner])
    ).rows[0];
    return auth.login({ email: row.email, password, rememberMe: false });
  };
  const base = `${await app.getUrl()}/api/v1`;
  const withToken = (
    path: string,
    token: string | undefined,
    method = "GET",
    body?: unknown,
    refresh?: string,
  ) =>
    fetch(base + path, {
      method,
      headers: {
        "X-Request-Origin": "http://localhost:3000",
        Cookie: [
          token ? `access_token=${token}` : "",
          refresh ? `refresh_token=${refresh}` : "",
        ]
          .filter(Boolean)
          .join("; "),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(10000),
    });
  const token = async () =>
    jwt.sign(owner, "access", false, (await state()).session_version);
  const attach = async (raw: string) => {
    const socket = new TestSocket(raw);
    await realtime.register(socket as unknown as Socket);
    return socket;
  };
  await t.test(
    "Admin-only list/detail, literal search, safe pagination and allowlisted PII",
    async () => {
      await reset();
      assert.equal((await request("/admin/users")).status, 401);
      for (const who of ["ownerA", "customerA"]) {
        assert.equal((await request("/admin/users", who)).status, 403);
        assert.equal((await request(`/users/${owner}`, who)).status, 403);
        assert.equal(
          (await request(route, who, "PATCH", { status: "suspended" })).status,
          403,
        );
      }
      assert.equal((await request("/users/me", "customerA")).status, 200);
      for (const q of [
        "role=invalid",
        "status=invalid",
        "limit=101",
        "page=1x",
        "role=owner&role=customer",
        "ownerId=" + owner,
      ])
        assert.equal(
          (await request("/admin/users?" + q, "adminA")).status,
          400,
        );
      const list = phase4ListEnvelope(userListItemSchema).parse(
        await (
          await request("/admin/users?role=owner&limit=1", "adminA")
        ).json(),
      );
      assert.equal(list.data.length, 1);
      assert.ok(list.meta.total >= 2);
      assert.equal("phone" in list.data[0]!, false);
      const detail = phase4DataEnvelope(userAdminDetailSchema).parse(
        await (await request(`/users/${owner}`, "adminA")).json(),
      ).data;
      assert.equal(detail.phone, "0901234567");
      assert.equal(detail.phoneMasked, "*******567");
      for (const field of [
        "passwordHash",
        "sessionVersion",
        "proofUrl",
        "bankAccount",
      ])
        assert.equal(field in detail, false);
      const literal = v7();
      await pool.query(
        "INSERT INTO users(id,email,full_name,status) VALUES($1,$2,$3,'pending')",
        [literal, `${literal}@test.example`, "Literal 100%_\\ Name"],
      );
      const found = phase4ListEnvelope(userListItemSchema).parse(
        await (
          await request(
            "/admin/users?q=" + encodeURIComponent("100%_\\"),
            "adminA",
          )
        ).json(),
      );
      assert.equal(found.meta.total, 1);
      assert.equal(found.data[0]!.id, literal);
      const empty = phase4ListEnvelope(userListItemSchema).parse(
        await (
          await request("/admin/users?q=absent-never-match", "adminA")
        ).json(),
      );
      assert.equal(empty.meta.totalPages, 0);
      const huge = phase4ListEnvelope(userListItemSchema).parse(
        await (
          await request(
            "/admin/users?page=9007199254740991&limit=100",
            "adminA",
          )
        ).json(),
      );
      assert.deepEqual(huge.data, []);
    },
  );
  await t.test(
    "protect all Admins including self, validate strict status, hide deleted targets",
    async () => {
      await reset();
      for (const actor of ["adminA", "adminB"])
        for (const target of [ids.users.adminA, ids.users.adminB])
          assert.equal(
            (
              await request(`/users/${target}/status`, actor, "PATCH", {
                status: "suspended",
              })
            ).status,
            403,
          );
      for (const body of [
        { status: "pending" },
        { status: "suspended", role: "owner" },
        { status: "suspended", sessionVersion: 9 },
        {},
      ]) {
        const response = await request(route, "adminA", "PATCH", body);
        assert.equal(response.status, 400);
        phase4ErrorEnvelopeSchema.parse(await response.json());
      }
      assert.equal(
        (await request(`/users/${v7()}/status`, "adminA", "PATCH", {})).status,
        404,
      );
      assert.equal(
        (
          await request("/users/bad-id/status", "adminA", "PATCH", {
            status: "suspended",
          })
        ).status,
        400,
      );
      await pool.query(
        "UPDATE users SET deleted_at=clock_timestamp() WHERE id=$1",
        [owner],
      );
      assert.equal((await request(`/users/${owner}`, "adminA")).status, 404);
      assert.equal(
        (await request(route, "adminA", "PATCH", { status: "active" })).status,
        404,
      );
      await reset();
    },
  );
  await t.test(
    "suspend revokes every refresh and access; activate never restores old sessions; no-op is stable",
    async () => {
      await reset();
      const old = await issue();
      await issue();
      const before = (
        await pool.query("SELECT id,status FROM bookings ORDER BY id")
      ).rows;
      assert.equal(
        (await request(route, "adminA", "PATCH", { status: "suspended" }))
          .status,
        200,
      );
      assert.equal((await state()).session_version, 1);
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM refresh_tokens WHERE user_id=$1 AND NOT revoked",
            [owner],
          )
        ).rows[0].n,
        0,
      );
      for (const [path, method, body, refresh] of [
        ["/users/me", "GET", undefined, undefined],
        ["/owner/venues", "GET", undefined, undefined],
        ["/users/me", "PATCH", { fullName: "Forbidden" }, undefined],
        ["/auth/refresh", "POST", {}, old.refreshToken],
      ] as const)
        assert.equal(
          (await withToken(path, old.accessToken, method, body, refresh))
            .status,
          403,
        );
      const suspended = await state();
      assert.equal(
        (await request(route, "adminB", "PATCH", { status: "suspended" }))
          .status,
        200,
      );
      assert.deepEqual(await state(), suspended);
      assert.equal(await counts(), 1);
      assert.equal(
        (await request(route, "adminA", "PATCH", { status: "active" })).status,
        200,
      );
      assert.equal((await state()).session_version, 1);
      assert.equal((await withToken("/users/me", old.accessToken)).status, 401);
      assert.equal(
        (
          await withToken("/users/me", old.accessToken, "PATCH", {
            fullName: "Forbidden",
          })
        ).status,
        401,
      );
      assert.equal(
        (
          await withToken(
            "/auth/refresh",
            undefined,
            "POST",
            {},
            old.refreshToken,
          )
        ).status,
        401,
      );
      const active = await state();
      await request(route, "adminB", "PATCH", { status: "active" });
      assert.deepEqual(await state(), active);
      assert.equal(await counts(), 2);
      const next = await issue();
      assert.equal(
        (await withToken("/users/me", next.accessToken)).status,
        200,
      );
      assert.equal(
        (await jwt.verify(next.accessToken, "access")).sessionVersion,
        1,
      );
      assert.equal(
        (await jwt.verify(next.refreshToken, "refresh")).sessionVersion,
        1,
      );
      assert.deepEqual(
        (await pool.query("SELECT id,status FROM bookings ORDER BY id")).rows,
        before,
      );
    },
  );
  await t.test(
    "legacy JWT version zero accepted only before invalidation; malformed version denied",
    async () => {
      await reset();
      const sign = (version: unknown, legacy = false) =>
        new SignJWT({
          kind: "access",
          ...(legacy ? {} : { sessionVersion: version }),
        })
          .setProtectedHeader({ alg: "HS256" })
          .setSubject(owner)
          .setJti(v7())
          .setIssuer("booksportscourt")
          .setAudience("booksportscourt-api")
          .setIssuedAt()
          .setExpirationTime("15m")
          .sign(new TextEncoder().encode(process.env.JWT_ACCESS_SECRET));
      const legacy = await sign(undefined, true);
      assert.equal((await withToken("/users/me", legacy)).status, 200);
      for (const v of [-1, 1.5, "0", null])
        assert.equal((await withToken("/users/me", await sign(v))).status, 401);
      await request(route, "adminA", "PATCH", { status: "suspended" });
      await request(route, "adminA", "PATCH", { status: "active" });
      assert.equal((await withToken("/users/me", legacy)).status, 401);
    },
  );
  await t.test(
    "two Admins suspend once, while Admin-to-Admin mutations remain forbidden",
    async () => {
      await reset();
      const results = await Promise.all([
        request(route, "adminA", "PATCH", { status: "suspended" }),
        request(route, "adminB", "PATCH", { status: "suspended" }),
      ]);
      assert.deepEqual(
        results.map((r) => r.status),
        [200, 200],
      );
      assert.equal((await state()).session_version, 1);
      assert.equal(await counts(), 1);
      const pair = await Promise.all([
        request(`/users/${ids.users.adminA}/status`, "adminB", "PATCH", {
          status: "suspended",
        }),
        request(`/users/${ids.users.adminB}/status`, "adminA", "PATCH", {
          status: "suspended",
        }),
      ]);
      assert.deepEqual(
        pair.map((r) => r.status),
        [403, 403],
      );
    },
  );
  await t.test(
    "suspend/activate between guard and payment transaction cannot reuse old version",
    async () => {
      await reset();
      const original = payments.lockUsers.bind(payments);
      let entered = false;
      payments.lockUsers = async (tx, ids) => {
        if (!entered) {
          entered = true;
          assert.equal(
            (await request(route, "adminA", "PATCH", { status: "suspended" }))
              .status,
            200,
          );
          assert.equal(
            (await request(route, "adminA", "PATCH", { status: "active" }))
              .status,
            200,
          );
        }
        return original(tx, ids);
      };
      try {
        assert.equal(
          (
            await request(
              `/owner/payments/${ids.payments.submitted}/approve`,
              "ownerA",
              "PATCH",
              {},
            )
          ).status,
          401,
        );
        assert.equal(
          (
            await pool.query("SELECT status FROM payments WHERE id=$1", [
              ids.payments.submitted,
            ])
          ).rows[0].status,
          "submitted",
        );
      } finally {
        payments.lockUsers = original;
      }
    },
  );
  async function gateRace(
    kind: "payment" | "suspend",
    first: () => Promise<Response>,
    second: () => Promise<Response>,
  ) {
    let entered!: () => void, release!: () => void;
    const ready = new Promise<void>((r) => {
        entered = r;
      }),
      gate = new Promise<void>((r) => {
        release = r;
      });
    const originalNow = payments.now.bind(payments),
      originalStatus = repo.status.bind(repo);
    let used = false;
    const pause = async () => {
      if (!used) {
        used = true;
        entered();
        await gate;
      }
    };
    if (kind === "payment")
      payments.now = async (tx) => {
        await pause();
        return originalNow(tx);
      };
    else
      repo.status = async (tx, id, status) => {
        await pause();
        return originalStatus(tx, id, status);
      };
    const a = first();
    try {
      await Promise.race([
        ready,
        new Promise((_, reject) =>
          setTimeout(() => reject(Error("gate timeout")), 5000),
        ),
      ]);
      const b = second();
      let blocked = false;
      for (let n = 0; n < 100; n++) {
        const r = await pool.query(
          "SELECT count(*)::int AS n FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND wait_event_type='Lock' AND query LIKE '%users%'",
        );
        if (r.rows[0].n) {
          blocked = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 10));
      }
      assert.ok(blocked, "competitor waits on a real user row lock");
      release();
      return await Promise.all([a, b]);
    } finally {
      release();
      payments.now = originalNow;
      repo.status = originalStatus;
    }
  }
  await t.test(
    "payment/suspend use common lock order in both commit orders",
    async () => {
      const payment = ids.payments.submitted,
        booking = ids.bookings.submitted;
      const resetPayment = async () => {
        await pool.query("DELETE FROM audit_logs WHERE entity_id=$1", [
          payment,
        ]);
        await pool.query("DELETE FROM notifications WHERE event_key LIKE $1", [
          `payment:${payment}:%`,
        ]);
        await pool.query(
          "DELETE FROM outbox_deliveries WHERE event_key LIKE $1",
          [`payment:${payment}:%`],
        );
        await pool.query(
          "UPDATE bookings SET status='pending_payment' WHERE id=$1",
          [booking],
        );
        await pool.query(
          "UPDATE payments SET status='submitted',reviewed_by=NULL,reviewed_at=NULL,paid_at=NULL WHERE id=$1",
          [payment],
        );
      };
      await reset();
      await resetPayment();
      let results = await gateRace(
        "suspend",
        () => request(route, "adminA", "PATCH", { status: "suspended" }),
        () =>
          request(`/owner/payments/${payment}/approve`, "ownerA", "PATCH", {}),
      );
      assert.deepEqual(
        results.map((r) => r.status),
        [200, 403],
      );
      assert.equal(
        (await pool.query("SELECT status FROM payments WHERE id=$1", [payment]))
          .rows[0].status,
        "submitted",
      );
      await reset();
      results = await gateRace(
        "payment",
        () =>
          request(`/owner/payments/${payment}/approve`, "ownerA", "PATCH", {}),
        () => request(route, "adminA", "PATCH", { status: "suspended" }),
      );
      assert.deepEqual(
        results.map((r) => r.status),
        [200, 200],
      );
      assert.equal(
        (await pool.query("SELECT status FROM payments WHERE id=$1", [payment]))
          .rows[0].status,
        "completed",
      );
      assert.equal(
        (await pool.query("SELECT status FROM bookings WHERE id=$1", [booking]))
          .rows[0].status,
        "confirmed",
      );
    },
  );
  await t.test(
    "audit failure rolls back status/version/refresh and never disconnects before commit",
    async () => {
      await reset();
      const session = await issue(),
        socket = await attach(session.accessToken);
      await pool.query(
        "CREATE FUNCTION fail_user_audit_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_id='" +
          owner +
          "' THEN RAISE EXCEPTION 'private user diagnostic'; END IF; RETURN NEW; END $$",
      );
      await pool.query(
        "CREATE TRIGGER fail_user_audit_test BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION fail_user_audit_test()",
      );
      try {
        const response = await request(route, "adminA", "PATCH", {
          status: "suspended",
        });
        assert.equal(response.status, 500);
        assert.ok(
          !JSON.stringify(await response.json()).includes("private user"),
        );
        assert.equal((await state()).status, "active");
        assert.equal((await state()).session_version, 0);
        assert.equal(
          (
            await pool.query(
              "SELECT revoked FROM refresh_tokens WHERE token_hash=$1",
              [hashToken(session.refreshToken)],
            )
          ).rows[0].revoked,
          false,
        );
        assert.equal(socket.disconnected, false);
        assert.equal(await counts(), 0);
      } finally {
        await pool.query(
          "DROP TRIGGER fail_user_audit_test ON audit_logs; DROP FUNCTION fail_user_audit_test()",
        );
        socket.disconnect();
      }
    },
  );
  await t.test(
    "socket handshake, packet and pre-send checks deny revoked versions even without local signal",
    async () => {
      await reset();
      const denied = new TestSocket(await token());
      denied.handshake.headers.origin = "https://untrusted.example";
      await assert.rejects(() =>
        realtime.register(denied as unknown as Socket),
      );
      const old = await token();
      let socket = await attach(old);
      assert.equal(
        await realtime.sendPrivate(owner, "private_test", { id: owner }),
        1,
      );
      await request(route, "adminA", "PATCH", { status: "suspended" });
      assert.equal(socket.disconnected, true);
      assert.equal(await realtime.sendPrivate(owner, "private_test", {}), 0);
      await request(route, "adminA", "PATCH", { status: "active" });
      await assert.rejects(() => attach(old));
      socket = await attach(await token());
      await pool.query(
        "UPDATE users SET session_version=session_version+1 WHERE id=$1",
        [owner],
      );
      const packetError = await new Promise<Error | undefined>((resolve) =>
        socket.packet(["private_action"], resolve),
      );
      assert.ok(packetError);
      assert.equal(socket.disconnected, true);
      socket = await attach(await token());
      await pool.query(
        "UPDATE users SET session_version=session_version+1 WHERE id=$1",
        [owner],
      );
      assert.equal(await realtime.sendPrivate(owner, "private_test", {}), 0);
      assert.equal(socket.sent.length, 0);
      assert.equal(socket.disconnected, true);
      socket = await attach(await token());
      await pool.query("UPDATE users SET role='customer' WHERE id=$1", [owner]);
      await realtime.sweep();
      assert.equal(socket.disconnected, true);
      await reset();
      socket = await attach(await token());
      const staleHandler = new Promise<void>((resolve, reject) =>
        socket.packet(["mutation"], (error) => {
          if (error) return reject(error);
          // Async handler inherits the packet's version even after a suspend/activate cycle.
          void (async () => {
            await request(route, "adminA", "PATCH", { status: "suspended" });
            await request(route, "adminA", "PATCH", { status: "active" });
            await auth.requireActiveUser(owner);
          })().then(resolve, reject);
        }),
      );
      await assert.rejects(
        staleHandler,
        (error) =>
          typeof error === "object" &&
          error !== null &&
          "getStatus" in error &&
          (error.getStatus as () => number)() === 401,
      );
    },
  );
  await t.test(
    "change/reset password bump version, revoke refresh and disconnect; OAuth-only reset issues no token",
    async () => {
      await reset();
      let current = await issue();
      let socket = await attach(current.accessToken);
      const changed = "Changed-owner-password-456!";
      assert.equal(
        (
          await withToken("/users/me/password", current.accessToken, "PATCH", {
            currentPassword: password,
            newPassword: changed,
            confirmPassword: changed,
          })
        ).status,
        204,
      );
      assert.equal((await state()).session_version, 1);
      assert.equal(socket.disconnected, true);
      assert.equal(
        (await withToken("/users/me", current.accessToken)).status,
        401,
      );
      const email = (
        await pool.query("SELECT email FROM users WHERE id=$1", [owner])
      ).rows[0].email;
      current = await auth.login({
        email,
        password: changed,
        rememberMe: false,
      });
      socket = await attach(current.accessToken);
      const raw = "test-reset-" + v7();
      await pool.query(
        "INSERT INTO auth_tokens(id,user_id,type,token_hash,expires_at) VALUES($1,$2,'password_reset',$3,clock_timestamp()+interval '1 hour')",
        [v7(), owner, hashToken(raw)],
      );
      const resetBody = { token: raw, password, confirmPassword: password };
      assert.equal(
        (await withToken("/auth/reset-password", undefined, "POST", resetBody))
          .status,
        204,
      );
      assert.equal((await state()).session_version, 2);
      assert.equal(socket.disconnected, true);
      assert.equal(
        (
          await withToken(
            "/auth/refresh",
            undefined,
            "POST",
            {},
            current.refreshToken,
          )
        ).status,
        401,
      );
      assert.equal(
        (await withToken("/auth/reset-password", undefined, "POST", resetBody))
          .status,
        401,
      );
      await pool.query("UPDATE users SET password_hash=NULL WHERE id=$1", [
        owner,
      ]);
      const before = (
        await pool.query(
          "SELECT count(*)::int AS n FROM auth_tokens WHERE user_id=$1",
          [owner],
        )
      ).rows[0].n;
      auth.forgotPassword(email);
      await auth.onModuleDestroy();
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM auth_tokens WHERE user_id=$1",
            [owner],
          )
        ).rows[0].n,
        before,
      );
    },
  );
  await t.test(
    "Swagger includes user routes without shadowing static me",
    async () => {
      const doc = SwaggerModule.createDocument(
        app,
        new DocumentBuilder().build(),
      );
      assert.ok(doc.paths["/api/v1/admin/users"]?.get);
      assert.ok(doc.paths["/api/v1/users/{id}"]?.get);
      assert.ok(doc.paths["/api/v1/users/{id}/status"]?.patch);
      assert.ok(doc.paths["/api/v1/users/me"]?.get);
    },
  );
}
