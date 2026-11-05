import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe.js";
import {
  publicVenueSearchQuerySchema,
  venueMapQuerySchema,
  type PublicVenueSearchQueryInput,
  type VenueMapQueryInput,
} from "../../../../../packages/shared/src/schemas.js";
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
  reorderVenueImagesSchema,
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

@ApiTags("Venue Extensions")
@Controller("venues")
export class VenueExtensionsController {
  constructor(private readonly service: VenuesService) {}

  @Get()
  @ApiOperation({ summary: "Tìm kiếm cơ sở thể thao (public)" })
  search(
    @Query(new ZodValidationPipe(publicVenueSearchQuerySchema))
    query: PublicVenueSearchQueryInput,
  ) {
    return this.service.searchVenues(query);
  }

  @Get("map")
  @ApiOperation({ summary: "Danh sách cơ sở cho bản đồ (public)" })
  getMap(
    @Query(new ZodValidationPipe(venueMapQuerySchema))
    query: VenueMapQueryInput,
  ) {
    return this.service.getMapVenues(query);
  }

  @Post(":id/images")
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles("owner")
  @CheckOwnership("venue", "id")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Owner] Thêm ảnh cho cơ sở" })
  addImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const input = parseBody(addVenueImageSchema, body);
    return this.service.addImage(user.id, id, input.url, input.sortOrder);
  }

  @Patch(":id/images/order")
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles("owner")
  @CheckOwnership("venue", "id")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Owner] Sắp xếp lại thứ tự ảnh" })
  reorderImages(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const input = parseBody(reorderVenueImagesSchema, body);
    return this.service.reorderImages(user.id, id, input.imageIds);
  }

  @Delete(":id/images/:imageId")
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles("owner")
  @CheckOwnership("venue", "id")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Owner] Xoá ảnh" })
  deleteImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("imageId") imageId: string,
  ) {
    return this.service.deleteImage(user.id, id, imageId);
  }
}

@ApiTags("Venue Extensions")
@Controller("owner/venues")
export class OwnerVenueSettingsController {
  constructor(private readonly service: VenuesService) {}

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
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const input = parseBody(cancellationPolicySchema, body);
    return this.service.updateCancellationPolicy(user.id, id, input);
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
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const input = parseBody(bankAccountSchema, body);
    return this.service.updatePaymentAccount(user.id, id, input);
  }
}
