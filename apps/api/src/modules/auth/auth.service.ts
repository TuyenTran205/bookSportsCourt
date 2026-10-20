import {
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import {
  USER_ROLES,
  USER_STATUSES,
} from "../../../../../packages/shared/src/constants.js";
import type { AuthenticatedUser } from "../../../../../packages/shared/src/types.js";

import {
  registerSchema,
  loginSchema,
  resetPasswordSchema,
} from "../../../../../packages/shared/src/schemas.js";
import {
  AuthRepository,
  type AuthTransaction,
  type AuthUser,
} from "./auth.repository.js";
import { AuthJwtService } from "./auth-jwt.service.js";
import { AuthMailService } from "./auth-mail.service.js";
import {
  generateOneTimeToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from "./auth-secrets.js";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly pending = new Set<Promise<void>>();
  private readonly dummyHash = hashPassword(randomBytes(32).toString("hex"));
  constructor(
    private readonly repo: AuthRepository,
    private readonly jwt: AuthJwtService,
    private readonly mail: AuthMailService,
  ) {}

  private active(user: AuthUser | undefined): asserts user is AuthUser {
    if (!user || user.deletedAt) throw new UnauthorizedException();
    if (user.status !== "active")
      throw new ForbiddenException({
        code: user.status === "suspended" ? "ACCOUNT_SUSPENDED" : "FORBIDDEN",
        message: "Tài khoản chưa được phép truy cập.",
      });
  }

  private profile(user: AuthUser): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      role: z.enum(USER_ROLES).parse(user.role),
      status: z.enum(USER_STATUSES).parse(user.status),
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  async register(dto: z.infer<typeof registerSchema>) {
    this.mail.assertConfigured();
    const passwordHash = await hashPassword(dto.password);
    const verification = generateOneTimeToken();
    let user: AuthUser;
    try {
      user = await this.repo.transaction(async (tx) => {
        const created = await this.repo.insertUser(tx, {
          email: dto.email,
          fullName: dto.fullName,
          phone: dto.phone,
          passwordHash,
          role: "customer",
          status: "active",
        });
        await this.repo.insertToken(tx, {
          userId: created.id,
          type: "email_verify",
          tokenHash: verification.tokenHash,
          expiresAt: new Date(Date.now() + 24 * 3600_000),
        });
        return created;
      });
    } catch (error) {
      const pgError = error as { code?: string; cause?: { code?: string } };
      if (pgError.code === "23505" || pgError.cause?.code === "23505") {
        throw new ConflictException({
          code: "EMAIL_ALREADY_EXISTS",
          message: "Email đã được đăng ký.",
        });
      }
      throw error;
    }
    await this.mail.send(user.email, verification.token, "email_verify");
    return this.profile(user);
  }

  private async session(
    tx: AuthTransaction,
    user: AuthUser,
    persistent: boolean,
  ) {
    const accessToken = await this.jwt.sign(user.id, "access", persistent);
    const refreshToken = await this.jwt.sign(user.id, "refresh", persistent);
    await this.repo.insertRefresh(tx, {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 30 * 86400_000),
    });
    return { accessToken, refreshToken, persistent, user: this.profile(user) };
  }

  async login(dto: z.infer<typeof loginSchema>) {
    const found = await this.repo.byEmail(dto.email);
    const valid = await verifyPassword(
      found?.passwordHash ?? (await this.dummyHash),
      dto.password,
    );
    if (!found || !valid)
      throw new UnauthorizedException({
        code: "INVALID_CREDENTIALS",
        message: "Email hoặc mật khẩu không đúng.",
      });
    return this.repo.transaction(async (tx) => {
      const user = await this.repo.lockUser(tx, found.id);
      this.active(user);
      if (user.passwordHash !== found.passwordHash)
        throw new UnauthorizedException();
      return this.session(tx, user, dto.rememberMe);
    });
  }

  async refresh(raw: string | undefined) {
    const claims = await this.jwt.verify(raw, "refresh");
    const result = await this.repo.transaction(async (tx) => {
      const user = await this.repo.lockUser(tx, claims.userId);
      this.active(user);
      const token = await this.repo.refreshByHash(hashToken(raw ?? ""), tx);
      if (!token || token.userId !== user.id) return null;
      if (token.revoked) {
        // Return instead of throwing inside the transaction: revocation must commit.
        await this.repo.revokeAll(tx, user.id);
        return null;
      }
      if (token.expiresAt.getTime() <= Date.now()) return null;
      await this.repo.revoke(tx, token.id);
      return this.session(tx, user, claims.persistent);
    });
    if (!result)
      throw new UnauthorizedException({
        code: "UNAUTHORIZED",
        message: "Phiên đăng nhập đã bị thu hồi.",
      });
    return result;
  }

  async logout(raw: string | undefined) {
    if (!raw) return;
    const found = await this.repo.refreshByHash(hashToken(raw));
    if (!found) return;
    await this.repo.transaction(async (tx) => {
      await this.repo.lockUser(tx, found.userId);
      await this.repo.revoke(tx, found.id);
    });
  }

  forgotPassword(email: string): void {
    if (this.pending.size >= 100)
      throw new HttpException(
        { code: "RATE_LIMIT_EXCEEDED", message: "Vui lòng thử lại sau." },
        429,
      );
    const task = Promise.resolve()
      .then(() => this.deliverReset(email))
      .catch(() => {
        this.logger.warn("Password reset request could not be processed");
      });
    this.pending.add(task);
    void task.finally(() => this.pending.delete(task));
  }

  async onModuleDestroy() {
    await Promise.allSettled(this.pending);
  }

  private async deliverReset(email: string) {
    const user = await this.repo.byEmail(email);
    if (!user || user.status !== "active") return;
    const token = generateOneTimeToken();
    const issued = await this.repo.transaction(async (tx) => {
      const current = await this.repo.lockUser(tx, user.id);
      if (!current || current.deletedAt || current.status !== "active")
        return false;
      await this.repo.consumeTokens(tx, user.id, "password_reset");
      await this.repo.insertToken(tx, {
        userId: user.id,
        type: "password_reset",
        tokenHash: token.tokenHash,
        expiresAt: new Date(Date.now() + 3600_000),
      });
      return true;
    });
    if (issued) {
      try {
        await this.mail.send(user.email, token.token, "password_reset");
      } catch {
        /* Same 204 for existing/non-existing addresses, including delivery failures. */
      }
    }
  }

  private invalidToken(): never {
    throw new UnauthorizedException({
      code: "INVALID_TOKEN",
      message: "Token không hợp lệ hoặc đã hết hạn.",
    });
  }

  private async consume(
    raw: string,
    type: "email_verify" | "password_reset",
    passwordHash?: string,
  ) {
    const hash = hashToken(raw);
    const found = await this.repo.tokenByHash(hash);
    if (!found) return this.invalidToken();
    await this.repo.transaction(async (tx) => {
      const user = await this.repo.lockUser(tx, found.userId);
      const token = await this.repo.tokenByHash(hash, tx);
      if (
        !user ||
        user.deletedAt ||
        user.status !== "active" ||
        !token ||
        token.type !== type ||
        token.usedAt ||
        token.expiresAt.getTime() <= Date.now()
      )
        return this.invalidToken();
      await this.repo.consumeTokens(tx, user.id, type);
      if (type === "password_reset" && passwordHash) {
        await this.repo.updateUser(tx, user.id, { passwordHash });
        await this.repo.revokeAll(tx, user.id);
      } else {
        await this.repo.updateUser(tx, user.id, {
          emailVerifiedAt: new Date(),
        });
      }
    });
  }

  async resetPassword(dto: z.infer<typeof resetPasswordSchema>) {
    await this.consume(
      dto.token,
      "password_reset",
      await hashPassword(dto.password),
    );
  }

  async verifyEmail(token: string) {
    await this.consume(token, "email_verify");
  }

  async me(raw: string | undefined) {
    const claims = await this.jwt.verify(raw, "access");
    return this.requireActiveUser(claims.userId);
  }

  /** Re-read account state; lock it when called inside a sensitive mutation. */
  async requireActiveUser(
    userId: string,
    tx?: AuthTransaction,
  ): Promise<AuthenticatedUser> {
    const user = tx
      ? await this.repo.lockUser(tx, userId)
      : await this.repo.byId(userId);
    this.active(user);
    return this.profile(user);
  }
}
