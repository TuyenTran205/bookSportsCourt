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
  cancelBookingSchema,
  createHoldSchema,
  createManualBookingSchema,
} from "../../../../../packages/shared/src/schemas.js";
import type { AuthenticatedUser } from "../../../../../packages/shared/src/types.js";
import { parseBody } from "../../common/utils/parse-body.js";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../common/guards/roles.guard.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { BookingsService } from "./bookings.service.js";

@ApiTags("Slots")
@Controller("venues")
export class VenuesSlotsController {
  constructor(private readonly service: BookingsService) {}

  @Get(":id/slots")
  @ApiOperation({
    summary: "Lấy trạng thái ma trận slots 30 phút theo ngày của cơ sở",
  })
  getSlots(
    @Param("id") venueId: string,
    @Query("date") date: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.service.getSlots(venueId, date, user?.id);
  }
}

@ApiTags("Bookings")
@Controller("bookings")
export class BookingsController {
  constructor(private readonly service: BookingsService) {}

  @Post("hold")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("customer")
  @ApiCookieAuth("access_token")
  @ApiOperation({
    summary:
      "[Customer] Giữ chỗ block 30 phút trong 10 phút để chuẩn bị thanh toán",
  })
  createHold(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const input = parseBody(createHoldSchema, body);
    return this.service.createHold(user.id, input);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("customer")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Customer] Lịch sử đặt sân của tôi" })
  getMyBookings(
    @CurrentUser() user: AuthenticatedUser,
    @Query("status") status?: string,
    @Query("page") page = "1",
    @Query("limit") limit = "20",
  ) {
    return this.service.getCustomerBookings(user.id, {
      status,
      page: Math.max(1, parseInt(page, 10) || 1),
      limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 20)),
    });
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "Xem chi tiết đơn đặt sân" })
  getBookingDetails(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getBookingDetails(id, user);
  }

  @Get(":id/cancellation-preview")
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth("access_token")
  @ApiOperation({
    summary: "Xem trước điều kiện huỷ và số tiền được hoàn theo chính sách",
  })
  previewCancellation(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.previewCancellation(id, user);
  }

  @Patch(":id/cancel")
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "Huỷ đơn đặt sân" })
  cancelBooking(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const input = parseBody(cancelBookingSchema, body);
    return this.service.cancelBooking(id, user, input);
  }

  @Patch(":id/no-show")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("owner")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Owner] Đánh dấu khách không đến sân" })
  markNoShow(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.markNoShow(id, user.id);
  }
}

@ApiTags("Owner Bookings")
@Controller("owner/bookings")
export class OwnerBookingsController {
  constructor(private readonly service: BookingsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("owner")
  @ApiCookieAuth("access_token")
  @ApiOperation({
    summary: "[Owner] Danh sách đặt sân tại các cơ sở của tôi",
  })
  getOwnerBookings(
    @CurrentUser() user: AuthenticatedUser,
    @Query("venueId") venueId?: string,
    @Query("courtId") courtId?: string,
    @Query("status") status?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("page") page = "1",
    @Query("limit") limit = "20",
  ) {
    return this.service.getOwnerBookings(user.id, {
      venueId,
      courtId,
      status,
      from,
      to,
      page: Math.max(1, parseInt(page, 10) || 1),
      limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 20)),
    });
  }

  @Post("manual")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("owner")
  @ApiCookieAuth("access_token")
  @ApiOperation({
    summary:
      "[Owner] Đặt sân trực tiếp tại quầy (xác nhận ngay, thanh toán tiền mặt)",
  })
  createManualBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const input = parseBody(createManualBookingSchema, body);
    return this.service.createManualBooking(user.id, input);
  }
}
