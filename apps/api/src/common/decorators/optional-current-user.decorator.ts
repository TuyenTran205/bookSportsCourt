import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthenticatedUser } from "../../../../../packages/shared/src/types.js";

/**
 * Như `CurrentUser` nhưng trả `undefined` khi request chưa xác thực, thay vì
 * ném 401. Chỉ dùng cùng `OptionalJwtAuthGuard` ở route công khai — route bảo
 * vệ vẫn dùng `CurrentUser` để không vô tình bỏ qua kiểm tra danh tính.
 */
export const OptionalCurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser | undefined =>
    context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user,
);