import {
  Body,
  CallHandler,
  Controller,
  ExecutionContext,
  Get,
  Header,
  HttpCode,
  HttpException,
  Injectable,
  NestInterceptor,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  type CanActivate,
} from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  UPLOAD_MAX_BYTES,
  UPLOAD_ACCEPTED_TYPES,
} from "../../../../../packages/shared/src/constants.js";
import {
  JwtAuthGuard,
  type AuthenticatedRequest,
} from "../../common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../common/guards/roles.guard.js";
import { RequestOriginGuard } from "../../common/guards/request-origin.guard.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import type { AuthenticatedUser } from "../../../../../packages/shared/src/types.js";
import { PaymentsService } from "./payments.service.js";
import { invalidImage, type ProofFile } from "../uploads/proof-image.js";
import { paymentResponseOpenApi } from "./payments.swagger.js";
import { BadRequestException } from "@nestjs/common";
import { Query } from "@nestjs/common";
import { noQuerySchema } from "../../../../../packages/shared/src/phase4-schemas.js";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe.js";

@Injectable()
export class ProofAccessGuard implements CanActivate {
  constructor(private readonly service: PaymentsService) {}
  async canActivate(context: ExecutionContext) {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest & { query?: unknown }>();
    await this.service.preflight(request.user!.id, request.params.id);
    new ZodValidationPipe(noQuerySchema).transform(request.query ?? {});
    return true;
  }
}
const Upload = FileInterceptor("file", {
  limits: { fileSize: UPLOAD_MAX_BYTES, files: 1, fields: 0, parts: 2 },
  fileFilter: (_request, file, callback) =>
    callback(
      UPLOAD_ACCEPTED_TYPES.some((type) => type === file.mimetype)
        ? null
        : invalidImage(),
      true,
    ),
});
@Injectable()
export class ProofUploadInterceptor extends Upload implements NestInterceptor {
  override async intercept(context: ExecutionContext, next: CallHandler) {
    try {
      return await super.intercept(context, next);
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() === 413)
        throw new HttpException(
          { code: "FILE_TOO_LARGE", message: "Ảnh tối đa 5 MiB." },
          413,
        );
      throw error;
    }
  }
}
@ApiTags("Payments")
@ApiCookieAuth("access_token")
@ApiResponse({
  status: 400,
  description:
    "VALIDATION_ERROR / INVALID_STATUS_TRANSITION / UNSUPPORTED_FILE_TYPE",
})
@ApiResponse({ status: 401, description: "UNAUTHORIZED / TOKEN_EXPIRED" })
@ApiResponse({
  status: 403,
  description: "FORBIDDEN / ACCOUNT_SUSPENDED / NOT_VENUE_OWNER",
})
@ApiResponse({ status: 404, description: "NOT_FOUND" })
@ApiResponse({ status: 503, description: "SERVICE_UNAVAILABLE" })
@Controller("bookings/:id/payment")
@ApiResponse({ status: 500, description: "INTERNAL_ERROR" })
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("customer", "owner")
  @Header("Cache-Control", "no-store")
  @ApiParam({ name: "id", schema: { type: "string", format: "uuid" } })
  @ApiOperation({
    summary:
      "Xem payment của booking theo quyền; snapshot ngân hàng và signed URL private 5 phút",
  })
  @ApiResponse({ status: 200, schema: paymentResponseOpenApi })
  detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Query(new ZodValidationPipe(noQuerySchema)) _query: unknown,
  ) {
    return this.service.detail(user.id, id);
  }
  @Post("proof")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @UseGuards(JwtAuthGuard, RolesGuard, RequestOriginGuard, ProofAccessGuard)
  @Roles("customer")
  @UseInterceptors(ProofUploadInterceptor)
  @ApiParam({ name: "id", schema: { type: "string", format: "uuid" } })
  @ApiConsumes("multipart/form-data")
  @ApiHeader({
    name: "X-Request-Origin",
    required: true,
    description: "Origin chính xác trong ALLOWED_ORIGINS",
  })
  @ApiBody({
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["file"],
      properties: {
        file: {
          type: "string",
          format: "binary",
          description: "JPEG/PNG/WebP hợp lệ, tối đa 5 MiB",
        },
      },
    },
  })
  @ApiOperation({
    summary:
      "Gửi/thay chứng từ, giữ hạn duyệt từ lần gửi đầu; X-Request-Origin bắt buộc",
  })
  @ApiResponse({ status: 200, schema: paymentResponseOpenApi })
  @ApiResponse({
    status: 409,
    description:
      "PAYMENT_DATA_INCOMPLETE / PAYMENT_STATE_CONFLICT / PAYMENT_REVIEW_EXPIRED",
  })
  @ApiResponse({ status: 413, description: "FILE_TOO_LARGE" })
  @ApiResponse({ status: 422, description: "HOLD_EXPIRED" })
  proof(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @UploadedFile() file: ProofFile | undefined,
    @Body() body: unknown,
  ) {
    if (body && typeof body === "object" && Object.keys(body).length)
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Chỉ nhận field file.",
      });
    return this.service.proof(user.id, id, file);
  }
}
