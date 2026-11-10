import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Pool } from "pg";
import { v7 } from "uuid";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { AuthService } from "../../src/modules/auth/auth.service.js";
import { AuthRepository } from "../../src/modules/auth/auth.repository.js";
import {
  hashPassword,
  hashToken,
} from "../../src/modules/auth/auth-secrets.js";
import { onSessionInvalidated } from "../../src/modules/auth/session-context.js";
import type { MailRequest } from "../../src/modules/mail/mail.transport.js";
import { MailDeliveryError } from "../../src/modules/mail/mail.transport.js";
import { phase4FixtureIds as ids } from "./phase4.fixture.js";

export class MemoryResetTransport {
  messages: MailRequest[] = [];
  failure = false;
  pause: (() => Promise<void>) | null = null;
  assertConfigured() {}
  async send(request: MailRequest) {
    this.messages.push(structuredClone(request));
    if (this.pause) await this.pause();
    if (this.failure) throw new MailDeliveryError("DELIVERY_AMBIGUOUS", true);
  }
}
export async function runPasswordRecoveryCases(
  t: TestContext,
  app: INestApplication,
  pool: Pool,
  mail: MemoryResetTransport,
  limiter: { enabled: boolean },
) {
  const base = `${await app.getUrl()}/api/v1`,
    auth = app.get(AuthService),
    repo = app.get(AuthRepository),
    config = app.get(ConfigService);
  const originalPassword = "Initial-password-789!",
    nextPassword = "Reset-password-987!",
    initialHash = await hashPassword(originalPassword);
  const email = (
    await pool.query("SELECT email FROM users WHERE id=$1", [
      ids.users.customerA,
    ])
  ).rows[0].email as string;
  const logs: string[] = [];
  app.useLogger({
    log() {},
    warn(message: unknown) {
      logs.push(String(message));
    },
    error(message: unknown) {
      logs.push(String(message));
    },
    debug() {},
    verbose() {},
  });
  const request = (
    path: string,
    body?: unknown,
    cookie?: string,
    extra: Record<string, string> = {},
  ) =>
    fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Origin: "http://localhost:3000",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(cookie ? { Cookie: cookie } : {}),
        ...extra,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(10000),
    });
  const forgot = (address = email) =>
    request("/auth/forgot-password", { email: address });
  const body = (token: string, password = nextPassword) => ({
    token,
    password,
    confirmPassword: password,
  });
  const reset = (token: string, password = nextPassword) =>
    request("/auth/reset-password", body(token, password));
  const drain = () => auth.onModuleDestroy();
  const url = () =>
    new URL(mail.messages.at(-1)!.text.match(/https?:\/\/[^\s]+/)![0]);
  const issue = async () => {
    assert.equal((await forgot()).status, 204);
    await drain();
    return url().searchParams.get("token")!;
  };
  const cookie = (response: Response) =>
    response.headers
      .getSetCookie()
      .map((v) => v.split(";")[0])
      .join("; ");
  const login = () =>
    request("/auth/login", { email, password: originalPassword });
  const state = async () =>
    (
      await pool.query(
        "SELECT password_hash,session_version FROM users WHERE id=$1",
        [ids.users.customerA],
      )
    ).rows[0];
  const countTokens = async () =>
    (await pool.query("SELECT count(*)::int AS n FROM auth_tokens")).rows[0]
      .n as number;
  const insertToken = async (
    type = "password_reset",
    userId = ids.users.customerA,
  ) => {
    const raw = `test-token-${v7()}`;
    await pool.query(
      "INSERT INTO auth_tokens(id,user_id,type,token_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '1 hour')",
      [v7(), userId, type, hashToken(raw)],
    );
    return raw;
  };
  t.beforeEach(async () => {
    await drain();
    limiter.enabled = false;
    mail.messages = [];
    mail.failure = false;
    mail.pause = null;
    logs.length = 0;
    await pool.query("DELETE FROM auth_tokens; DELETE FROM refresh_tokens");
    await pool.query(
      "UPDATE users SET status='active',deleted_at=NULL,session_version=0,password_hash=$2 WHERE id=ANY($1::uuid[])",
      [[ids.users.customerA, ids.users.customerB], initialHash],
    );
  });
  await t.test(
    "204 indistinguishable for existing/missing/suspended/deleted/OAuth-only accounts and DB/mail failure",
    async () => {
      const inputs = [email, "missing@example.test"];
      for (const input of inputs) {
        const response = await forgot(input);
        assert.equal(response.status, 204);
        assert.equal(await response.text(), "");
        assert.equal(response.headers.get("cache-control"), "no-store");
      }
      await drain();
      assert.equal(mail.messages.length, 1);
      for (const mutation of [
        "status='suspended'",
        "deleted_at=now()",
        "password_hash=NULL",
      ]) {
        await pool.query(`UPDATE users SET ${mutation} WHERE id=$1`, [
          ids.users.customerA,
        ]);
        const before = await countTokens();
        const sentCount: number = mail.messages.length;
        assert.equal((await forgot()).status, 204);
        await drain();
        assert.equal(await countTokens(), before);
        assert.equal(mail.messages.length, sentCount);
        await pool.query(
          "UPDATE users SET status='active',deleted_at=NULL,password_hash=$2 WHERE id=$1",
          [ids.users.customerA, initialHash],
        );
      }
      mail.failure = true;
      const failed = await forgot();
      assert.equal(failed.status, 204);
      assert.equal(await failed.text(), "");
      await drain();
      const original = repo.byEmail.bind(repo);
      repo.byEmail = async () => {
        throw new Error("private-db-details");
      };
      try {
        assert.equal((await forgot()).status, 204);
        await drain();
        assert.ok(!logs.join(" ").includes("private-db-details"));
      } finally {
        repo.byEmail = original;
      }
    },
  );
  await t.test(
    "HTTP returns before gated account lookup and provider: timing does not wait for delivery",
    async () => {
      const original = repo.byEmail.bind(repo);
      let release!: () => void;
      const gate = new Promise<void>((r) => {
        release = r;
      });
      let lookups = 0;
      repo.byEmail = async (...args) => {
        lookups++;
        await gate;
        return original(...args);
      };
      try {
        const results = await Promise.all([
          forgot(),
          forgot("missing@example.test"),
        ]);
        assert.ok(results.every((r) => r.status === 204));
        assert.equal(lookups, 2);
        assert.equal(await countTokens(), 0);
      } finally {
        release();
        repo.byEmail = original;
        await drain();
      }
      let sent!: () => void, finish!: () => void;
      const entered = new Promise<void>((r) => {
          sent = r;
        }),
        hold = new Promise<void>((r) => {
          finish = r;
        });
      mail.pause = async () => {
        sent();
        await hold;
      };
      try {
        const response = await forgot();
        assert.equal(response.status, 204);
        await entered;
        assert.equal((await forgot("missing@example.test")).status, 204);
      } finally {
        finish();
        mail.pause = null;
        await drain();
      }
    },
  );
  await t.test(
    "token only hashed, one-hour DB expiry, link fixed allowed origin and latest request invalidates old token",
    async () => {
      const first = await issue();
      assert.match(first, /^[\w-]{43}$/);
      assert.equal(url().origin, "http://localhost:3000");
      assert.equal(url().pathname, "/reset-password");
      const row = (
        await pool.query("SELECT * FROM auth_tokens WHERE token_hash=$1", [
          hashToken(first),
        ])
      ).rows[0];
      assert.equal(row.type, "password_reset");
      assert.equal(row.used_at, null);
      assert.ok(!JSON.stringify(row).includes(first));
      assert.match(row.token_hash, /^[a-f0-9]{64}$/);
      const ttl =
        new Date(row.expires_at).getTime() - new Date(row.created_at).getTime();
      assert.ok(ttl >= 3600000 && ttl < 3601000);
      assert.equal(
        (
          await pool.query(
            "SELECT (SELECT count(*) FROM outbox_deliveries) AS outbox,(SELECT count(*) FROM audit_logs) AS audit",
          )
        ).rows[0].outbox,
        "0",
      );
      const second = await issue();
      assert.notEqual(first, second);
      assert.equal((await reset(first)).status, 401);
      assert.equal((await reset(second)).status, 204);
      assert.ok(!logs.join(" ").includes(second));
    },
  );
  await t.test(
    "missing config/untrusted frontend keep 204, do not revoke existing link or send new token",
    async () => {
      const first = await issue(),
        original = config.get.bind(config),
        sent = mail.messages.length,
        total = await countTokens();
      for (const delta of [
        { RESEND_API_KEY: undefined },
        { AUTH_FRONTEND_URL: "https://evil.example.test" },
        {
          AUTH_FRONTEND_URL:
            "http://localhost:3000/reset-password?redirect=evil",
        },
      ]) {
        config.get = ((key: string) =>
          Object.hasOwn(delta, key)
            ? delta[key as keyof typeof delta]
            : original(key)) as typeof config.get;
        try {
          assert.equal((await forgot()).status, 204);
          await drain();
          assert.equal(mail.messages.length, sent);
          assert.equal(await countTokens(), total);
        } finally {
          config.get = original;
        }
      }
      assert.equal((await reset(first)).status, 204);
    },
  );
  await t.test(
    "recheck OAuth-only under issuance lock; account changes cannot acquire a reset token",
    async () => {
      const original = repo.lockUser.bind(repo);
      let changed = false;
      repo.lockUser = async (tx, id) => {
        if (id === ids.users.customerA && !changed) {
          changed = true;
          await pool.query("UPDATE users SET password_hash=NULL WHERE id=$1", [
            id,
          ]);
        }
        return original(tx, id);
      };
      try {
        assert.equal((await forgot()).status, 204);
        await drain();
        assert.equal(mail.messages.length, 0);
        assert.equal(await countTokens(), 0);
      } finally {
        repo.lockUser = original;
      }
    },
  );
  await t.test(
    "bad/expired/wrong-purpose/reused tokens and invalid password body cannot change hash/version",
    async () => {
      const before = await state();
      for (const raw of ["not-issued", await insertToken("email_verify")])
        assert.equal((await reset(raw)).status, 401);
      const expired = await insertToken();
      await pool.query(
        "UPDATE auth_tokens SET expires_at=now()-interval '1 second' WHERE token_hash=$1",
        [hashToken(expired)],
      );
      assert.equal((await reset(expired)).status, 401);
      for (const payload of [
        { ...body("x"), confirmPassword: "wrong" },
        { ...body("x"), password: "short", confirmPassword: "short" },
        { ...body("x"), email },
        { ...body("x"), userId: ids.users.customerB },
      ])
        assert.equal(
          (await request("/auth/reset-password", payload)).status,
          400,
        );
      assert.equal(
        (
          await request("/auth/forgot-password", {
            email,
            redirect: "https://evil.test",
          })
        ).status,
        400,
      );
      assert.equal(
        (await request("/auth/forgot-password", { email: "bad" })).status,
        400,
      );
      assert.deepEqual(await state(), before);
      const token = await issue();
      assert.equal((await reset(token)).status, 204);
      assert.equal((await reset(token)).status, 401);
    },
  );
  await t.test(
    "suspended/deleted/OAuth-only cannot reset even with issued token",
    async () => {
      for (const mutation of [
        "status='suspended'",
        "deleted_at=now()",
        "password_hash=NULL",
      ]) {
        const token = await insertToken();
        await pool.query(`UPDATE users SET ${mutation} WHERE id=$1`, [
          ids.users.customerA,
        ]);
        const before = await state();
        assert.equal((await reset(token)).status, 401);
        assert.deepEqual(await state(), before);
        assert.equal(
          (
            await pool.query(
              "SELECT used_at FROM auth_tokens WHERE token_hash=$1",
              [hashToken(token)],
            )
          ).rows[0].used_at,
          null,
        );
        await pool.query(
          "UPDATE users SET status='active',deleted_at=NULL,password_hash=$2 WHERE id=$1",
          [ids.users.customerA, initialHash],
        );
      }
    },
  );
  await t.test(
    "two resets yield one commit; old access/refresh/password revoked, new login/refresh succeed",
    async () => {
      const old = await login();
      assert.equal(old.status, 200);
      const oldCookies = cookie(old),
        token = await issue();
      const events: string[] = [];
      const unsubscribe = onSessionInvalidated((id) => events.push(id));
      try {
        const results = await Promise.all([reset(token), reset(token)]);
        assert.deepEqual(results.map((r) => r.status).sort(), [204, 401]);
        const success = results.find((r) => r.status === 204)!;
        assert.equal(await success.text(), "");
        assert.ok(
          success.headers
            .getSetCookie()
            .some((v) => v.startsWith("access_token=;")),
        );
        assert.equal((await state()).session_version, 1);
        assert.deepEqual(events, [ids.users.customerA]);
        assert.equal(
          (await request("/users/me", undefined, oldCookies)).status,
          401,
        );
        assert.equal(
          (await request("/auth/refresh", {}, oldCookies)).status,
          401,
        );
        assert.equal((await login()).status, 401);
        const fresh = await request("/auth/login", {
          email,
          password: nextPassword,
        });
        assert.equal(fresh.status, 200);
        assert.equal(
          (await request("/auth/refresh", {}, cookie(fresh))).status,
          200,
        );
      } finally {
        unsubscribe();
      }
    },
  );
  await t.test(
    "expiry is checked with DB clock after waiting for real user row lock",
    async () => {
      const token = await issue(),
        client = await pool.connect();
      await client.query("BEGIN");
      await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
        ids.users.customerA,
      ]);
      const pending = reset(token);
      let blocked = false;
      try {
        for (let n = 0; n < 200; n++) {
          const rows = await pool.query(
            "SELECT count(*)::int AS n FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND wait_event_type='Lock' AND query LIKE '%users%'",
          );
          if (rows.rows[0].n) {
            blocked = true;
            break;
          }
          await new Promise((r) => setTimeout(r, 10));
        }
        assert.ok(blocked, "reset waits on real user lock");
        await client.query(
          "UPDATE auth_tokens SET expires_at=clock_timestamp()-interval '1 second' WHERE token_hash=$1",
          [hashToken(token)],
        );
        await client.query("COMMIT");
        assert.equal((await pending).status, 401);
        assert.equal((await state()).session_version, 0);
      } finally {
        await client.query("ROLLBACK");
        client.release();
        await pending;
      }
    },
  );
  await t.test(
    "DB failure rolls back token/password/version/refresh and emits no post-commit event",
    async () => {
      const current = await login(),
        oldCookies = cookie(current),
        token = await issue(),
        before = await state(),
        events: string[] = [];
      const unsubscribe = onSessionInvalidated((id) => events.push(id));
      await pool.query(`CREATE FUNCTION reject_reset_revoke() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private-reset-db'; END $$;
      CREATE TRIGGER reject_reset_revoke BEFORE UPDATE ON refresh_tokens FOR EACH ROW EXECUTE FUNCTION reject_reset_revoke()`);
      try {
        const response = await reset(token);
        assert.equal(response.status, 500);
        assert.ok(
          !JSON.stringify(await response.json()).includes("private-reset-db"),
        );
        assert.deepEqual(await state(), before);
        assert.equal(
          (
            await pool.query(
              "SELECT used_at FROM auth_tokens WHERE token_hash=$1",
              [hashToken(token)],
            )
          ).rows[0].used_at,
          null,
        );
        assert.deepEqual(events, []);
        assert.equal(
          (await request("/users/me", undefined, oldCookies)).status,
          200,
        );
        assert.ok(!logs.join(" ").includes("private-reset-db"));
      } finally {
        unsubscribe();
        await pool.query(
          "DROP TRIGGER reject_reset_revoke ON refresh_tokens; DROP FUNCTION reject_reset_revoke()",
        );
      }
      assert.equal(
        (await request("/auth/refresh", {}, oldCookies)).status,
        200,
      );
      assert.equal((await reset(token)).status, 204);
    },
  );
  await t.test(
    "bounded pending queue returns account-independent 429 and drains safely",
    async () => {
      const original = repo.byEmail.bind(repo);
      let release!: () => void;
      const gate = new Promise<void>((r) => {
        release = r;
      });
      repo.byEmail = async (...args) => {
        await gate;
        return original(...args);
      };
      try {
        for (let n = 0; n < 100; n++)
          auth.forgotPassword(`missing-${n}@example.test`);
        assert.equal((await forgot()).status, 429);
        assert.equal((await forgot("missing@example.test")).status, 429);
      } finally {
        release();
        repo.byEmail = original;
        await drain();
      }
      assert.equal((await forgot("missing@example.test")).status, 204);
      await drain();
    },
  );
  await t.test(
    "real per-IP auth limiter applies equally to known/missing email, independent of spoofed forwarding",
    async () => {
      limiter.enabled = true;
      try {
        for (let n = 0; n < 10; n++)
          assert.equal(
            (await forgot(n % 2 ? email : "missing@example.test")).status,
            204,
          );
        for (const address of [email, "missing@example.test"]) {
          const response = await request(
            "/auth/forgot-password",
            { email: address },
            undefined,
            { "X-Forwarded-For": v7() },
          );
          assert.equal(response.status, 429);
          assert.equal(
            ((await response.json()) as { error: { code: string } }).error.code,
            "RATE_LIMIT_EXCEEDED",
          );
        }
      } finally {
        limiter.enabled = false;
        await drain();
      }
    },
  );
  await t.test(
    "Swagger/OpenAPI existing forgot/reset routes document 204/errors and strict input",
    async () => {
      const doc = SwaggerModule.createDocument(
        app,
        new DocumentBuilder().build(),
      );
      const specUrl = new URL(
        "../../../../docs/openapi/phase-04.openapi.json",
        import.meta.url,
      );
      const spec = existsSync(specUrl)
        ? JSON.parse(await readFile(specUrl, "utf8"))
        : null;
      for (const path of ["/auth/forgot-password", "/auth/reset-password"]) {
        const op = doc.paths[`/api/v1${path}`]?.post;
        assert.ok(op?.responses["204"]);
        if (spec) {
          assert.ok(spec.paths[path].post.responses["429"]);
        }
        const request = op.requestBody;
        assert.ok(request && "content" in request);
        const schema = request.content["application/json"]!.schema;
        assert.ok(schema && "properties" in schema);
        assert.equal(schema.additionalProperties, false);
      }
    },
  );
}
