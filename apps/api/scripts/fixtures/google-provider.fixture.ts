import { ConfigService } from "@nestjs/config";
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWTPayload,
  type JWTVerifyGetKey,
  type KeyLike,
} from "jose";
import { createHash } from "node:crypto";
import {
  GoogleIdentityProvider,
  oauthUnavailable,
} from "../../src/modules/auth/google-identity.provider.js";

export class FakeGoogleProvider extends GoogleIdentityProvider {
  calls = 0;
  private readonly flows = new Map<
    string,
    { nonce: string; challenge: string; claims: JWTPayload }
  >();
  constructor(
    config: ConfigService,
    private readonly privateKey: KeyLike,
    private readonly keys: JWTVerifyGetKey,
  ) {
    super(config);
  }
  protected override verificationKeys() {
    return this.keys;
  }
  register(code: string, url: URL, claims: JWTPayload = {}) {
    this.flows.set(code, {
      nonce: url.searchParams.get("nonce")!,
      challenge: url.searchParams.get("code_challenge")!,
      claims,
    });
  }
  async signed(claims: JWTPayload = {}) {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({
      iss: "https://accounts.google.com",
      aud: "google-test-client",
      sub: "test-google-subject",
      email: "google-user@example.test",
      email_verified: true,
      name: "Google Test",
      iat: now,
      exp: now + 300,
      ...claims,
    })
      .setProtectedHeader({ alg: "RS256", kid: "test-google-key" })
      .sign(this.privateKey);
  }
  override async exchange(code: string, verifier: string) {
    this.calls++;
    const flow = this.flows.get(code);
    if (
      !flow ||
      createHash("sha256").update(verifier).digest("base64url") !==
        flow.challenge
    )
      throw oauthUnavailable();
    return this.signed({ nonce: flow.nonce, ...flow.claims });
  }
}
export async function fakeGoogle(config: ConfigService) {
  const pair = await generateKeyPair("RS256"),
    publicJwk = await exportJWK(pair.publicKey);
  return new FakeGoogleProvider(
    config,
    pair.privateKey,
    createLocalJWKSet({
      keys: [
        { ...publicJwk, kid: "test-google-key", alg: "RS256", use: "sig" },
      ],
    }),
  );
}
