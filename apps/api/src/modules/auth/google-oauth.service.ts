import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Interval } from "@nestjs/schedule";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import {
  googleCallbackQuerySchema,
  noQuerySchema,
} from "../../../../../packages/shared/src/phase4-schemas.js";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe.js";
import { AuthService } from "./auth.service.js";
import {
  GoogleIdentityProvider,
  googleDigest,
  oauthUnavailable,
} from "./google-identity.provider.js";
import { GoogleOAuthRepository } from "./google-oauth.repository.js";

const invalidState = () =>
  new BadRequestException({
    code: "VALIDATION_ERROR",
    message:
      "Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn. Hãy bắt đầu lại.",
  });
@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);
  constructor(
    private readonly repo: GoogleOAuthRepository,
    private readonly provider: GoogleIdentityProvider,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}
  private settings() {
    for (const key of [
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "GOOGLE_CALLBACK_URL",
      "OAUTH_STATE_ENCRYPTION_KEY",
      "AUTH_FRONTEND_URL",
    ]) {
      if (!this.config.get<string>(key)) throw oauthUnavailable();
    }
    return {
      clientId: this.config.getOrThrow<string>("GOOGLE_CLIENT_ID"),
      callback: this.config.getOrThrow<string>("GOOGLE_CALLBACK_URL"),
      frontend: new URL(
        "/",
        this.config.getOrThrow<string>("AUTH_FRONTEND_URL"),
      ).toString(),
      key: Buffer.from(
        this.config.getOrThrow<string>("OAUTH_STATE_ENCRYPTION_KEY"),
        "hex",
      ),
    };
  }
  private seal(verifier: string, stateHash: string, key: Buffer) {
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(Buffer.from(stateHash));
    const ciphertext = Buffer.concat([
      cipher.update(verifier, "utf8"),
      cipher.final(),
    ]);
    return [iv, cipher.getAuthTag(), ciphertext]
      .map((b) => b.toString("base64url"))
      .join(".");
  }
  private open(ciphertext: string, stateHash: string, key: Buffer) {
    const parts = ciphertext.split(".").map((v) => Buffer.from(v, "base64url"));
    if (
      parts.length !== 3 ||
      parts[0]!.length !== 12 ||
      parts[1]!.length !== 16
    )
      throw invalidState();
    const decipher = createDecipheriv("aes-256-gcm", key, parts[0]!);
    decipher.setAAD(Buffer.from(stateHash));
    decipher.setAuthTag(parts[1]!);
    return Buffer.concat([
      decipher.update(parts[2]!),
      decipher.final(),
    ]).toString("utf8");
  }
  async start(query: unknown) {
    const settings = this.settings();
    new ZodValidationPipe(noQuerySchema).transform(query);
    const state = randomBytes(32).toString("base64url"),
      binding = randomBytes(32).toString("base64url"),
      nonce = randomBytes(32).toString("base64url"),
      verifier = randomBytes(32).toString("base64url"),
      stateHash = googleDigest(state);
    try {
      await this.repo.saveState({
        stateHash,
        bindingHash: googleDigest(binding),
        nonceHash: googleDigest(nonce),
        pkceVerifierCiphertext: this.seal(verifier, stateHash, settings.key),
      });
    } catch {
      throw oauthUnavailable();
    }
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({
      client_id: settings.clientId,
      redirect_uri: settings.callback,
      response_type: "code",
      scope: "openid email profile",
      state,
      nonce,
      code_challenge_method: "S256",
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    }).toString();
    return { location: url.toString(), binding };
  }
  async callback(raw: unknown, binding: string | undefined) {
    const settings = this.settings(),
      query = new ZodValidationPipe(googleCallbackQuerySchema).transform(raw);
    if (!binding || !/^[A-Za-z0-9_-]{43}$/.test(binding)) throw invalidState();
    let state: Awaited<ReturnType<GoogleOAuthRepository["takeState"]>>;
    try {
      state = await this.repo.takeState(
        googleDigest(query.state),
        googleDigest(binding),
      );
    } catch {
      throw oauthUnavailable();
    }
    if (!state) throw invalidState();
    // State consumption commits before external network. Every error requires a fresh authorization flow.
    if (query.error) throw oauthUnavailable();
    let verifier: string;
    try {
      verifier = this.open(
        state.pkceVerifierCiphertext,
        state.stateHash,
        settings.key,
      );
    } catch {
      throw invalidState();
    }
    const token = await this.provider.exchange(query.code!, verifier),
      identity = await this.provider.verify(token, state.nonceHash);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const session = await this.repo.transaction(async (tx) => {
          await this.repo.lockIdentity(tx, identity.subject, identity.email);
          const linked = await this.repo.linked(tx, identity.subject);
          if (linked) return this.auth.sessionForGoogle(tx, linked.userId);
          if (await this.repo.emailExists(tx, identity.email))
            throw new ConflictException({
              code: "EMAIL_ALREADY_EXISTS",
              message:
                "Email đã có tài khoản. Hãy đăng nhập bằng phương thức hiện có.",
            });
          const userId = await this.repo.create(tx, identity);
          return this.auth.sessionForGoogle(tx, userId);
        });
        return { session, location: settings.frontend };
      } catch (error) {
        if (error instanceof HttpException) throw error;
        let cause: unknown = error;
        const seen = new Set<unknown>();
        let retry = false;
        while (cause && typeof cause === "object" && !seen.has(cause)) {
          seen.add(cause);
          if (
            "code" in cause &&
            ["23505", "40001", "40P01"].includes(String(cause.code))
          )
            retry = true;
          cause = "cause" in cause ? cause.cause : null;
        }
        if (retry && attempt < 2) continue;
        throw oauthUnavailable();
      }
    }
    throw oauthUnavailable();
  }
  @Interval(3600000)
  async cleanup() {
    try {
      await this.repo.cleanup();
    } catch {
      this.logger.warn("OAuth state cleanup failed; next schedule will retry.");
    }
  }
}
