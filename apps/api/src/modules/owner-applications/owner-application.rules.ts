import { BadRequestException, ConflictException } from "@nestjs/common";
import type { ownerApplications, users } from "../../database/schema/index.js";
import type { OwnerApplicationDecisionInput } from "../../../../../packages/shared/src/phase4-schemas.js";

export function applicationDecision(
  app: typeof ownerApplications.$inferSelect,
  target: typeof users.$inferSelect | undefined,
  input: OwnerApplicationDecisionInput,
): "write" | "noop" {
  if (!target || target.deletedAt || target.status !== "active")
    throw new ConflictException({
      code: "RESOURCE_STATE_CONFLICT",
      message: "Tài khoản đăng ký không còn hoạt động.",
    });
  if (app.status !== "pending") {
    if (
      app.status === input.status &&
      app.reviewNote === (input.reviewNote ?? null) &&
      (app.status !== "approved" || target.role === "owner")
    )
      return "noop";
    throw new BadRequestException({
      code: "INVALID_STATUS_TRANSITION",
      message: "Quyết định hoặc tài khoản không còn phù hợp để duyệt lại.",
    });
  }
  if (target.role !== "customer")
    throw new ConflictException({
      code: "RESOURCE_STATE_CONFLICT",
      message: "Người đăng ký không còn là Customer.",
    });
  return "write";
}
