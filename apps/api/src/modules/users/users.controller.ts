import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBody,
  ApiCookieAuth,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  USER_ROLES,
  USER_STATUSES,
} from "../../../../../packages/shared/src/constants.js";
import { userStatusUpdateSchema } from "../../../../../packages/shared/src/phase4-schemas.js";
import type { AuthenticatedUser } from "../../../../../packages/shared/src/types.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../common/guards/roles.guard.js";
import { UsersService } from "./users.service.js";
import { userDetailResponse, userListResponse } from "./users.swagger.js";
@ApiTags("Admin users")
@ApiCookieAuth("access_token")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
@ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
@ApiResponse({ status: 401, description: "UNAUTHORIZED / TOKEN_EXPIRED" })
@ApiResponse({ status: 403, description: "FORBIDDEN / ACCOUNT_SUSPENDED" })
@ApiResponse({ status: 404, description: "NOT_FOUND" })
@ApiResponse({ status: 500, description: "INTERNAL_ERROR" })
@ApiResponse({ status: 503, description: "SERVICE_UNAVAILABLE" })
@Controller()
export class UsersController {
  constructor(private readonly service: UsersService) {}
  @Get("admin/users")
  @Header("Cache-Control", "no-store")
  @ApiQuery({ name: "role", required: false, enum: [...USER_ROLES] })
  @ApiQuery({ name: "status", required: false, enum: [...USER_STATUSES] })
  @ApiQuery({
    name: "q",
    required: false,
    schema: { type: "string", maxLength: 200 },
  })
  @ApiQuery({
    name: "page",
    required: false,
    schema: {
      type: "integer",
      minimum: 1,
      maximum: Number.MAX_SAFE_INTEGER,
      default: 1,
    },
  })
  @ApiQuery({
    name: "limit",
    required: false,
    schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
  })
  @ApiResponse({ status: 200, schema: userListResponse })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    return this.service.list(user.id, query);
  }
  @Get("users/:id")
  @Header("Cache-Control", "no-store")
  @ApiParam({ name: "id", schema: { type: "string", format: "uuid" } })
  @ApiResponse({ status: 200, schema: userDetailResponse })
  detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Query() query: unknown,
  ) {
    return this.service.detail(user.id, id, query);
  }
  @Patch("users/:id/status")
  @Header("Cache-Control", "no-store")
  @ApiParam({ name: "id", schema: { type: "string", format: "uuid" } })
  @ApiBody({
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["status"],
      properties: {
        status: {
          type: "string",
          enum: [...userStatusUpdateSchema.shape.status.options],
        },
      },
    },
  })
  @ApiResponse({ status: 200, schema: userDetailResponse })
  status(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: unknown,
    @Query() query: unknown,
  ) {
    return this.service.status(user.id, id, body, query);
  }
}
