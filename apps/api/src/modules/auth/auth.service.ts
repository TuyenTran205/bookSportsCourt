import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import {
  bindSession,
  expectedSessionVersion,
  invalidateLocalSockets,
} from "./session-context.js";
import { z } from "zod";
import {
  USER_ROLES,
  USER_STATUSES,
} from "../../../../../packages/shared/src/constants.js";
import type { AuthenticatedUser } from "../../../../../packages/shared/src/types.js";

import {
  changePasswordSchema,
  registerSchema,
  loginSchema,
  resetPasswordSchema,
  updateProfileSchema,
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
    const accessToken = await this.jwt.sign(
      user.id,
      "access",
      persistent,
      user.sessionVersion,
    );
    const refreshToken = await this.jwt.sign(
      user.id,
      "refresh",
      persistent,
      user.sessionVersion,
    );
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

  /** Only called after server-side Google verification, inside the account transaction. */
  async sessionForGoogle(tx: AuthTransaction, userId: string) {
    const user = await this.repo.lockUser(tx, userId);
    this.active(user);
    return this.session(tx, user, false);
  }

  async refresh(raw: string | undefined) {
    const claims = await this.jwt.verify(raw, "refresh");
    const result = await this.repo.transaction(async (tx) => {
      const user = await this.repo.lockUser(tx, claims.userId);
      this.active(user);
      this.checkVersion(user, claims.sessionVersion);
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
    if (!user || user.status !== "active" || !user.passwordHash) return;
    this.mail.assertConfigured();
    const token = generateOneTimeToken();
    const issued = await this.repo.transaction(async (tx) => {
      const current = await this.repo.lockUser(tx, user.id);
      if (
        !current ||
        current.deletedAt ||
        current.status !== "active" ||
        !current.passwordHash ||
        current.email !== email
      )
        return false;
      await this.repo.consumeTokens(tx, user.id, "password_reset");
      await this.repo.insertToken(tx, {
        userId: user.id,
        type: "password_reset",
        tokenHash: token.tokenHash,
        expiresAt: new Date((await this.repo.now(tx)).getTime() + 3600_000),
      });
      return true;
    });
    if (issued) {
      try {
        await this.mail.send(email, token.token, "password_reset");
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
    const invalidatedUser = await this.repo.transaction(async (tx) => {
      const user = await this.repo.lockUser(tx, found.userId);
      const token = await this.repo.tokenByHash(hash, tx, true);
      const now = await this.repo.now(tx);
      if (
        !user ||
        user.deletedAt ||
        user.status !== "active" ||
        !token ||
        token.userId !== user.id ||
        token.type !== type ||
        token.usedAt ||
        token.expiresAt.getTime() <= now.getTime()
      )
        return this.invalidToken();
      await this.repo.consumeTokens(tx, user.id, type);
      if (type === "password_reset" && passwordHash) {
        if (!user.passwordHash) return this.invalidToken();
        await this.repo.updateUser(tx, user.id, { passwordHash });
        await this.repo.invalidateSessions(tx, user.id);
        return user.id;
      } else {
        await this.repo.updateUser(tx, user.id, {
          emailVerifiedAt: new Date(),
        });
      }
    });
    if (invalidatedUser) invalidateLocalSockets(invalidatedUser);
  }

  async resetPassword(dto: z.infer<typeof resetPasswordSchema>) {
    try {
      await this.consume(
        dto.token,
        "password_reset",
        await hashPassword(dto.password),
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Do not propagate Drizzle errors with password hashes/token parameters into request logs.
      throw new InternalServerErrorException({
        code: "INTERNAL_ERROR",
        message: "Không thể đặt lại mật khẩu lúc này.",
      });
    }
  }

  async verifyEmail(token: string) {
    await this.consume(token, "email_verify");
  }

  async me(raw: string | undefined) {
    const claims = await this.jwt.verify(raw, "access");
    bindSession(claims.userId, claims.sessionVersion);
    return this.requireActiveUser(
      claims.userId,
      undefined,
      claims.sessionVersion,
    );
  }

  async updateProfile(
    userId: string,
    dto: z.infer<typeof updateProfileSchema>,
  ): Promise<AuthenticatedUser> {
    return this.repo.transaction(async (tx) => {
      await this.requireActiveUser(userId, tx);
      await this.repo.updateUser(tx, userId, {
        fullName: dto.fullName,
        ...(dto.phone !== undefined ? { phone: dto.phone || null } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
      });
      return this.requireActiveUser(userId, tx);
    });
  }

  async changePassword(
    userId: string,
    dto: z.infer<typeof changePasswordSchema>,
  ): Promise<void> {
    await this.repo.transaction(async (tx) => {
      const user = await this.repo.lockUser(tx, userId);
      this.active(user);
      this.checkVersion(user, expectedSessionVersion(userId));
      if (!user.passwordHash) {
        throw new BadRequestException({
          code: "VALIDATION_ERROR",
          message: "Tài khoản đăng nhập qua OAuth không có mật khẩu.",
        });
      }
      const valid = await verifyPassword(
        user.passwordHash,
        dto.currentPassword,
      );
      if (!valid) {
        throw new UnauthorizedException({
          code: "INVALID_CREDENTIALS",
          message: "Mật khẩu hiện tại không chính xác.",
        });
      }
      const newHash = await hashPassword(dto.newPassword);
      await this.repo.updateUser(tx, userId, { passwordHash: newHash });
      await this.repo.invalidateSessions(tx, userId);
    });
    invalidateLocalSockets(userId);
  }
  private checkVersion(user: AuthUser, expected: number | undefined) {
    if (expected !== undefined && user.sessionVersion !== expected)
      throw new UnauthorizedException({
        code: "UNAUTHORIZED",
        message: "Phiên đăng nhập đã bị thu hồi.",
      });
  }
  invalidateSessions(tx: AuthTransaction, userId: string) {
    return this.repo.invalidateSessions(tx, userId);
  }

  /** Re-read account state; lock it when called inside a sensitive mutation. */
  async requireActiveUser(
    userId: string,
    tx?: AuthTransaction,
    expected = expectedSessionVersion(userId),
  ): Promise<AuthenticatedUser> {
    const user = tx
      ? await this.repo.lockUser(tx, userId)
      : await this.repo.byId(userId);
    this.active(user);
    this.checkVersion(user, expected);
    return this.profile(user);
  }
}
