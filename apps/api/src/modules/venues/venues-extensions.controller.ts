import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe.js";
import { RequestOriginGuard } from "../../common/guards/request-origin.guard.js";
import { paymentAccountInputSchema } from "../../../../../packages/shared/src/phase4-schemas.js";
import {
  publicVenueSearchQuerySchema,
  venueMapQuerySchema,
  type PublicVenueSearchQueryInput,
  type VenueMapQueryInput,
} from "../../../../../packages/shared/src/schemas.js";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  PayloadTooLargeException,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  UPLOAD_ACCEPTED_TYPES,
  UPLOAD_MAX_BYTES,
} from "../../../../../packages/shared/src/constants.js";
import { bankAccountOpenApi } from "../payments/payments.swagger.js";
import {
  addVenueImageSchema,
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
import { invalidImage, type ProofFile } from "../uploads/proof-image.js";
import { PublicStorage } from "../uploads/public-storage.js";

const VenueImageUploadInterceptor = FileInterceptor("file", {
  limits: { fileSize: UPLOAD_MAX_BYTES, files: 1 },
  fileFilter: (_request, file, callback) =>
    callback(
      UPLOAD_ACCEPTED_TYPES.some((type) => type === file.mimetype)
        ? null
        : invalidImage(),
      true,
    ),
});

@ApiTags("Venue Extensions")
@Controller("venues")
export class VenueExtensionsController {
  constructor(
    private readonly service: VenuesService,
    private readonly storage: PublicStorage,
  ) {}

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
  @Roles("owner", "admin")
  @CheckOwnership("venue", "id", { allowAdmin: true })
  @UseInterceptors(VenueImageUploadInterceptor)
  @ApiCookieAuth("access_token")
  @ApiConsumes("multipart/form-data", "application/json")
  @ApiOperation({ summary: "[Owner/Admin] Thêm ảnh cho cơ sở (multipart file hoặc JSON url)" })
  async addImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @UploadedFile() file: ProofFile | undefined,
    @Body() body: unknown,
  ) {
    if (file) {
      if (file.size > UPLOAD_MAX_BYTES || file.buffer.length > UPLOAD_MAX_BYTES) {
        throw new PayloadTooLargeException({
          code: "FILE_TOO_LARGE",
          message: "Ảnh cơ sở tối đa 5 MB.",
        });
      }
      const imageUrl = await this.storage.saveVenueImage(id, file.buffer, file.mimetype);
      const rawOrder =
        body && typeof body === "object" && "sortOrder" in body
          ? Number((body as { sortOrder?: unknown }).sortOrder)
          : 0;
      const sortOrder = Number.isInteger(rawOrder) && rawOrder >= 0 ? rawOrder : 0;
      return this.service.addImage(user.id, id, imageUrl, sortOrder);
    }
    if (!body || typeof body !== "object" || !("url" in body)) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Vui lòng tải lên tệp ảnh (field 'file') hoặc truyền đường dẫn ảnh.",
      });
    }
    const input = parseBody(addVenueImageSchema, body);
    return this.service.addImage(user.id, id, input.url, input.sortOrder);
  }

  @Patch(":id/images/order")
  @UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
  @Roles("owner", "admin")
  @CheckOwnership("venue", "id", { allowAdmin: true })
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Owner/Admin] Sắp xếp lại thứ tự ảnh" })
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
  @Roles("owner", "admin")
  @CheckOwnership("venue", "id", { allowAdmin: true })
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Owner/Admin] Xoá ảnh" })
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
@ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
@ApiResponse({ status: 401, description: "UNAUTHORIZED / TOKEN_EXPIRED" })
@ApiResponse({ status: 403, description: "FORBIDDEN / ACCOUNT_SUSPENDED" })
@ApiResponse({ status: 404, description: "NOT_FOUND" })
@ApiResponse({ status: 500, description: "INTERNAL_ERROR" })
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
  @ApiResponse({
    status: 200,
    schema: {
      type: "object",
      required: ["data"],
      properties: {
        data: {
          oneOf: [
            bankAccountOpenApi,
            { type: "object", nullable: true, enum: [null] },
          ],
        },
      },
    },
  })
  getPaymentAccount(@Param("id") id: string) {
    return this.service.getPaymentAccount(id);
  }

  @Put(":id/payment-account")
  @UseGuards(JwtAuthGuard, RolesGuard, RequestOriginGuard, OwnershipGuard)
  @Roles("owner")
  @CheckOwnership("venue", "id")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "[Owner] Cập nhật tài khoản nhận tiền" })
  @ApiHeader({ name: "X-Request-Origin", required: true })
  @ApiBody({ schema: bankAccountOpenApi })
  @ApiResponse({
    status: 200,
    schema: {
      type: "object",
      required: ["data"],
      properties: { data: bankAccountOpenApi },
    },
  })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
  @ApiResponse({
    status: 403,
    description: "FORBIDDEN / NOT_VENUE_OWNER / ACCOUNT_SUSPENDED",
  })
  updatePaymentAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const input = parseBody(paymentAccountInputSchema, body);
    return this.service.updatePaymentAccount(user.id, id, input);
  }
}
