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
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  addVenueImageSchema,
  bankAccountSchema,
  cancellationPolicySchema,
  createVenueSchema,
  reorderVenueImagesSchema,
  updateVenueSchema,
  venueModerationSchema,
} from "../../../../../packages/shared/src/schemas.js";
import type { AuthenticatedUser } from "../../../../../packages/shared/src/types.js";
import { parseBody } from "../../common/utils/parse-body.js";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../common/guards/roles.guard.js";
import { OwnershipGuard } from "../../common/guards/ownership.guard.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { CheckOwnership } from "../../common/decorators/check-ownership.decorator.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { VenuesService } from "./venues.service.js";

@ApiTags("Venues")
@Controller("venues")
export class VenuesController {
  constructor(private readonly service: VenuesService) {}

  @Get()
  @ApiOperation({ summary: "Tìm kiếm cơ sở thể thao (public)" })
  search(
    @Query("q") q?: string,
    @Query("provinceId") provinceId?: string,
    @Query("districtId") districtId?: string,
    @Query("sportId") sportId?: string,
    @Query("amenityIds") amenityIds?: string,
    @Query("minPrice") minPrice?: string,
    @Query("maxPrice") maxPrice?: string,
    @Query("minRating") minRating?: string,
    @Query("sort") sort?: string,
    @Query("page") page = "1",
    @Query("limit") limit = "20",
  ) {
    return this.service.searchVenues({
      q,
      provinceId,
      districtId,
      sportId,
      amenityIds,
      minPrice: minPrice ? parseInt(minPrice, 10) : undefined,
      maxPrice: maxPrice ? parseInt(maxPrice, 10) : undefined,
      minRating: minRating ? parseFloat(minRating) : undefined,
      sort,
      page: Math.max(1, parseInt(page, 10) || 1),
      limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 20)),
    });
  }

  @Get("map")
  @ApiOperation({ summary: "Danh sách cơ sở cho bản đồ (public)" })
  getMap(
    @Query("provinceId") provinceId?: string,
    @Query("districtId") districtId?: string,
    @Query("sportId") sportId?: string,
    @Query("minLat") minLat?: string,
    @Query("maxLat") maxLat?: string,
    @Query("minLng") minLng?: string,
    @Query("maxLng") maxLng?: string,
  ) {
    return this.service.getMapVenues({
      provinceId,
      districtId,
      sportId,
      minLat: minLat ? parseFloat(minLat) : undefined,
      maxLat: maxLat ? parseFloat(maxLat) : undefined,
      minLng: minLng ? parseFloat(minLng) : undefined,
      maxLng: maxLng ? parseFloat(maxLng) : undefined,
    });
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("owner")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Owner] Tạo cơ sở thể thao mới" })
  createVenue(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const input = parseBody(createVenueSchema, body);
    return this.service.createVenue(user.id, input);
  }

  @Get(":slug")
  @ApiOperation({ summary: "Chi tiết cơ sở thể thao (nhận cả slug và UUID)" })
  getDetails(
    @Param("slug") slug: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.service.getVenueDetails(slug, user);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles("owner")
  @CheckOwnership("venue", "id")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Owner] Cập nhật cơ sở thể thao" })
  updateVenue(
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const input = parseBody(updateVenueSchema, body);
    return this.service.updateVenue(id, input);
  }

  @Delete(":id")
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles("owner")
  @CheckOwnership("venue", "id")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Owner] Xoá mềm cơ sở thể thao" })
  deleteVenue(@Param("id") id: string) {
    return this.service.deleteVenue(id);
  }

  @Patch(":id/status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Admin] Duyệt/từ chối cơ sở thể thao" })
  moderateVenue(
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const input = parseBody(venueModerationSchema, body);
    return this.service.moderateVenue(id, input);
  }

  // Images
  @Post(":id/images")
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles("owner")
  @CheckOwnership("venue", "id")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Owner] Thêm ảnh cho cơ sở" })
  addImage(
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const input = parseBody(addVenueImageSchema, body);
    return this.service.addImage(id, input.url, input.sortOrder);
  }

  @Patch(":id/images/order")
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles("owner")
  @CheckOwnership("venue", "id")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Owner] Sắp xếp lại thứ tự ảnh" })
  reorderImages(
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const input = parseBody(reorderVenueImagesSchema, body);
    return this.service.reorderImages(id, input.imageIds);
  }

  @Delete(":id/images/:imageId")
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles("owner")
  @CheckOwnership("venue", "id")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Owner] Xoá ảnh" })
  deleteImage(
    @Param("id") id: string,
    @Param("imageId") imageId: string,
  ) {
    return this.service.deleteImage(id, imageId);
  }
}

@ApiTags("Owner Venues")
@Controller("owner/venues")
export class OwnerVenuesController {
  constructor(private readonly service: VenuesService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("owner")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Owner] Danh sách cơ sở của tôi" })
  getMyVenues(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getOwnerVenues(user.id);
  }

  @Get(":id/cancellation-policy")
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles("owner")
  @CheckOwnership("venue", "id")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Owner] Xem chính sách huỷ/cọc" })
  getCancellationPolicy(@Param("id") id: string) {
    return this.service.getCancellationPolicy(id);
  }

  @Put(":id/cancellation-policy")
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles("owner")
  @CheckOwnership("venue", "id")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Owner] Cập nhật chính sách huỷ/cọc" })
  updateCancellationPolicy(
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const input = parseBody(cancellationPolicySchema, body);
    return this.service.updateCancellationPolicy(id, input);
  }

  @Get(":id/payment-account")
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles("owner")
  @CheckOwnership("venue", "id")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Owner] Xem tài khoản nhận tiền" })
  getPaymentAccount(@Param("id") id: string) {
    return this.service.getPaymentAccount(id);
  }

  @Put(":id/payment-account")
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles("owner")
  @CheckOwnership("venue", "id")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Owner] Cập nhật tài khoản nhận tiền" })
  updatePaymentAccount(
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const input = parseBody(bankAccountSchema, body);
    return this.service.updatePaymentAccount(id, input);
  }
}

