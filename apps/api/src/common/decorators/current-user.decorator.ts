import {
  createParamDecorator,
  UnauthorizedException,
  type ExecutionContext,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../../../../../packages/shared/src/types.js";

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const user = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>().user;
    if (!user) throw new UnauthorizedException();
    return user;
  },
);
