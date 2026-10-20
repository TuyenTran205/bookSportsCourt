import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
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
@ApiResponse({ status: 429, description: "RATE_LIMIT_EXCEEDED" })
@UseGuards(AuthRequestGuard)
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: AuthCookies,
  ) {}

  @Post("register")
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
  register(@Body() body: unknown) {
    return this.auth.register(parseBody(registerSchema, body));
  }

  @Post("login")
  @HttpCode(200)
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
  @ApiOperation({
    summary: "Yêu cầu đặt lại mật khẩu, không tiết lộ email tồn tại",
  })
  @ApiBody({
    schema: {
      type: "object",
      required: ["email"],
      properties: stringFields(["email"]),
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
      properties: stringFields(["token", "password", "confirmPassword"]),
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
}

@ApiTags("Users")
@Controller("users")
export class CurrentUserController {
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
}
