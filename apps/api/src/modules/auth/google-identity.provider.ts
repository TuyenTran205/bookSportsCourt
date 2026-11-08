import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTVerifyGetKey,
  type JWTPayload,
} from "jose";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const googleDigest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export interface GoogleIdentity {
  subject: string;
  email: string;
  fullName: string;
}
export const oauthUnavailable = () =>
  new ServiceUnavailableException({
    code: "SERVICE_UNAVAILABLE",
    message: "Đăng nhập Google chưa sẵn sàng. Vui lòng thử lại.",
  });
const invalidToken = () =>
  new UnauthorizedException({
    code: "INVALID_TOKEN",
    message: "Danh tính Google không hợp lệ.",
  });

@Injectable()
export class GoogleIdentityProvider {
  private readonly remoteKeys = createRemoteJWKSet(
    new URL("https://www.googleapis.com/oauth2/v3/certs"),
    { timeoutDuration: 5000 },
  );
  constructor(private readonly config: ConfigService) {}
  protected verificationKeys(): JWTVerifyGetKey {
    return this.remoteKeys;
  }
  async exchange(code: string, verifier: string): Promise<string> {
    try {
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        redirect: "error",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          code_verifier: verifier,
          client_id: this.config.getOrThrow<string>("GOOGLE_CLIENT_ID"),
          client_secret: this.config.getOrThrow<string>("GOOGLE_CLIENT_SECRET"),
          redirect_uri: this.config.getOrThrow<string>("GOOGLE_CALLBACK_URL"),
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw oauthUnavailable();
      const parsed = z
        .object({ id_token: z.string().min(1).max(16384) })
        .safeParse(await response.json());
      if (!parsed.success) throw oauthUnavailable();
      // Deliberately discard Google's access/refresh token: only app sessions are persisted.
      return parsed.data.id_token;
    } catch {
      throw oauthUnavailable();
    }
  }
  async verify(token: string, nonceHash: string): Promise<GoogleIdentity> {
    let claims: JWTPayload;
    try {
      const result = await jwtVerify(token, this.verificationKeys(), {
        algorithms: ["RS256"],
        issuer: ["https://accounts.google.com", "accounts.google.com"],
        audience: this.config.getOrThrow<string>("GOOGLE_CLIENT_ID"),
        requiredClaims: ["sub", "exp", "iat", "nonce"],
        maxTokenAge: "10m",
        clockTolerance: 5,
      });
      claims = result.payload;
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : "";
      if (
        code.startsWith("ERR_JWT") ||
        code.startsWith("ERR_JWS") ||
        code === "ERR_JOSE_ALG_NOT_ALLOWED" ||
        code === "ERR_JWKS_NO_MATCHING_KEY"
      )
        throw invalidToken();
      throw oauthUnavailable();
    }
    const clientId = this.config.getOrThrow<string>("GOOGLE_CLIENT_ID");
    if (
      (claims.azp !== undefined && claims.azp !== clientId) ||
      (Array.isArray(claims.aud) &&
        claims.aud.length > 1 &&
        claims.azp !== clientId) ||
      typeof claims.nonce !== "string" ||
      !/^[a-f0-9]{64}$/.test(nonceHash) ||
      !timingSafeEqual(
        Buffer.from(googleDigest(claims.nonce), "hex"),
        Buffer.from(nonceHash, "hex"),
      ) ||
      !z.string().min(1).max(255).safeParse(claims.sub).success
    )
      throw invalidToken();
    const email = z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((v) => v.toLowerCase())
      .safeParse(claims.email);
    if (claims.email_verified !== true || !email.success)
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Google chưa xác minh email hợp lệ.",
      });
    const fullName =
      typeof claims.name === "string" && claims.name.trim()
        ? claims.name.trim().slice(0, 100)
        : "Người dùng Google";
    return { subject: claims.sub!, email: email.data, fullName };
  }
}
