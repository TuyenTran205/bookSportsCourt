/**
 * Core Booking & Time Slot Grid Controller (Đợt 1).
 *
 * Cơ chế cập nhật trạng thái lưới giờ (Realtime & Polling Cursor):
 * 1. Transactional Outbox (`outbox_deliveries`): Mọi thay đổi trạng thái slot (tạo hold,
 *    huỷ booking, xác nhận, cron expire) đều ghi sự kiện `slot_refresh_requested`,
 *    `booking_created`, `booking_cancelled`, `hold_expired` trong cùng transaction DB
 *    để Socket.IO Gateway phát tới room `venue:{venueId}:date:{yyyy-mm-dd}`, `user:{id}`, `owner:{id}`.
 * 2. HTTP Cursor Header (`X-Grid-Version` & `ETag`): Endpoint `GET /venues/:id/slots`
 *    luôn trả kèm header `X-Grid-Version` (ISO timestamp `max(updated_at)` của các bản ghi
 *    booking/blackout/court trong ngày) và `Cache-Control: no-store`, cho phép client
 *    kiểm tra nhanh phiên bản lưới giờ khi polling dự phòng hoặc đồng bộ lại sau reconnect.
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import type { AuthenticatedUser } from "../../../../../packages/shared/src/types.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import {
  JwtAuthGuard,
  type AuthenticatedRequest,
} from "../../common/guards/jwt-auth.guard.js";
import { OptionalJwtAuthGuard } from "../../common/guards/optional-jwt-auth.guard.js";
import { RolesGuard } from "../../common/guards/roles.guard.js";
import { BookingsService } from "./bookings.service.js";

type PassthroughResponse = {
  status(code: number): unknown;
  setHeader(name: string, value: string): unknown;
};

@ApiTags("Bookings")
@Controller()
export class BookingsController {
  constructor(private readonly service: BookingsService) {}

  @Get("venues/:id/slots")
  @UseGuards(OptionalJwtAuthGuard)
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "Lưới giờ 30 phút theo ngày của cơ sở (CUS-07, Public)",
  })
  async getVenueSlots(
    @Param("id") venueIdOrSlug: string,
    @Query() query: unknown,
    @Res({ passthrough: true }) res: PassthroughResponse,
    @Req() req: AuthenticatedRequest,
  ) {
    const queryObj =
      query && typeof query === "object"
        ? (query as Record<string, unknown>)
        : {};
    const result = await this.service.getVenueSlots(
      venueIdOrSlug,
      queryObj,
      req.user,
    );
    res.setHeader("X-Grid-Version", result.gridVersion);
    return result.data;
  }

  @Post("bookings/hold")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("customer")
  @ApiCookieAuth("access_token")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "[Customer] Giữ chỗ tạm thời 10 phút (CUS-08)",
  })
  async createHold(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Res({ passthrough: true }) res: PassthroughResponse,
  ) {
    const result = await this.service.createHold(user, body, idempotencyKey);
    res.status(result.statusCode);
    return result.data;
  }

  @Post("bookings/quote")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "Xem báo giá tạm tính và tiền cọc cho các khung giờ chọn",
  })
  quoteBooking(@Body() body: unknown) {
    return this.service.quoteBooking(body);
  }

  @Get("bookings/hold/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("customer")
  @ApiCookieAuth("access_token")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "[Customer] Lấy trạng thái giữ chỗ và thời gian đếm ngược",
  })
  getHold(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.service.getHoldById(user, id);
  }

  @Delete("bookings/holds/:holdId")
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("customer")
  @ApiCookieAuth("access_token")
  @ApiOperation({
    summary: "[Customer] Nhả giữ chỗ chủ động (204 No Content)",
  })
  async releaseHold(
    @CurrentUser() user: AuthenticatedUser,
    @Param("holdId") holdId: string,
  ): Promise<void> {
    await this.service.releaseHold(user, holdId);
  }

  @Post("bookings/:id/confirm")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("customer")
  @ApiCookieAuth("access_token")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "[Customer] Xác nhận lượt giữ chỗ còn hiệu lực sang confirmed",
  })
  confirmBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.service.confirmBooking(user, id);
  }

  @Get("bookings")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("customer")
  @ApiCookieAuth("access_token")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "[Customer] Danh sách lịch sử đặt sân của tôi (CUS-10)",
  })
  listMyBookings(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: unknown,
  ) {
    const queryObj =
      query && typeof query === "object"
        ? (query as Record<string, unknown>)
        : {};
    return this.service.listMyBookings(user, queryObj);
  }

  @Get("bookings/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("customer", "owner", "admin")
  @ApiCookieAuth("access_token")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "Chi tiết đơn đặt sân (CUS-10)",
  })
  getBookingById(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.service.getBookingById(user, id);
  }

  @Get("bookings/:id/cancellation-preview")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("customer")
  @ApiCookieAuth("access_token")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "[Customer] Xem điều kiện huỷ và số tiền hoàn trước khi xác nhận (CUS-11)",
  })
  getCancellationPreview(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.service.getCancellationPreview(user, id);
  }

  @Patch("bookings/:id/cancel")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("customer", "owner", "admin")
  @ApiCookieAuth("access_token")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "Huỷ đơn đặt sân theo chính sách (CUS-11)",
  })
  cancelBookingPatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.cancelBooking(user, id, body);
  }

  @Post("bookings/:id/cancel")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("customer", "owner", "admin")
  @ApiCookieAuth("access_token")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "Huỷ đơn đặt sân (alias POST tương thích ngược)",
  })
  cancelBookingPost(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.cancelBooking(user, id, body);
  }

  @Patch("bookings/:id/no-show")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("owner", "admin")
  @ApiCookieAuth("access_token")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "[Owner] Đánh dấu khách không đến nhận sân (OWN-09)",
  })
  markNoShowPatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.service.markNoShow(user, id);
  }

  @Post("owner/bookings/:id/no-show")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("owner", "admin")
  @ApiCookieAuth("access_token")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "[Owner] Đánh dấu khách không đến nhận sân (alias POST)",
  })
  markNoShowPost(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.service.markNoShow(user, id);
  }
}
