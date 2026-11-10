import {
  Controller,
  Get,
  Header,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { AuthenticatedUser } from "../../../../../packages/shared/src/types.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../common/guards/roles.guard.js";
import { OwnerReportingService } from "./owner-reporting.service.js";

@ApiTags("Owner reports")
@ApiCookieAuth("access_token")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("owner", "admin")
@Controller("owner/reports")
export class OwnerReportsController {
  constructor(private readonly service: OwnerReportingService) {}

  @Get("revenue")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "[Owner] Báo cáo doanh thu theo cơ sở & sân con (OWN-11)",
  })
  @ApiResponse({ status: 200, description: "Báo cáo doanh thu và chuỗi ngày" })
  getRevenue(
    @CurrentUser() user: AuthenticatedUser,
    @Query()
    query: {
      from?: string;
      to?: string;
      groupBy?: "day" | "week" | "month";
      venueId?: string;
      courtId?: string;
    },
  ) {
    return this.service.getRevenueReport(user, query);
  }

  @Get("occupancy")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "[Owner] Báo cáo tỷ lệ lấp đầy và giờ cao điểm (OWN-12)",
  })
  @ApiResponse({ status: 200, description: "Báo cáo lấp đầy và peak hours" })
  getOccupancy(
    @CurrentUser() user: AuthenticatedUser,
    @Query()
    query: {
      from?: string;
      to?: string;
      venueId?: string;
      courtId?: string;
    },
  ) {
    return this.service.getOccupancyReport(user, query);
  }
}
