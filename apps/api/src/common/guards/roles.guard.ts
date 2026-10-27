import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { UserRole } from "../../../../../packages/shared/src/constants.js";
import { ROLES_KEY } from "../decorators/roles.decorator.js";
import type { AuthenticatedRequest } from "./jwt-auth.guard.js";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user) throw new UnauthorizedException();
    const roles = this.reflector.getAllAndOverride<readonly UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (roles !== undefined && !roles.includes(user.role))
      throw new ForbiddenException();
    return true;
  }
}
