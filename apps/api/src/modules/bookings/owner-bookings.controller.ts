import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
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

@ApiTags("Owner bookings")
@ApiCookieAuth("access_token")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("owner", "admin")
@Controller("owner/bookings")
export class OwnerBookingsController {
  constructor(private readonly service: OwnerReportingService) {}

  @Get()
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "[Owner] Xem bookings của venue mình" })
  @ApiResponse({ status: 200, description: "Danh sách đơn đặt sân của cơ sở" })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query()
    query: {
      venueId?: string;
      courtId?: string;
      status?: string;
      from?: string;
      to?: string;
      q?: string;
      page?: number;
      limit?: number;
    },
  ) {
    return this.service.listBookings(user, query);
  }

  @Post("manual")
  @HttpCode(201)
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "[Owner] Tạo booking thủ công trực tiếp tại quầy",
  })
  @ApiResponse({ status: 201, description: "Booking confirmed và cash payment" })
  createManual(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      courtId: string;
      start: string;
      end: string;
      guestName?: string;
      guestPhone?: string;
      customerId?: string;
      note?: string;
      totalPrice?: number;
    },
  ) {
    return this.service.createManualBooking(user, body);
  }
}
