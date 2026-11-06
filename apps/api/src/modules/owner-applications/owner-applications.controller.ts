import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  ownerApplicationSchema,
  updateOwnerApplicationStatusSchema,
} from "../../../../../packages/shared/src/schemas.js";
import type { AuthenticatedUser } from "../../../../../packages/shared/src/types.js";
import { parseBody } from "../../common/utils/parse-body.js";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../common/guards/roles.guard.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { OwnerApplicationsService } from "./owner-applications.service.js";

@ApiTags("Owner Applications")
@Controller()
export class OwnerApplicationsController {
  constructor(private readonly service: OwnerApplicationsService) {}

  @Post("owner-applications")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("customer")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Customer] Đăng ký làm chủ sân (OWN-01)" })
  apply(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const input = parseBody(ownerApplicationSchema, body);
    return this.service.apply(user.id, user.role, input);
  }

  @Get("owner-applications/me")
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Customer/Owner] Trạng thái hồ sơ của tôi" })
  getMyApplication(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getMyApplication(user.id);
  }

  @Get("admin/owner-applications")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Admin] Danh sách hồ sơ đăng ký chủ sân" })
  list(
    @Query("status") status?: string,
    @Query("page") page = "1",
    @Query("limit") limit = "20",
  ) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    return this.service.list({ status, page: pageNum, limit: limitNum });
  }

  @Patch("admin/owner-applications/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Admin] Duyệt / từ chối hồ sơ đăng ký chủ sân" })
  review(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const input = parseBody(updateOwnerApplicationStatusSchema, body);
    return this.service.review(id, user.id, input);
  }
}
