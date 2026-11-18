import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  PayloadTooLargeException,
  Post,
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
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  REVIEW_REPORT_STATUSES,
  UPLOAD_ACCEPTED_TYPES,
  UPLOAD_MAX_BYTES,
} from "../../../../../packages/shared/src/constants.js";
import type { AuthenticatedUser } from "../../../../../packages/shared/src/types.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../common/guards/roles.guard.js";
import { invalidImage, type ProofFile } from "../uploads/proof-image.js";
import { PublicStorage } from "../uploads/public-storage.js";
import { ReviewsService } from "./reviews.service.js";
import { reviewPageResponse, reviewResponse } from "./reviews.swagger.js";

const ReviewReportUploadInterceptor = FileInterceptor("file", {
  limits: { fileSize: UPLOAD_MAX_BYTES, files: 1 },
  fileFilter: (_request, file, callback) =>
    callback(
      UPLOAD_ACCEPTED_TYPES.some((type) => type === file.mimetype)
        ? null
        : invalidImage(),
      true,
    ),
});

@ApiTags("Reviews")
@ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
@ApiResponse({ status: 401, description: "UNAUTHORIZED / TOKEN_EXPIRED" })
@ApiResponse({ status: 403, description: "FORBIDDEN / ACCOUNT_SUSPENDED" })
@ApiResponse({ status: 500, description: "INTERNAL_ERROR" })
@ApiResponse({ status: 503, description: "SERVICE_UNAVAILABLE" })
@Controller()
export class ReviewsController {
  constructor(
    private readonly service: ReviewsService,
    private readonly storage: PublicStorage,
  ) {}
  @Post("reviews")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("customer")
  @ApiCookieAuth("access_token")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Customer đánh giá booking completed của mình" })
  @ApiBody({
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["bookingId", "rating"],
      properties: {
        bookingId: { type: "string", format: "uuid" },
        rating: { type: "integer", minimum: 1, maximum: 5 },
        comment: {
          type: "string",
          maxLength: 2000,
          description: "Trim; bỏ qua/rỗng lưu null",
        },
      },
    },
  })
  @ApiResponse({ status: 201, schema: reviewResponse })
  @ApiResponse({ status: 409, description: "ALREADY_EXISTS" })
  @ApiResponse({ status: 422, description: "REVIEW_NOT_ALLOWED" })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
    @Query() query: unknown,
  ) {
    return this.service.create(user.id, body, query);
  }
  @Get("venues/:id/reviews")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Review visible của Venue approved chưa xoá" })
  @ApiParam({ name: "id", schema: { type: "string", format: "uuid" } })
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
  @ApiResponse({ status: 200, schema: reviewPageResponse(false) })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  publicList(@Param("id") id: string, @Query() query: unknown) {
    return this.service.publicList(id, query);
  }
  @Get("admin/reviews")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiCookieAuth("access_token")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Admin xem review gồm cả review ẩn" })
  @ApiQuery({
    name: "venueId",
    required: false,
    schema: { type: "string", format: "uuid" },
  })
  @ApiQuery({
    name: "isVisible",
    required: false,
    schema: {
      type: "boolean",
      description: "Chỉ true/false, bỏ qua là tất cả",
    },
  })
  @ApiQuery({
    name: "reportStatus",
    required: false,
    schema: {
      type: "string",
      enum: [...REVIEW_REPORT_STATUSES],
    },
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
  @ApiResponse({ status: 200, schema: reviewPageResponse(true) })
  adminList(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    return this.service.adminList(user.id, query);
  }
  @Patch("reviews/:id/visibility")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiCookieAuth("access_token")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Admin ẩn/hiện review; retry cùng giá trị no-op" })
  @ApiParam({ name: "id", schema: { type: "string", format: "uuid" } })
  @ApiBody({
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["isVisible"],
      properties: { isVisible: { type: "boolean" } },
    },
  })
  @ApiResponse({ status: 200, schema: reviewResponse })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  visibility(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: unknown,
    @Query() query: unknown,
  ) {
    return this.service.visibility(user.id, id, body, query);
  }

  @Get("owner/reviews")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("owner", "admin")
  @ApiCookieAuth("access_token")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "[Owner] Danh sách đánh giá tại cơ sở của mình" })
  ownerList(
    @CurrentUser() user: AuthenticatedUser,
    @Query()
    query: {
      venueId?: string;
      replied?: boolean | string;
      page?: number | string;
      limit?: number | string;
    },
  ) {
    return this.service.ownerList(user, query);
  }

  @Patch("owner/reviews/:id/reply")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("owner", "admin")
  @ApiCookieAuth("access_token")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "[Owner] Trả lời đánh giá" })
  ownerReply(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body("ownerReply") reply: string,
  ) {
    return this.service.ownerReply(user, id, reply);
  }

  @Post("owner/reviews/:id/report")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("owner", "admin")
  @UseInterceptors(ReviewReportUploadInterceptor)
  @ApiCookieAuth("access_token")
  @ApiConsumes("multipart/form-data", "application/json")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "[Owner] Báo cáo đánh giá xấu kèm lý do và ảnh minh chứng" })
  ownerReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @UploadedFile() file: ProofFile | undefined,
    @Body() body: unknown,
  ) {
    if (file && (file.size > UPLOAD_MAX_BYTES || file.buffer.length > UPLOAD_MAX_BYTES)) {
      throw new PayloadTooLargeException({
        code: "FILE_TOO_LARGE",
        message: "Ảnh minh chứng tối đa 5 MB.",
      });
    }
    const uploadImage = file
      ? () => this.storage.saveReviewReportImage(id, file.buffer, file.mimetype)
      : undefined;
    return this.service.ownerReport(user, id, body, uploadImage);
  }

  @Patch("admin/reviews/:id/report")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiCookieAuth("access_token")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "[Admin] Duyệt hoặc từ chối báo cáo đánh giá từ chủ sân" })
  moderateReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: unknown,
    @Query() query: unknown,
  ) {
    return this.service.moderateReport(user.id, id, body, query);
  }
}
