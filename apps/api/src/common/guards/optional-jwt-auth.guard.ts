import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { AuthService } from "../../modules/auth/auth.service.js";
import { cookie } from "../../modules/auth/auth-http.js";
import type { AuthenticatedRequest } from "./jwt-auth.guard.js";

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    delete request.user;
    const token = cookie(request, "access_token");
    if (!token) {
      return true;
    }
    try {
      request.user = await this.auth.me(token);
    } catch {
      delete request.user;
    }
    return true;
  }
}
