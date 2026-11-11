import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { AuthenticatedUser } from "../../../../../packages/shared/src/types.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../common/guards/roles.guard.js";
import { ReviewsService } from "./reviews.service.js";
import { reviewPageResponse, reviewResponse } from "./reviews.swagger.js";

@ApiTags("Reviews")
@ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
@ApiResponse({ status: 401, description: "UNAUTHORIZED / TOKEN_EXPIRED" })
@ApiResponse({ status: 403, description: "FORBIDDEN / ACCOUNT_SUSPENDED" })
@ApiResponse({ status: 500, description: "INTERNAL_ERROR" })
@ApiResponse({ status: 503, description: "SERVICE_UNAVAILABLE" })
@Controller()
export class ReviewsController {
  constructor(private readonly service: ReviewsService) {}
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
}
