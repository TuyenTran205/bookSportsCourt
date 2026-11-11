import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import type { Pool } from "pg";
import { v7 } from "uuid";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { googleDigest } from "../../src/modules/auth/google-identity.provider.js";
import { GoogleOAuthRepository } from "../../src/modules/auth/google-oauth.repository.js";
import {
  AuthCookies,
  type AuthResponse,
} from "../../src/modules/auth/auth-http.js";
import { phase4FixtureIds as ids } from "./phase4.fixture.js";
import type { FakeGoogleProvider } from "./google-provider.fixture.js";
import type { JWTPayload } from "jose";

export async function runGoogleOAuthCases(
  t: TestContext,
  app: INestApplication,
  pool: Pool,
  provider: FakeGoogleProvider,
) {
  const base = `${await app.getUrl()}/api/v1`,
    repo = app.get(GoogleOAuthRepository);
  const call = (path: string, cookie?: string) =>
    fetch(base + path, {
      redirect: "manual",
      headers: cookie ? { Cookie: cookie } : {},
      signal: AbortSignal.timeout(15000),
    });
  const cookies = (response: Response) => response.headers.getSetCookie();
  const named = (response: Response, name: string) =>
    cookies(response)
      .find((v) => v.startsWith(name + "="))
      ?.split(";")[0];
  const begin = async (claims: JWTPayload = {}) => {
    const response = await call("/auth/google");
    assert.equal(response.status, 302);
    const url = new URL(response.headers.get("location")!);
    const state = url.searchParams.get("state")!,
      code = v7();
    const binding = named(response, "google_oauth_binding")!;
    assert.ok(binding);
    provider.register(code, url, {
      sub: `sub-${v7()}`,
      email: `${v7()}@google.example.test`,
      ...claims,
    });
    return { response, url, state, code, binding };
  };
  const callback = (flow: Awaited<ReturnType<typeof begin>>, suffix = "") =>
    call(
      `/auth/google/callback?state=${flow.state}&code=${flow.code}${suffix}`,
      flow.binding,
    );
  const counts = async () =>
    (
      await pool.query(
        "SELECT (SELECT count(*)::int FROM users) AS users,(SELECT count(*)::int FROM oauth_accounts) AS accounts,(SELECT count(*)::int FROM refresh_tokens) AS sessions",
      )
    ).rows[0];

  await t.test(
    "start state encrypted/hashed, nonce/PKCE parameters, strict redirect and binding cookies",
    async () => {
      const flow = await begin();
      assert.equal(flow.url.origin, "https://accounts.google.com");
      assert.equal(flow.url.pathname, "/o/oauth2/v2/auth");
      assert.equal(flow.url.searchParams.get("code_challenge_method"), "S256");
      assert.equal(flow.url.searchParams.get("scope"), "openid email profile");
      assert.equal(
        flow.url.searchParams.get("redirect_uri"),
        "http://localhost:3001/api/v1/auth/google/callback",
      );
      assert.ok(!flow.url.toString().includes("test-not-real"));
      const state = (
        await pool.query("SELECT * FROM oauth_states WHERE state_hash=$1", [
          googleDigest(flow.state),
        ])
      ).rows[0];
      assert.equal(
        state.nonce_hash,
        googleDigest(flow.url.searchParams.get("nonce")!),
      );
      assert.equal(
        state.binding_hash,
        googleDigest(flow.binding.split("=")[1]!),
      );
      assert.ok(!JSON.stringify(state).includes(flow.state));
      assert.match(state.pkce_verifier_ciphertext, /^[\w-]+\.[\w-]+\.[\w-]+$/);
      assert.equal(state.used_at, null);
      assert.equal(
        new Date(state.expires_at).getTime() -
          new Date(state.created_at).getTime(),
        600000,
      );
      const set = cookies(flow.response).join(";");
      assert.match(set, /HttpOnly/i);
      assert.match(set, /SameSite=Lax/i);
      assert.match(set, /Max-Age=600/i);
      assert.ok(!set.includes("Secure"));
      assert.equal(flow.response.headers.get("cache-control"), "no-store");
      assert.equal(flow.response.headers.get("referrer-policy"), "no-referrer");
      for (const query of [
        "?redirect=https://evil.test",
        "?returnTo=//evil.test",
        "?role=admin",
      ])
        assert.equal((await call(`/auth/google${query}`)).status, 400);
    },
  );
  await t.test(
    "new verified Google identity becomes Customer, cookies/me/refresh use existing auth",
    async () => {
      const before = await counts(),
        flow = await begin({ role: "admin", email: "NEW-GOOGLE@example.test" });
      const response = await callback(
        flow,
        "&scope=openid%20email&authuser=0&prompt=consent",
      );
      assert.equal(response.status, 302);
      assert.equal(response.headers.get("location"), "http://localhost:3000/");
      const access = named(response, "access_token")!,
        refresh = named(response, "refresh_token")!;
      assert.ok(access && refresh);
      assert.ok(!response.headers.get("location")!.includes("token"));
      for (const value of cookies(response).filter((v) =>
        /^(access_token|refresh_token)=/.test(v),
      )) {
        assert.match(value, /HttpOnly/);
        assert.match(value, /SameSite=Lax/);
        assert.ok(!/Max-Age=/.test(value));
      }
      assert.ok(
        cookies(response).some(
          (v) =>
            v.startsWith("google_oauth_binding=;") && v.includes("Expires="),
        ),
      );
      const user = (
        (await (await call("/users/me", access)).json()) as {
          data: { id: string; role: string; email: string };
        }
      ).data;
      assert.equal(user.role, "customer");
      assert.equal(user.email, "new-google@example.test");
      const row = (
        await pool.query("SELECT * FROM users WHERE id=$1", [user.id])
      ).rows[0];
      assert.equal(row.password_hash, null);
      assert.ok(row.email_verified_at);
      assert.equal(row.status, "active");
      const after = await counts();
      assert.equal(after.users, before.users + 1);
      assert.equal(after.accounts, before.accounts + 1);
      assert.equal(after.sessions, before.sessions + 1);
      const rotated = await fetch(base + "/auth/refresh", {
        method: "POST",
        headers: { Cookie: refresh, Origin: "http://localhost:3000" },
      });
      assert.equal(rotated.status, 200);
      assert.ok(named(rotated, "access_token"));
      const stored = (
        await pool.query(
          "SELECT pkce_verifier_ciphertext,used_at FROM oauth_states WHERE state_hash=$1",
          [googleDigest(flow.state)],
        )
      ).rows[0];
      assert.equal(stored.pkce_verifier_ciphertext, "consumed");
      assert.ok(stored.used_at);
    },
  );
  await t.test(
    "state missing/wrong/expired/replayed or browser binding mismatch never exchanges code",
    async () => {
      const flow = await begin(),
        calls = provider.calls;
      assert.equal(
        (
          await call(
            `/auth/google/callback?state=${flow.state}&code=${flow.code}`,
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await call(
            `/auth/google/callback?state=${flow.state}&code=${flow.code}`,
            "google_oauth_binding=" + "a".repeat(43),
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await call(
            `/auth/google/callback?state=bad&code=${flow.code}`,
            flow.binding,
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await call(
            `/auth/google/callback?state=${flow.state}&code=${flow.code}&code=duplicate`,
            flow.binding,
          )
        ).status,
        400,
      );
      assert.equal(provider.calls, calls);
      assert.equal((await callback(flow)).status, 302);
      assert.equal((await callback(flow)).status, 400);
      const expired = await begin();
      await pool.query(
        "UPDATE oauth_states SET created_at=now()-interval '11 minutes',expires_at=now()-interval '1 minute' WHERE state_hash=$1",
        [googleDigest(expired.state)],
      );
      const count = provider.calls;
      assert.equal((await callback(expired)).status, 400);
      assert.equal(provider.calls, count);
    },
  );
  await t.test(
    "denied/provider failure/tampered ciphertext consume state, no session and no sensitive errors",
    async () => {
      const before = await counts(),
        denied = await begin();
      assert.equal(
        (
          await call(
            `/auth/google/callback?state=${denied.state}&error=access_denied&error_description=private-info`,
            denied.binding,
          )
        ).status,
        503,
      );
      assert.equal((await callback(denied)).status, 400);
      const bad = await begin();
      const response = await call(
        `/auth/google/callback?state=${bad.state}&code=unregistered-secret`,
        bad.binding,
      );
      assert.equal(response.status, 503);
      assert.ok(
        !JSON.stringify(await response.json()).includes("unregistered-secret"),
      );
      assert.equal((await callback(bad)).status, 400);
      const cipher = await begin();
      await pool.query(
        "UPDATE oauth_states SET pkce_verifier_ciphertext='tampered' WHERE state_hash=$1",
        [googleDigest(cipher.state)],
      );
      assert.equal((await callback(cipher)).status, 400);
      assert.deepEqual(await counts(), before);
    },
  );
  await t.test(
    "invalid token nonce/email/verified claim cannot create an account or session",
    async () => {
      const before = await counts();
      for (const [claims, status] of [
        [{ nonce: "wrong" }, 401],
        [{ email_verified: false }, 403],
        [{ email: undefined }, 403],
        [{ email: "bad" }, 403],
        [{ aud: "wrong" }, 401],
        [{ iss: "https://evil.test" }, 401],
      ] as const) {
        const flow = await begin(claims);
        const response = await callback(flow);
        assert.equal(response.status, status);
        assert.ok(!named(response, "access_token"));
        assert.equal((await callback(flow)).status, 400);
      }
      assert.deepEqual(await counts(), before);
    },
  );
  await t.test(
    "verified email collision never auto-links a password account",
    async () => {
      const email = (
        await pool.query("SELECT email FROM users WHERE id=$1", [
          ids.users.customerA,
        ])
      ).rows[0].email;
      const before = await counts(),
        flow = await begin({ email });
      const response = await callback(flow);
      assert.equal(response.status, 409);
      assert.equal(
        ((await response.json()) as { error: { code: string } }).error.code,
        "EMAIL_ALREADY_EXISTS",
      );
      assert.deepEqual(await counts(), before);
    },
  );
  await t.test(
    "linked provider is stable by sub, preserves Owner/Admin role and rejects inactive/deleted users",
    async () => {
      for (const [user, status] of [
        [ids.users.ownerA, 302],
        [ids.users.adminA, 302],
        [ids.users.suspendedOwner, 403],
      ] as const) {
        const subject = `linked-${user}`;
        await pool.query(
          "INSERT INTO oauth_accounts(id,user_id,provider,provider_id) VALUES($1,$2,'google',$3)",
          [v7(), user, subject],
        );
        const before = await counts(),
          flow = await begin({
            sub: subject,
            email: `changed-${v7()}@example.test`,
          });
        const response = await callback(flow);
        assert.equal(response.status, status);
        const after = await counts();
        assert.equal(after.users, before.users);
        assert.equal(after.accounts, before.accounts);
        if (status === 302) {
          const me = (await (
            await call("/users/me", named(response, "access_token"))
          ).json()) as { data: { id: string; role: string } };
          assert.equal(me.data.id, user);
          assert.equal(
            me.data.role,
            user === ids.users.ownerA ? "owner" : "admin",
          );
        }
      }
      await pool.query("UPDATE users SET deleted_at=now() WHERE id=$1", [
        ids.users.customerB,
      ]);
      try {
        const response = await callback(
          await begin({ sub: "fixture-google-subject" }),
        );
        assert.equal(response.status, 401);
      } finally {
        await pool.query("UPDATE users SET deleted_at=NULL WHERE id=$1", [
          ids.users.customerB,
        ]);
      }
    },
  );
  await t.test(
    "two callbacks for one state allow exactly one exchange/session",
    async () => {
      const flow = await begin(),
        before = await counts(),
        calls = provider.calls;
      const responses = await Promise.all([callback(flow), callback(flow)]);
      assert.deepEqual(responses.map((r) => r.status).sort(), [302, 400]);
      assert.equal(provider.calls, calls + 1);
      const after = await counts();
      assert.equal(after.users, before.users + 1);
      assert.equal(after.sessions, before.sessions + 1);
    },
  );
  await t.test(
    "parallel flows same sub create one user; different sub same email yields conflict without orphan user",
    async () => {
      const sub = `race-${v7()}`,
        email = `${v7()}@example.test`,
        before = await counts();
      const a = await begin({ sub, email }),
        b = await begin({ sub, email });
      const responses = await Promise.all([callback(a), callback(b)]);
      assert.ok(responses.every((r) => r.status === 302));
      const after = await counts();
      assert.equal(after.users, before.users + 1);
      assert.equal(after.accounts, before.accounts + 1);
      assert.equal(after.sessions, before.sessions + 2);
      await assert.rejects(
        () =>
          pool.query(
            "INSERT INTO oauth_accounts(id,user_id,provider,provider_id) VALUES($1,$2,'google',$3)",
            [v7(), ids.users.customerB, sub],
          ),
        (error: unknown) =>
          !!error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "23505",
      );
      const email2 = `${v7()}@example.test`,
        before2 = await counts();
      const c = await begin({ email: email2 }),
        d = await begin({ email: email2 });
      assert.deepEqual(
        (await Promise.all([callback(c), callback(d)]))
          .map((r) => r.status)
          .sort(),
        [302, 409],
      );
      const after2 = await counts();
      assert.equal(after2.users, before2.users + 1);
      assert.equal(after2.accounts, before2.accounts + 1);
    },
  );
  await t.test(
    "session write failure rolls back user/account; state stays consumed",
    async () => {
      const before = await counts(),
        flow = await begin();
      await pool.query(`CREATE FUNCTION reject_google_session() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private-test'; END $$;
      CREATE TRIGGER reject_google_session BEFORE INSERT ON refresh_tokens FOR EACH ROW EXECUTE FUNCTION reject_google_session()`);
      try {
        const response = await callback(flow);
        assert.equal(response.status, 503);
        assert.deepEqual(await counts(), before);
        assert.ok(
          !JSON.stringify(await response.json()).includes("private-test"),
        );
      } finally {
        await pool.query(
          "DROP TRIGGER reject_google_session ON refresh_tokens; DROP FUNCTION reject_google_session()",
        );
      }
      assert.equal((await callback(flow)).status, 400);
    },
  );
  await t.test(
    "status changed after identity verification is rechecked under the real user lock",
    async () => {
      const original = repo.linked.bind(repo);
      let changed = false;
      repo.linked = async (tx, subject) => {
        const result = await original(tx, subject);
        if (subject === "fixture-google-subject" && !changed) {
          changed = true;
          await pool.query("UPDATE users SET status='suspended' WHERE id=$1", [
            ids.users.customerB,
          ]);
        }
        return result;
      };
      try {
        assert.equal(
          (await callback(await begin({ sub: "fixture-google-subject" })))
            .status,
          403,
        );
      } finally {
        repo.linked = original;
        await pool.query("UPDATE users SET status='active' WHERE id=$1", [
          ids.users.customerB,
        ]);
      }
    },
  );
  await t.test(
    "production cookies Secure/Lax; cleanup removes only expired states past retention",
    async () => {
      const recorded: { name: string; options: unknown }[] = [];
      const response = {
        cookie(name: string, _value: string, options: unknown) {
          recorded.push({ name, options });
        },
        clearCookie() {},
      } as AuthResponse;
      const production = new ConfigService();
      production.get = (() => "production") as typeof production.get;
      const cookies = new AuthCookies(production);
      cookies.setGoogleBinding(response, "binding");
      cookies.set(response, {
        accessToken: "a",
        refreshToken: "b",
        persistent: false,
      });
      for (const row of recorded)
        assert.equal((row.options as { secure: boolean }).secure, true);
      const flow = await begin();
      await pool.query(
        "UPDATE oauth_states SET created_at=now()-interval '25 hours 5 minutes',expires_at=now()-interval '25 hours' WHERE state_hash=$1",
        [googleDigest(flow.state)],
      );
      await repo.cleanup();
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM oauth_states WHERE state_hash=$1",
            [googleDigest(flow.state)],
          )
        ).rows[0].n,
        0,
      );
    },
  );
  await t.test(
    "Swagger OAuth callback matches the strict shared contract and no token-bearing redirect response",
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
      for (const path of ["/auth/google", "/auth/google/callback"]) {
        const op = doc.paths[`/api/v1${path}`]?.get;
        assert.ok(op?.responses["302"]);
        assert.ok(op.responses["503"]);
        if (spec) {
          assert.deepEqual(
            (op.parameters ?? [])
              .map((p) => ("name" in p ? p.name : ""))
              .sort(),
            spec.paths[path].get.parameters
              .map((p: { name: string }) => p.name)
              .sort(),
          );
        }
      }
    },
  );
}
