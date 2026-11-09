import { Controller, Get, Header, Query, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { BOOKING_STATUSES } from "../../../../../packages/shared/src/constants.js";
import type { AuthenticatedUser } from "../../../../../packages/shared/src/types.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../common/guards/roles.guard.js";
import { AdminReportingService } from "./admin-reporting.service.js";
import {
  bookingListResponse,
  statsResponse,
} from "./admin-reporting.swagger.js";
@ApiTags("Admin reporting")
@ApiCookieAuth("access_token")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
@ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
@ApiResponse({ status: 401, description: "UNAUTHORIZED / TOKEN_EXPIRED" })
@ApiResponse({ status: 403, description: "FORBIDDEN / ACCOUNT_SUSPENDED" })
@ApiResponse({ status: 500, description: "INTERNAL_ERROR" })
@ApiResponse({
  status: 503,
  description: "SERVICE_UNAVAILABLE (unsafe integer)",
})
@ApiQuery({
  name: "from",
  required: false,
  schema: { type: "string", format: "date" },
  description:
    "Asia/Ho_Chi_Minh, inclusive; send with to, max366 days; default current month",
})
@ApiQuery({
  name: "to",
  required: false,
  schema: { type: "string", format: "date" },
  description: "Inclusive Vietnam date; send with from",
})
@Controller("admin")
export class AdminReportingController {
  constructor(private readonly service: AdminReportingService) {}
  @Get("bookings")
  @Header("Cache-Control", "no-store")
  @ApiQuery({ name: "status", required: false, enum: [...BOOKING_STATUSES] })
  @ApiQuery({
    name: "venueId",
    required: false,
    schema: { type: "string", format: "uuid" },
  })
  @ApiQuery({
    name: "customerId",
    required: false,
    schema: { type: "string", format: "uuid" },
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
  @ApiResponse({ status: 200, schema: bookingListResponse })
  bookings(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    return this.service.bookings(user.id, query);
  }
  @Get("stats")
  @Header("Cache-Control", "no-store")
  @ApiQuery({
    name: "groupBy",
    required: false,
    enum: ["day", "week", "month"],
    schema: { default: "day" },
  })
  @ApiResponse({ status: 200, schema: statsResponse })
  stats(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    return this.service.stats(user.id, query);
  }
}
