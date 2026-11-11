import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../../../../../packages/shared/src/types.js";
import { AuthService } from "../../modules/auth/auth.service.js";
import { cookie, type AuthRequest } from "../../modules/auth/auth-http.js";

export interface AuthenticatedRequest extends AuthRequest {
  user?: AuthenticatedUser;
  params: Record<string, string | undefined>;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    // Never reuse a user object from client input or a previous middleware.
    delete request.user;
    request.user = await this.auth.me(cookie(request, "access_token"));
    return true;
  }
}
