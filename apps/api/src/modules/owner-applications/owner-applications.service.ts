import {
  ForbiddenException,
  ConflictException,
  Injectable,
  NotFoundException,
  HttpException,
  InternalServerErrorException,
  ServiceUnavailableException,
  Logger,
} from "@nestjs/common";
import { OwnerApplicationsRepository } from "./owner-applications.repository.js";
import { AuthService } from "../auth/auth.service.js";
import { ownerApplicationSchema } from "../../../../../packages/shared/src/schemas.js";
import {
  adminOwnerApplicationQuerySchema,
  ownerApplicationDecisionSchema,
  phase4IdSchema,
  noQuerySchema,
} from "../../../../../packages/shared/src/phase4-schemas.js";
import { ownerApplicationViewSchema } from "../../../../../packages/shared/src/phase4-responses.js";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe.js";
import type { z } from "zod";
import { applicationDecision } from "./owner-application.rules.js";
import type { AuthTransaction } from "../auth/auth.repository.js";
import { invalidateLocalSockets } from "../auth/session-context.js";

function validate<T extends z.ZodTypeAny>(schema: T, raw: unknown) {
  return new ZodValidationPipe(schema).transform(raw);
}

@Injectable()
export class OwnerApplicationsService {
  private readonly logger = new Logger(OwnerApplicationsService.name);

  constructor(
    private readonly repo: OwnerApplicationsRepository,
    private readonly auth: AuthService,
  ) {}
  private async role(id: string, roles: string[], tx?: AuthTransaction) {
    const user = await this.auth.requireActiveUser(id, tx);
    if (!roles.includes(user.role))
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Không có quyền thực hiện thao tác này.",
      });
    return user;
  }
  private view(
    app: NonNullable<
      Awaited<ReturnType<OwnerApplicationsRepository["findById"]>>
    >,
  ) {
    return ownerApplicationViewSchema.parse({
      id: app.id,
      userId: app.userId,
      businessName: app.businessName,
      phone: app.phone,
      address: app.address,
      lat: app.lat !== null && app.lat !== undefined ? Number(app.lat) : null,
      lng: app.lng !== null && app.lng !== undefined ? Number(app.lng) : null,
      note: app.note,
      taxCode: app.taxCode,
      bankBin: app.bankBin ?? null,
      bankName: app.bankName ?? null,
      accountNo: app.accountNo ?? null,
      accountName: app.accountName ?? null,
      status: app.status,
      reviewNote: app.reviewNote,
      reviewedBy: app.reviewedBy,
      reviewedAt: app.reviewedAt?.toISOString() ?? null,
      createdAt: app.createdAt.toISOString(),
      updatedAt: app.updatedAt.toISOString(),
    });
  }
  private async retry<T>(work: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await work();
      } catch (error) {
        let cause: unknown = error;
        let retry = false;
        const seen = new Set<unknown>();
        while (cause && typeof cause === "object" && !seen.has(cause)) {
          seen.add(cause);
          if (
            "code" in cause &&
            ["40001", "40P01"].includes(String(cause.code))
          )
            retry = true;
          if (
            "code" in cause &&
            cause.code === "23505" &&
            "constraint" in cause &&
            cause.constraint === "uq_owner_app_pending"
          )
            throw new ConflictException({
              code: "ALREADY_EXISTS",
              message: "Bạn đã có hồ sơ đang chờ duyệt.",
            });
          cause = "cause" in cause ? cause.cause : null;
        }
        if (retry && attempt < 2) continue;
        if (error instanceof HttpException) throw error;
        this.logger.error("Owner application processing failed:", error);
        if (retry)
          throw new ServiceUnavailableException({
            code: "SERVICE_UNAVAILABLE",
            message: "Hồ sơ đang được xử lý; vui lòng thử lại.",
          });
        throw new InternalServerErrorException({
          code: "INTERNAL_ERROR",
          message: "Không thể xử lý hồ sơ.",
        });
      }
    }
    throw new Error("Unreachable");
  }
  async apply(userId: string, body: unknown, query: unknown = {}) {
    return this.retry(() =>
      this.repo.transaction(async (tx) => {
        await this.role(userId, ["customer"], tx);
        validate(noQuerySchema, query);
        const input = validate(ownerApplicationSchema, body);
        if (await this.repo.findPendingByUserId(userId, tx))
          throw new ConflictException({
            code: "ALREADY_EXISTS",
            message: "Bạn đã có hồ sơ đang chờ duyệt.",
          });
        return this.view(await this.repo.create(userId, input, tx));
      }),
    );
  }
  async getMyApplication(userId: string, query: unknown = {}) {
    await this.role(userId, ["customer", "owner"]);
    validate(noQuerySchema, query);
    const app = await this.repo.findLatestByUserId(userId);
    if (!app)
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Không tìm thấy hồ sơ.",
      });
    return this.view(app);
  }
  async list(adminId: string, raw: unknown) {
    await this.role(adminId, ["admin"]);
    const query = validate(adminOwnerApplicationQuerySchema, raw);
    const result = await this.retry(() => this.repo.list(query));
    return {
      data: result.rows.map((app) => this.view(app)),
      meta: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / query.limit),
      },
    };
  }
  async review(
    raw: unknown,
    adminId: string,
    body: unknown,
    query: unknown = {},
  ) {
    await this.role(adminId, ["admin"]);
    const id = validate(phase4IdSchema, raw);
    const result = await this.retry(() =>
      this.repo.transaction(async (tx) => {
        const lookup = await this.repo.findById(id, tx);
        // Even a missing resource must not let a demoted/inactive actor bypass the live check.
        if (!lookup) {
          await this.role(adminId, ["admin"], tx);
          throw new NotFoundException({
            code: "NOT_FOUND",
            message: "Không tìm thấy hồ sơ.",
          });
        }
        const lockedUsers = await this.repo.lockUsers(tx, [
          adminId,
          lookup.userId,
        ]);
        await this.role(adminId, ["admin"], tx);
        const app = await this.repo.findById(id, tx, true);
        if (!app)
          throw new NotFoundException({
            code: "NOT_FOUND",
            message: "Không tìm thấy hồ sơ.",
          });
        if (app.userId !== lookup.userId)
          throw Object.assign(new Error("Application parent changed"), {
            code: "40001",
          });
        validate(noQuerySchema, query);
        const input = validate(ownerApplicationDecisionSchema, body);
        const decision = applicationDecision(
          app,
          lockedUsers.find((user) => user.id === app.userId),
          input,
        );
        if (decision === "noop")
          return {
            view: this.view(app),
            roleChanged: false,
            userId: app.userId,
          };
        return {
          view: this.view(await this.repo.decide(tx, app, adminId, input)),
          roleChanged: input.status === "approved",
          userId: app.userId,
        };
      }),
    );
    if (result.roleChanged) invalidateLocalSockets(result.userId);
    return result.view;
  }
}
