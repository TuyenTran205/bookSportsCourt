import { SetMetadata } from "@nestjs/common";
import type { UserRole } from "../../../../../packages/shared/src/constants.js";

export const ROLES_KEY = Symbol("roles");
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
