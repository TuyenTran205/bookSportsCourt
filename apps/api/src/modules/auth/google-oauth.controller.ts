import { Controller, Get, Query, Req, Res, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import {
  AuthCookies,
  AuthRequestGuard,
  cookie,
  type AuthRequest,
  type AuthResponse,
} from "./auth-http.js";
import { GoogleOAuthService } from "./google-oauth.service.js";

type GoogleResponse = AuthResponse & {
  redirect(status: number, location: string): void;
  setHeader(name: string, value: string): void;
};
@ApiTags("Auth")
@UseGuards(AuthRequestGuard)
@ApiResponse({
  status: 302,
  description: "Redirect allowlist; tokens only in httpOnly cookies, never URL",
})
@ApiResponse({
  status: 400,
  description: "VALIDATION_ERROR: state/binding/query",
})
@ApiResponse({ status: 401, description: "INVALID_TOKEN / UNAUTHORIZED" })
@ApiResponse({ status: 403, description: "FORBIDDEN / ACCOUNT_SUSPENDED" })
@ApiResponse({ status: 409, description: "EMAIL_ALREADY_EXISTS" })
@ApiResponse({ status: 429, description: "RATE_LIMIT_EXCEEDED" })
@ApiResponse({ status: 503, description: "SERVICE_UNAVAILABLE" })
@ApiResponse({ status: 500, description: "INTERNAL_ERROR" })
@Controller("auth/google")
export class GoogleOAuthController {
  constructor(
    private readonly oauth: GoogleOAuthService,
    private readonly cookies: AuthCookies,
  ) {}
  private headers(response: GoogleResponse) {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Referrer-Policy", "no-referrer");
  }
  @Get()
  @ApiOperation({
    summary: "Bắt đầu Google OIDC code + PKCE, state/nonce/binding10 phút",
  })
  async start(@Query() query: unknown, @Res() response: GoogleResponse) {
    this.headers(response);
    const result = await this.oauth.start(query);
    this.cookies.setGoogleBinding(response, result.binding);
    response.redirect(302, result.location);
  }
  @Get("callback")
  @ApiOperation({
    summary: "Tiêu thụ state một lần, xác minh Google và cấp session ứng dụng",
  })
  @ApiQuery({
    name: "state",
    required: true,
    schema: { type: "string", minLength: 1, maxLength: 512 },
  })
  @ApiQuery({
    name: "code",
    required: false,
    schema: { type: "string", minLength: 1, maxLength: 4096 },
  })
  @ApiQuery({
    name: "error",
    required: false,
    schema: { type: "string", minLength: 1, maxLength: 200 },
  })
  @ApiQuery({
    name: "error_description",
    required: false,
    schema: { type: "string", maxLength: 1000 },
  })
  @ApiQuery({
    name: "scope",
    required: false,
    schema: { type: "string", maxLength: 2048 },
  })
  @ApiQuery({
    name: "authuser",
    required: false,
    schema: { type: "string", maxLength: 100 },
  })
  @ApiQuery({
    name: "prompt",
    required: false,
    schema: { type: "string", maxLength: 100 },
  })
  @ApiQuery({
    name: "hd",
    required: false,
    schema: { type: "string", maxLength: 255 },
  })
  async callback(
    @Query() query: unknown,
    @Req() request: AuthRequest,
    @Res() response: GoogleResponse,
  ) {
    this.headers(response);
    let result: Awaited<ReturnType<GoogleOAuthService["callback"]>>;
    try {
      result = await this.oauth.callback(
        query,
        cookie(request, "google_oauth_binding"),
      );
    } finally {
      this.cookies.clearGoogleBinding(response);
    }
    this.cookies.set(response, result.session);
    response.redirect(302, result.location);
  }
}
