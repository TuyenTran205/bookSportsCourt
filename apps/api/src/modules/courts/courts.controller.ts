import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  createCourtSchema,
  pricingRuleSchema,
  updateCourtSchema,
  updateOpeningHoursSchema,
  updatePricingRuleSchema,
} from "../../../../../packages/shared/src/schemas.js";
import type { AuthenticatedUser } from "../../../../../packages/shared/src/types.js";
import { parseBody } from "../../common/utils/parse-body.js";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../common/guards/roles.guard.js";
import { OwnershipGuard } from "../../common/guards/ownership.guard.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { CheckOwnership } from "../../common/decorators/check-ownership.decorator.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { CourtsService } from "./courts.service.js";

@ApiTags("Courts")
@Controller()
export class CourtsController {
  constructor(private readonly service: CourtsService) {}

  @Get("venues/:id/courts")
  @ApiOperation({ summary: "Danh sách sân con của cơ sở (public)" })
  getCourts(
    @Param("id") venueId: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const isOwnerOrAdmin =
      user?.role === "admin" || (user?.role === "owner" && !!user.id);
    return this.service.getCourts(venueId, isOwnerOrAdmin);
  }

  @Post("venues/:id/courts")
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles("owner")
  @CheckOwnership("venue", "id")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Owner] Tạo sân con" })
  createCourt(
    @Param("id") venueId: string,
    @Body() body: unknown,
  ) {
    const input = parseBody(createCourtSchema, body);
    return this.service.createCourt(venueId, input);
  }

  @Patch("courts/:id")
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles("owner")
  @CheckOwnership("court", "id")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Owner] Cập nhật sân con" })
  updateCourt(
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const input = parseBody(updateCourtSchema, body);
    return this.service.updateCourt(id, input);
  }

  @Delete("courts/:id")
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles("owner")
  @CheckOwnership("court", "id")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Owner] Xoá mềm sân con" })
  deleteCourt(@Param("id") id: string) {
    return this.service.deleteCourt(id);
  }

  // ===== Opening Hours =====

  @Get("courts/:id/opening-hours")
  @ApiOperation({ summary: "Xem giờ mở cửa của sân (public)" })
  getOpeningHours(@Param("id") id: string) {
    return this.service.getOpeningHours(id);
  }

  @Put("courts/:id/opening-hours")
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles("owner")
  @CheckOwnership("court", "id")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Owner] Cập nhật giờ mở cửa của sân" })
  updateOpeningHours(
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const input = parseBody(updateOpeningHoursSchema, body);
    return this.service.updateOpeningHours(id, input);
  }

  // ===== Pricing Rules =====

  @Get("courts/:id/pricing-rules")
  @ApiOperation({ summary: "Xem bảng giá của sân" })
  getPricingRules(@Param("id") id: string) {
    return this.service.getPricingRules(id);
  }

  @Post("courts/:id/pricing-rules")
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles("owner")
  @CheckOwnership("court", "id")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Owner] Tạo khung giá cho sân" })
  createPricingRule(
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const input = parseBody(pricingRuleSchema, body);
    return this.service.createPricingRule(id, input);
  }

  @Patch("courts/:id/pricing-rules/:ruleId")
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles("owner")
  @CheckOwnership("court", "id")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Owner] Cập nhật khung giá" })
  updatePricingRule(
    @Param("id") courtId: string,
    @Param("ruleId") ruleId: string,
    @Body() body: unknown,
  ) {
    const input = parseBody(updatePricingRuleSchema, body);
    return this.service.updatePricingRule(courtId, ruleId, input);
  }

  @Delete("courts/:id/pricing-rules/:ruleId")
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles("owner")
  @CheckOwnership("court", "id")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Owner] Xoá khung giá" })
  deletePricingRule(
    @Param("id") courtId: string,
    @Param("ruleId") ruleId: string,
  ) {
    return this.service.deletePricingRule(courtId, ruleId);
  }

  // ── Cấu hình cấp cơ sở (màn "Kênh chủ sân" của FE) ──────────────────────
  // FE cấu hình giờ mở cửa / bảng giá một lần cho cả cơ sở, trong khi DB lưu
  // theo từng sân con. Các route dưới đây làm cầu nối: đọc theo sân chính và
  // ghi áp dụng cho toàn bộ sân con (xem CourtsService).

  @Get("owner/venues/:id/opening-hours")
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles("owner")
  @CheckOwnership("venue", "id")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Owner] Giờ mở cửa cấp cơ sở" })
  getVenueOpeningHours(@Param("id") venueId: string) {
    return this.service.getVenueOpeningHours(venueId);
  }

  @Put("owner/venues/:id/opening-hours")
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles("owner")
  @CheckOwnership("venue", "id")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Owner] Thay toàn bộ giờ mở cửa cấp cơ sở" })
  replaceVenueOpeningHours(
    @Param("id") venueId: string,
    @Body() body: unknown,
  ) {
    const input = updateOpeningHoursSchema.parse(
      (body as { hours?: unknown } | null)?.hours ?? body,
    );
    return this.service.updateVenueOpeningHours(venueId, input);
  }

  @Get("owner/venues/:id/pricing-rules")
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles("owner")
  @CheckOwnership("venue", "id")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Owner] Bảng giá cấp cơ sở" })
  getVenuePricingRules(@Param("id") venueId: string) {
    return this.service.getVenuePricingRules(venueId);
  }

  @Post("owner/venues/:id/pricing-rules")
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles("owner")
  @CheckOwnership("venue", "id")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Owner] Thêm khung giá cho toàn bộ sân con" })
  createVenuePricingRule(@Param("id") venueId: string, @Body() body: unknown) {
    return this.service.createVenuePricingRule(venueId, parseBody(pricingRuleSchema, body));
  }

  /** FE gọi `DELETE /owner/pricing-rules/:ruleId` — quyền sở hữu suy ra từ sân. */
  @Delete("owner/pricing-rules/:ruleId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("owner", "admin")
  @ApiCookieAuth("access_token")
  @HttpCode(204)
  @ApiOperation({ summary: "[Owner] Xoá khung giá (áp cho mọi sân con)" })
  deleteOwnerPricingRule(
    @Param("ruleId") ruleId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.deleteOwnerPricingRule(user.id, ruleId);
  }
}
