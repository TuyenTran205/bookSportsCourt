import {
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  adminUserQuerySchema,
  noQuerySchema,
  phase4IdSchema,
  userStatusUpdateSchema,
} from "../../../../../packages/shared/src/phase4-schemas.js";
import {
  userAdminDetailSchema,
  userListItemSchema,
} from "../../../../../packages/shared/src/phase4-responses.js";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe.js";
import { AuthService } from "../auth/auth.service.js";
import type { AuthTransaction } from "../auth/auth.repository.js";
import { invalidateLocalSockets } from "../auth/session-context.js";
import { writeAudit } from "../audit/audit-writer.js";
import { UsersRepository } from "./users.repository.js";
@Injectable()
export class UsersService {
  constructor(
    private readonly repo: UsersRepository,
    private readonly auth: AuthService,
  ) {}
  private async admin(id: string, tx?: AuthTransaction) {
    const user = await this.auth.requireActiveUser(id, tx);
    if (user.role !== "admin")
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Chỉ Admin được quản lý tài khoản.",
      });
  }
  private view(
    row: NonNullable<Awaited<ReturnType<UsersRepository["detail"]>>>,
    detail: boolean,
  ) {
    const base = {
      id: row.id,
      fullName: row.fullName,
      email: row.email,
      phoneMasked: row.phone
        ? "*".repeat(Math.max(0, row.phone.length - 3)) + row.phone.slice(-3)
        : null,
      avatarUrl: row.avatarUrl,
      role: row.role,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
    return detail
      ? userAdminDetailSchema.parse({
          ...base,
          phone: row.phone,
          emailVerifiedAt: row.emailVerifiedAt?.toISOString() ?? null,
        })
      : userListItemSchema.parse(base);
  }
  private async safe<T>(work: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++)
      try {
        return await work();
      } catch (error) {
        let cause: unknown = error,
          retry = false;
        const seen = new Set<unknown>();
        while (cause && typeof cause === "object" && !seen.has(cause)) {
          seen.add(cause);
          if (
            "code" in cause &&
            ["40001", "40P01"].includes(String(cause.code))
          )
            retry = true;
          cause = "cause" in cause ? cause.cause : null;
        }
        if (retry && attempt < 2) continue;
        if (error instanceof HttpException) throw error;
        if (retry)
          throw new ServiceUnavailableException({
            code: "SERVICE_UNAVAILABLE",
            message: "Tài khoản đang được xử lý; thử lại sau.",
          });
        throw new InternalServerErrorException({
          code: "INTERNAL_ERROR",
          message: "Không thể xử lý tài khoản.",
        });
      }
    throw new Error("Unreachable");
  }
  async list(actorId: string, raw: unknown) {
    await this.admin(actorId);
    const query = new ZodValidationPipe(adminUserQuerySchema).transform(raw);
    const result = await this.safe(() => this.repo.list(query));
    return {
      data: result.rows.map((row) => this.view(row, false)),
      meta: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / query.limit),
      },
    };
  }
  async detail(actorId: string, rawId: unknown, query: unknown) {
    await this.admin(actorId);
    const id = new ZodValidationPipe(phase4IdSchema).transform(rawId);
    const row = await this.safe(() => this.repo.detail(id));
    if (!row)
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Tài khoản không tồn tại.",
      });
    new ZodValidationPipe(noQuerySchema).transform(query ?? {});
    return this.view(row, true);
  }
  async status(actorId: string, rawId: unknown, body: unknown, query: unknown) {
    await this.admin(actorId);
    const id = new ZodValidationPipe(phase4IdSchema).transform(rawId);
    const result = await this.safe(() =>
      this.repo.transaction(async (tx) => {
        const locked = await this.repo.lockUsers(tx, [actorId, id]);
        await this.admin(actorId, tx);
        const target = locked.find((user) => user.id === id);
        if (!target || target.deletedAt)
          throw new NotFoundException({
            code: "NOT_FOUND",
            message: "Tài khoản không tồn tại.",
          });
        if (target.role === "admin")
          throw new ForbiddenException({
            code: "FORBIDDEN",
            message: "Không được thay đổi trạng thái tài khoản Admin.",
          });
        new ZodValidationPipe(noQuerySchema).transform(query ?? {});
        const input = new ZodValidationPipe(userStatusUpdateSchema).transform(
          body,
        );
        if (input.status === target.status)
          return { view: this.view(target, true), changed: false };
        if (input.status === "suspended")
          await this.auth.invalidateSessions(tx, id);
        const row = await this.repo.status(tx, id, input.status);
        await writeAudit(tx, {
          actorId,
          action: "user.status_changed",
          entityId: id,
          before: { status: target.status },
          after: { status: input.status },
        });
        return {
          view: this.view(row, true),
          changed: input.status === "suspended",
        };
      }),
    );
    if (result.changed) invalidateLocalSockets(id);
    return result.view;
  }
}
