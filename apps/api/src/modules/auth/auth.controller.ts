import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decodeAvatar, type AvatarFile } from "../uploads/avatar-image.js";
import { PublicStorage } from "../uploads/public-storage.js";

import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  passwordSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
  verifyEmailSchema,
} from "../../../../../packages/shared/src/schemas.js";
import { AuthService } from "./auth.service.js";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import type { AuthenticatedUser } from "../../../../../packages/shared/src/types.js";
import {
  AuthCookies,
  AuthRequestGuard,
  cookie,
  parseBody,
  type AuthRequest,
  type AuthResponse,
} from "./auth-http.js";

const stringFields = (names: string[]) =>
  Object.fromEntries(
    names.map((name) => [
      name,
      {
        type: "string" as const,
        ...(name.toLowerCase().includes("password")
          ? { format: "password" }
          : {}),
      },
    ]),
  );

@ApiTags("Auth")
@ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
@ApiResponse({ status: 500, description: "INTERNAL_ERROR" })
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: AuthCookies,
  ) {}

  @Post("register")
  @UseGuards(AuthRequestGuard)
  @ApiOperation({ summary: "Đăng ký Customer và gửi email xác thực" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["fullName", "email", "phone", "password", "confirmPassword"],
      properties: stringFields([
        "fullName",
        "email",
        "phone",
        "password",
        "confirmPassword",
      ]),
    },
  })
  @ApiResponse({
    status: 201,
    description: "Hồ sơ Customer; không cấp phiên tự động",
  })
  @ApiResponse({ status: 409, description: "EMAIL_ALREADY_EXISTS" })
  @ApiResponse({ status: 429, description: "RATE_LIMIT_EXCEEDED" })
  register(@Body() body: unknown) {
    return this.auth.register(parseBody(registerSchema, body));
  }

  @Post("login")
  @HttpCode(200)
  @UseGuards(AuthRequestGuard)
  @ApiOperation({ summary: "Đăng nhập bằng cookie httpOnly" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["email", "password"],
      properties: {
        ...stringFields(["email", "password"]),
        rememberMe: { type: "boolean", default: false },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "Hồ sơ user và Set-Cookie access_token/refresh_token",
  })
  @ApiResponse({ status: 401, description: "INVALID_CREDENTIALS" })
  @ApiResponse({ status: 429, description: "RATE_LIMIT_EXCEEDED" })
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: AuthResponse,
  ) {
    const session = await this.auth.login(parseBody(loginSchema, body));
    this.cookies.set(response, session);
    return session.user;
  }

  @Post("refresh")
  @HttpCode(200)
  @ApiCookieAuth("refresh_token")
  @ApiOperation({ summary: "Xoay vòng refresh token" })
  @ApiResponse({ status: 200, description: "Hồ sơ user và cặp cookie mới" })
  @ApiResponse({
    status: 401,
    description: "Token hết hạn, bị revoke hoặc reuse",
  })
  async refresh(
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: AuthResponse,
  ) {
    try {
      const session = await this.auth.refresh(cookie(request, "refresh_token"));
      this.cookies.set(response, session);
      return session.user;
    } catch (error) {
      this.cookies.clear(response);
      throw error;
    }
  }

  @Post("logout")
  @HttpCode(204)
  @ApiCookieAuth("refresh_token")
  @ApiOperation({ summary: "Thu hồi refresh token và xóa cookie" })
  @ApiResponse({ status: 204, description: "Đã đăng xuất; idempotent" })
  async logout(
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) response: AuthResponse,
  ) {
    await this.auth.logout(cookie(request, "refresh_token"));
    this.cookies.clear(response);
  }

  @Post("forgot-password")
  @HttpCode(204)
  @UseGuards(AuthRequestGuard)
  @ApiOperation({
    summary: "Yêu cầu đặt lại mật khẩu, không tiết lộ email tồn tại",
  })
  @ApiResponse({ status: 429, description: "RATE_LIMIT_EXCEEDED" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["email"],
      additionalProperties: false,
      properties: {
        email: {
          type: "string",
          format: "email",
          minLength: 1,
          maxLength: 255,
        },
      },
    },
  })
  @ApiResponse({
    status: 204,
    description: "Cùng phản hồi cho mọi email hợp lệ; gửi email nền",
  })
  forgot(@Body() body: unknown) {
    this.auth.forgotPassword(parseBody(forgotPasswordSchema, body).email);
  }

  @Post("reset-password")
  @HttpCode(204)
  @ApiOperation({ summary: "Đặt lại mật khẩu bằng token dùng một lần" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["token", "password", "confirmPassword"],
      additionalProperties: false,
      properties: {
        token: { type: "string", minLength: 1 },
        password: {
          type: "string",
          format: "password",
          minLength: passwordSchema.minLength ?? undefined,
          maxLength: passwordSchema.maxLength ?? undefined,
        },
        confirmPassword: {
          type: "string",
          format: "password",
          minLength: 1,
          description: "Phải khớp password",
        },
      },
    },
  })
  @ApiResponse({
    status: 204,
    description: "Đã đổi mật khẩu và revoke mọi refresh token",
  })
  @ApiResponse({ status: 401, description: "INVALID_TOKEN" })
  async reset(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: AuthResponse,
  ) {
    await this.auth.resetPassword(parseBody(resetPasswordSchema, body));
    this.cookies.clear(response);
  }

  @Post("verify-email")
  @HttpCode(204)
  @ApiOperation({ summary: "Xác thực email bằng token dùng một lần" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["token"],
      properties: stringFields(["token"]),
    },
  })
  @ApiResponse({ status: 204, description: "Email đã xác thực" })
  @ApiResponse({ status: 401, description: "INVALID_TOKEN" })
  verify(@Body() body: unknown) {
    return this.auth.verifyEmail(parseBody(verifyEmailSchema, body).token);
  }

  @Post("ws-token")
  @HttpCode(200)
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "Cấp token ngắn hạn cho kết nối Socket.IO" })
  @ApiResponse({ status: 200, description: "Token WebSocket ngắn hạn" })
  @ApiResponse({ status: 401, description: "UNAUTHORIZED" })
  wsToken(@Req() request: AuthRequest) {
    return this.auth.issueWsToken(cookie(request, "access_token"));
  }
}

@ApiTags("Users")
@Controller("users")
export class CurrentUserController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: AuthCookies,
    private readonly storage: PublicStorage,
  ) {}

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "Hồ sơ của user hiện tại" })
  @ApiResponse({
    status: 200,
    description: "Hồ sơ an toàn, không có hash hoặc token",
  })
  @ApiResponse({ status: 401, description: "UNAUTHORIZED hoặc TOKEN_EXPIRED" })
  @ApiResponse({ status: 403, description: "ACCOUNT_SUSPENDED hoặc FORBIDDEN" })
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Post("me/avatar")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 2 * 1024 * 1024, files: 1 },
      fileFilter: (_request, file, callback) =>
        callback(
          ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)
            ? null
            : new BadRequestException({
                code: "VALIDATION_ERROR",
                message:
                  "Định dạng tệp không được hỗ trợ. Vui lòng chọn ảnh JPG, PNG hoặc WebP.",
              }),
          true,
        ),
    }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "Upload ảnh đại diện người dùng hiện tại" })
  @ApiResponse({
    status: 200,
    description: "Hồ sơ người dùng sau khi cập nhật ảnh đại diện",
  })
  async uploadAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: AvatarFile | undefined,
  ) {
    if (!file) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Thiếu tệp ảnh đại diện.",
      });
    }
    const webpBuffer = await decodeAvatar(file);
    const avatarUrl = await this.storage.saveAvatar(user.id, webpBuffer, "image/webp");
    return this.auth.updateAvatar(user.id, avatarUrl);
  }

  @Patch("me")
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "Cập nhật hồ sơ cá nhân" })
  @ApiResponse({ status: 200, description: "Hồ sơ sau khi cập nhật" })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
  @ApiResponse({ status: 401, description: "UNAUTHORIZED" })
  updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const input = parseBody(updateProfileSchema, body);
    return this.auth.updateProfile(user.id, input);
  }

  @Patch("me/password")
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth("access_token")
  @ApiOperation({ summary: "Đổi mật khẩu người dùng đang đăng nhập" })
  @ApiResponse({ status: 204, description: "Đổi mật khẩu thành công" })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
  @ApiResponse({
    status: 401,
    description: "INVALID_CREDENTIALS hoặc UNAUTHORIZED",
  })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: AuthResponse,
  ) {
    const input = parseBody(changePasswordSchema, body);
    await this.auth.changePassword(user.id, input);
    this.cookies.clear(response);
  }
}
