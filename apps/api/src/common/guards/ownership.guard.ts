import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { UserRole } from "../../../../../packages/shared/src/constants.js";
import {
  OWNERSHIP_KEY,
  type OwnershipPolicy,
} from "../decorators/check-ownership.decorator.js";
import { ROLES_KEY } from "../decorators/roles.decorator.js";
import type { AuthenticatedRequest } from "./jwt-auth.guard.js";
import { OwnershipService } from "../../modules/auth/ownership.service.js";

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly ownership: OwnershipService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) throw new UnauthorizedException();
    const targets = [context.getHandler(), context.getClass()];
    const policy = this.reflector.getAllAndOverride<OwnershipPolicy>(
      OWNERSHIP_KEY,
      targets,
    );
    const roles = this.reflector.getAllAndOverride<readonly UserRole[]>(
      ROLES_KEY,
      targets,
    );
    // Missing route configuration must never silently permit access.
    if (!policy || !roles) throw new ForbiddenException();
    await this.ownership.assertOwnership(
      request.user.id,
      request.params[policy.param],
      policy,
      roles,
    );
    return true;
  }
}
