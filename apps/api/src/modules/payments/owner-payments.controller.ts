import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBody,
  ApiCookieAuth,
  ApiHeader,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { PAYMENT_STATUSES } from "../../../../../packages/shared/src/constants.js";
import type { AuthenticatedUser } from "../../../../../packages/shared/src/types.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../common/guards/roles.guard.js";
import { RequestOriginGuard } from "../../common/guards/request-origin.guard.js";
import { PaymentReviewService } from "./payment-review.service.js";
import {
  paymentResponseOpenApi,
  ownerPaymentsResponseOpenApi,
} from "./payments.swagger.js";

@ApiTags("Owner payments")
@ApiCookieAuth("access_token")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("owner")
@ApiResponse({
  status: 400,
  description: "VALIDATION_ERROR / INVALID_STATUS_TRANSITION",
})
@ApiResponse({ status: 401, description: "UNAUTHORIZED / TOKEN_EXPIRED" })
@ApiResponse({
  status: 403,
  description: "FORBIDDEN / ACCOUNT_SUSPENDED / NOT_VENUE_OWNER",
})
@ApiResponse({ status: 404, description: "NOT_FOUND" })
@ApiResponse({
  status: 409,
  description:
    "PAYMENT_DATA_INCOMPLETE / PAYMENT_STATE_CONFLICT / PAYMENT_REVIEW_EXPIRED",
})
@ApiResponse({ status: 503, description: "SERVICE_UNAVAILABLE" })
@Controller("owner/payments")
@ApiResponse({ status: 500, description: "INTERNAL_ERROR" })
export class OwnerPaymentsController {
  constructor(private readonly service: PaymentReviewService) {}
  @Get()
  @Header("Cache-Control", "no-store")
  @ApiQuery({
    name: "status",
    required: false,
    enum: [...PAYMENT_STATUSES, "all"],
    schema: { default: "submitted" },
  })
  @ApiQuery({
    name: "venueId",
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
  @ApiResponse({ status: 200, schema: ownerPaymentsResponseOpenApi })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    return this.service.list(user.id, query);
  }
  @Patch(":id/approve")
  @UseGuards(RequestOriginGuard)
  @Header("Cache-Control", "no-store")
  @ApiHeader({ name: "X-Request-Origin", required: true })
  @ApiParam({ name: "id", schema: { type: "string", format: "uuid" } })
  @ApiBody({
    required: false,
    schema: { type: "object", additionalProperties: false, properties: {} },
  })
  @ApiResponse({ status: 200, schema: paymentResponseOpenApi })
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: unknown,
    @Query() query: unknown,
  ) {
    return this.service.mutate(user.id, id, "approve", body, query);
  }
  @Patch(":id/reject")
  @UseGuards(RequestOriginGuard)
  @Header("Cache-Control", "no-store")
  @ApiHeader({ name: "X-Request-Origin", required: true })
  @ApiParam({ name: "id", schema: { type: "string", format: "uuid" } })
  @ApiBody({
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["reason"],
      properties: {
        reason: {
          type: "string",
          minLength: 1,
          maxLength: 500,
          description: "Trim before validation",
        },
      },
    },
  })
  @ApiResponse({ status: 200, schema: paymentResponseOpenApi })
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: unknown,
    @Query() query: unknown,
  ) {
    return this.service.mutate(user.id, id, "reject", body, query);
  }
}
