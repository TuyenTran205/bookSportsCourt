import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ConfigService } from "@nestjs/config";
import { fakeGoogle } from "./fixtures/google-provider.fixture.js";
import {
  GoogleIdentityProvider,
  googleDigest,
} from "../src/modules/auth/google-identity.provider.js";
import { AppConfigSchema } from "../src/config/app-config.js";
import { HttpException } from "@nestjs/common";

test("Google ID token signature/issuer/audience/azp/expiry/nonce and verified email", async () => {
  const provider = await fakeGoogle(
    new ConfigService({ GOOGLE_CLIENT_ID: "google-test-client" }),
  );
  const hash = googleDigest("expected-nonce");
  const result = await provider.verify(
    await provider.signed({ nonce: "expected-nonce", role: "admin" }),
    hash,
  );
  assert.equal(result.subject, "test-google-subject");
  assert.ok(!("role" in result));
  for (const claims of [
    { iss: "https://evil.example" },
    { aud: "other-client" },
    { azp: "other-client" },
    { aud: ["google-test-client", "other-client"] },
    { exp: Math.floor(Date.now() / 1000) - 60 },
    { iat: Math.floor(Date.now() / 1000) + 60 },
    { nonce: "other" },
    { nonce: undefined },
    { sub: undefined },
    { iat: undefined },
    { exp: undefined },
  ]) {
    await assert.rejects(
      async () =>
        provider.verify(
          await provider.signed({ nonce: "expected-nonce", ...claims }),
          hash,
        ),
      (error: unknown) =>
        error instanceof HttpException && error.getStatus() === 401,
    );
  }
  for (const claims of [
    { email: undefined },
    { email: "bad" },
    { email_verified: false },
    { email_verified: "true" },
  ]) {
    await assert.rejects(
      async () =>
        provider.verify(
          await provider.signed({ nonce: "expected-nonce", ...claims }),
          hash,
        ),
      (error: unknown) =>
        error instanceof HttpException && error.getStatus() === 403,
    );
  }
  const parts = (await provider.signed({ nonce: "expected-nonce" })).split(".");
  parts[2] = (parts[2]![0] === "A" ? "B" : "A") + parts[2]!.slice(1);
  await assert.rejects(
    () => provider.verify(parts.join("."), hash),
    (error: unknown) =>
      error instanceof HttpException && error.getStatus() === 401,
  );
});

test("Google code exchange uses fixed endpoint, secret/redirect/verifier server side and sanitizes errors", async () => {
  const provider = new GoogleIdentityProvider(
    new ConfigService({
      GOOGLE_CLIENT_ID: "id",
      GOOGLE_CLIENT_SECRET: "private-secret",
      GOOGLE_CALLBACK_URL: "http://localhost:3001/api/v1/auth/google/callback",
    }),
  );
  const previous = globalThis.fetch;
  try {
    globalThis.fetch = async (input, init) => {
      assert.equal(input, "https://oauth2.googleapis.com/token");
      assert.equal(init?.redirect, "error");
      const body = new URLSearchParams(String(init?.body));
      assert.equal(body.get("code_verifier"), "verifier");
      assert.equal(body.get("client_secret"), "private-secret");
      assert.equal(body.get("grant_type"), "authorization_code");
      return new Response(
        JSON.stringify({
          id_token: "test-token",
          access_token: "discard-me",
          refresh_token: "discard-me",
        }),
        { status: 200 },
      );
    };
    assert.equal(await provider.exchange("code", "verifier"), "test-token");
    for (const fake of [
      async () => new Response("secret diagnostic", { status: 400 }),
      async () => new Response("{}", { status: 200 }),
      async () => {
        throw new Error("private-secret");
      },
    ]) {
      globalThis.fetch = fake;
      await assert.rejects(
        () => provider.exchange("code", "verifier"),
        (error: unknown) =>
          error instanceof HttpException &&
          error.getStatus() === 503 &&
          !JSON.stringify(error.getResponse()).includes("private-secret"),
      );
    }
  } finally {
    globalThis.fetch = previous;
  }
});

test("OAuth config fail closed: exact callback, allowed frontend, separate AES key and HTTPS", () => {
  const base = {
    DATABASE_URL: "postgresql://test:test@localhost/test",
    JWT_ACCESS_SECRET: "a".repeat(32),
    JWT_REFRESH_SECRET: "b".repeat(32),
    ALLOWED_ORIGINS: "http://localhost:3000",
    GOOGLE_CLIENT_ID: "id",
    GOOGLE_CLIENT_SECRET: "secret",
    GOOGLE_CALLBACK_URL: "http://localhost:3001/api/v1/auth/google/callback",
    OAUTH_STATE_ENCRYPTION_KEY: "a".repeat(64),
    AUTH_FRONTEND_URL: "http://localhost:3000",
    NODE_ENV: "test",
  };
  assert.equal(AppConfigSchema.safeParse(base).success, true);
  for (const delta of [
    { GOOGLE_CLIENT_SECRET: "" },
    { OAUTH_STATE_ENCRYPTION_KEY: "bad" },
    { GOOGLE_CALLBACK_URL: "http://evil.test/api/v1/auth/google/callback" },
    { GOOGLE_CALLBACK_URL: "http://localhost:3001/other" },
    { AUTH_FRONTEND_URL: "http://localhost:3000//evil" },
    { AUTH_FRONTEND_URL: "https://evil.test" },
    {
      GOOGLE_CALLBACK_URL:
        "http://localhost:3001/api/v1/auth/google/callback?redirect=evil",
    },
    { NODE_ENV: "production" },
    { JWT_ACCESS_SECRET: base.OAUTH_STATE_ENCRYPTION_KEY },
  ])
    assert.equal(
      AppConfigSchema.safeParse({ ...base, ...delta }).success,
      false,
    );
  const production = {
    ...base,
    NODE_ENV: "production",
    ALLOWED_ORIGINS: "https://app.example.test",
    AUTH_FRONTEND_URL: "https://app.example.test",
    GOOGLE_CALLBACK_URL: "https://api.example.test/api/v1/auth/google/callback",
  };
  assert.equal(AppConfigSchema.safeParse(production).success, true);
  assert.equal(
    AppConfigSchema.safeParse({
      ...production,
      GOOGLE_CALLBACK_URL: "http://localhost:3001/api/v1/auth/google/callback",
    }).success,
    false,
  );
});
