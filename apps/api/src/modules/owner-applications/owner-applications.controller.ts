import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBody,
} from "@nestjs/swagger";
import type { AuthenticatedUser } from "../../../../../packages/shared/src/types.js";
import {
  applicationResponseOpenApi,
  applicationListOpenApi,
  applicationInputOpenApi,
  applicationDecisionOpenApi,
} from "./owner-applications.swagger.js";
import { OWNER_APPLICATION_STATUSES } from "../../../../../packages/shared/src/constants.js";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../common/guards/roles.guard.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { OwnerApplicationsService } from "./owner-applications.service.js";

@ApiTags("Owner Applications")
@ApiResponse({
  status: 400,
  description: "VALIDATION_ERROR / INVALID_STATUS_TRANSITION",
})
@ApiResponse({ status: 401, description: "UNAUTHORIZED / TOKEN_EXPIRED" })
@ApiResponse({ status: 403, description: "FORBIDDEN / ACCOUNT_SUSPENDED" })
@ApiResponse({ status: 404, description: "NOT_FOUND" })
@ApiResponse({
  status: 409,
  description: "ALREADY_EXISTS / RESOURCE_STATE_CONFLICT",
})
@ApiResponse({ status: 500, description: "INTERNAL_ERROR" })
@ApiResponse({ status: 503, description: "SERVICE_UNAVAILABLE" })
@Controller()
export class OwnerApplicationsController {
  constructor(private readonly service: OwnerApplicationsService) {}

  @Post("owner-applications")
  @Header("Cache-Control", "no-store")
  @ApiBody({ schema: applicationInputOpenApi })
  @ApiResponse({ status: 201, schema: applicationResponseOpenApi })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("customer")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Customer] Đăng ký làm chủ sân (OWN-01)" })
  apply(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
    @Query() query: unknown,
  ) {
    return this.service.apply(user.id, body, query);
  }

  @Get("owner-applications/me")
  @Header("Cache-Control", "no-store")
  @ApiResponse({ status: 200, schema: applicationResponseOpenApi })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("customer", "owner")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Customer/Owner] Trạng thái hồ sơ của tôi" })
  getMyApplication(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: unknown,
  ) {
    return this.service.getMyApplication(user.id, query);
  }

  @Get("admin/owner-applications")
  @Header("Cache-Control", "no-store")
  @ApiResponse({ status: 200, schema: applicationListOpenApi })
  @ApiQuery({
    name: "status",
    required: false,
    enum: [...OWNER_APPLICATION_STATUSES, "all"],
    schema: { default: "pending" },
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Admin] Danh sách hồ sơ đăng ký chủ sân" })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    return this.service.list(user.id, query);
  }

  @Patch("admin/owner-applications/:id")
  @Header("Cache-Control", "no-store")
  @ApiParam({ name: "id", schema: { type: "string", format: "uuid" } })
  @ApiBody({ schema: applicationDecisionOpenApi })
  @ApiResponse({ status: 200, schema: applicationResponseOpenApi })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Admin] Duyệt / từ chối hồ sơ đăng ký chủ sân" })
  review(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
    @Query() query: unknown,
  ) {
    return this.service.review(id, user.id, body, query);
  }
}
