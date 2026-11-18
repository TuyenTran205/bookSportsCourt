import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { jwtVerify, SignJWT, errors } from "jose";
import { v7 } from "uuid";

@Injectable()
export class AuthJwtService {
  constructor(private readonly config: ConfigService) {}

  private key(kind: "access" | "refresh") {
    return new TextEncoder().encode(
      this.config.getOrThrow<string>(
        kind === "access" ? "JWT_ACCESS_SECRET" : "JWT_REFRESH_SECRET",
      ),
    );
  }

  async sign(
    userId: string,
    kind: "access" | "refresh",
    persistent: boolean,
    sessionVersion = 0,
  ) {
    if (!Number.isSafeInteger(sessionVersion) || sessionVersion < 0)
      throw new Error("Invalid session version");
    return new SignJWT({ kind, persistent, sessionVersion })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(userId)
      .setJti(v7())
      .setIssuer("booksportscourt")
      .setAudience("booksportscourt-api")
      .setIssuedAt()
      .setExpirationTime(kind === "access" ? "15m" : "30d")
      .sign(this.key(kind));
  }

  async signWs(userId: string, sessionVersion = 0) {
    if (!Number.isSafeInteger(sessionVersion) || sessionVersion < 0)
      throw new Error("Invalid session version");
    return new SignJWT({ kind: "ws", sessionVersion })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(userId)
      .setJti(v7())
      .setIssuer("booksportscourt")
      .setAudience("booksportscourt-ws")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(this.key("access"));
  }

  async verify(token: string | undefined, kind: "access" | "refresh") {
    return this.verifyWithAudience(token, kind, "booksportscourt-api");
  }

  async verifyWs(token: string | undefined) {
    return this.verifyWithAudience(token, "ws", "booksportscourt-ws");
  }

  private async verifyWithAudience(
    token: string | undefined,
    kind: "access" | "refresh" | "ws",
    audience: "booksportscourt-api" | "booksportscourt-ws",
  ) {
    if (!token)
      throw new UnauthorizedException({
        code: "UNAUTHORIZED",
        message: "Vui lòng đăng nhập.",
      });
    try {
      const signingKind = kind === "refresh" ? "refresh" : "access";
      const { payload } = await jwtVerify(token, this.key(signingKind), {
        algorithms: ["HS256"],
        issuer: "booksportscourt",
        audience,
        requiredClaims: ["sub", "jti", "iat", "exp"],
      });
      if (
        payload.kind !== kind ||
        !payload.sub ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(
          payload.sub,
        )
      )
        throw new Error("Invalid claims");
      const sessionVersion =
        payload.sessionVersion === undefined ? 0 : payload.sessionVersion;
      if (
        typeof sessionVersion !== "number" ||
        !Number.isSafeInteger(sessionVersion) ||
        sessionVersion < 0
      )
        throw new Error("Invalid session version");
      return {
        userId: payload.sub,
        persistent: payload.persistent === true,
        sessionVersion,
      };
    } catch (error) {
      throw new UnauthorizedException({
        code:
          error instanceof errors.JWTExpired ? "TOKEN_EXPIRED" : "UNAUTHORIZED",
        message: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
      });
    }
  }
}
