import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { UserRole } from "../../../../../packages/shared/src/constants.js";
import { uuidSchema } from "../../../../../packages/shared/src/schemas.js";
import type { OwnershipPolicy } from "../../common/decorators/check-ownership.decorator.js";
import { AuthService } from "./auth.service.js";
import { OwnershipRepository } from "./ownership.repository.js";
import type { AuthTransaction } from "./auth.repository.js";

@Injectable()
export class OwnershipService {
  constructor(
    private readonly auth: AuthService,
    private readonly repo: OwnershipRepository,
  ) {}

  /** Services call this again in the same transaction as the sensitive write. */
  async assertOwnership(
    userId: string,
    id: unknown,
    policy: OwnershipPolicy,
    allowedRoles: readonly UserRole[],
    tx?: AuthTransaction,
  ): Promise<void> {
    const user = await this.auth.requireActiveUser(userId, tx);
    if (
      !allowedRoles.includes(user.role) ||
      !["owner", "admin"].includes(user.role)
    )
      throw new ForbiddenException();
    const parsed = uuidSchema.safeParse(id);
    if (!parsed.success)
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "ID tài nguyên không hợp lệ.",
      });
    const resource = await this.repo.owner(policy.resource, parsed.data, tx);
    if (!resource) throw new NotFoundException();
    if (user.role === "admin" && policy.allowAdmin) return;
    if (user.role !== "owner" || resource.ownerId !== user.id) {
      throw new ForbiddenException({
        code: "NOT_VENUE_OWNER",
        message: "Bạn không phải chủ cơ sở này.",
      });
    }
  }
}
