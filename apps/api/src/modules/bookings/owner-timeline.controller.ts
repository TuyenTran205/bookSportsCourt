import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { AuthenticatedUser } from "../../../../../packages/shared/src/types.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../common/guards/roles.guard.js";
import { OwnerReportingService } from "./owner-reporting.service.js";

@ApiTags("Owner timeline")
@ApiCookieAuth("access_token")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("owner", "admin")
@Controller("owner/timeline")
export class OwnerTimelineController {
  constructor(private readonly service: OwnerReportingService) {}

  @Get()
  @ApiOperation({
    summary: "[Owner] Xem dữ liệu timeline ngày của cơ sở (OWN-06)",
  })
  @ApiQuery({
    name: "venueId",
    required: true,
    schema: { type: "string", format: "uuid" },
  })
  @ApiQuery({
    name: "date",
    required: true,
    schema: { type: "string", example: "2026-11-10" },
  })
  @ApiResponse({ status: 200, description: "Timeline ngày của cơ sở" })
  getTimeline(
    @CurrentUser() user: AuthenticatedUser,
    @Query("venueId") venueId: string,
    @Query("date") date: string,
  ) {
    return this.service.getTimeline(user, venueId, date);
  }
}
