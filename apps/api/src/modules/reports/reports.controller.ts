import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ownerReportQuerySchema } from "../../../../../packages/shared/src/schemas.js";
import type { AuthenticatedUser } from "../../../../../packages/shared/src/types.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../common/guards/roles.guard.js";
import { parseBody } from "../../common/utils/parse-body.js";
import { OwnerService } from "../owner/owner.service.js";

@ApiTags("Reports")
@ApiCookieAuth("access_token")
@Controller("owner/reports")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("owner")
export class ReportsController {
  constructor(private readonly ownerService: OwnerService) {}

  @Get("revenue")
  @ApiOperation({ summary: "Báo cáo doanh thu theo ngày/tuần/tháng" })
  getRevenue(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: Record<string, unknown>,
  ) {
    return this.ownerService.getRevenue(
      user.id,
      parseBody(ownerReportQuerySchema, query),
    );
  }

  @Get("occupancy")
  @ApiOperation({ summary: "Báo cáo công suất sử dụng sân" })
  getOccupancy(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: Record<string, unknown>,
  ) {
    return this.ownerService.getOccupancy(
      user.id,
      parseBody(ownerReportQuerySchema, query),
    );
  }
}