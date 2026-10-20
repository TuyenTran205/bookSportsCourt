import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";
import { parseAllowedOrigins } from "../../config/allowed-origins.js";

export type AuthRequest = {
  headers: { cookie?: string; origin?: string };
  ip?: string;
  method: string;
};
type CookieOptions = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge?: number;
};
export type AuthResponse = {
  cookie(name: string, value: string, options: CookieOptions): void;
  clearCookie(name: string, options: CookieOptions): void;
};

export function parseBody<T extends z.ZodTypeAny>(
  schema: T,
  body: unknown,
): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success)
    throw new BadRequestException({
      code: "VALIDATION_ERROR",
      message: "Dữ liệu không hợp lệ.",
      details: result.error.flatten(),
    });
  return result.data;
}

export function cookie(request: AuthRequest, name: string): string | undefined {
  for (const entry of (request.headers.cookie ?? "").split(";")) {
    const index = entry.indexOf("=");
    if (entry.slice(0, index).trim() !== name) continue;
    try {
      return decodeURIComponent(entry.slice(index + 1));
    } catch {
      return undefined;
    }
  }
  return undefined;
}

@Injectable()
export class AuthCookies {
  constructor(private readonly config: ConfigService) {}
  private options(): CookieOptions {
    return {
      httpOnly: true,
      secure: ["staging", "production"].includes(
        this.config.get<string>("NODE_ENV") ?? "",
      ),
      sameSite: "lax",
      path: "/api/v1",
    };
  }
  set(
    response: AuthResponse,
    session: { accessToken: string; refreshToken: string; persistent: boolean },
  ) {
    const options = this.options();
    response.cookie("access_token", session.accessToken, {
      ...options,
      ...(session.persistent ? { maxAge: 15 * 60_000 } : {}),
    });
    response.cookie("refresh_token", session.refreshToken, {
      ...options,
      ...(session.persistent ? { maxAge: 30 * 86400_000 } : {}),
    });
  }
  clear(response: AuthResponse) {
    response.clearCookie("access_token", this.options());
    response.clearCookie("refresh_token", this.options());
  }
}

/** Single-instance auth limit; never trusts X-Forwarded-For without proxy configuration. */
@Injectable()
export class AuthRequestGuard implements CanActivate {
  private readonly attempts = new Map<
    string,
    { count: number; until: number }
  >();
  constructor(private readonly config: ConfigService) {}
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const origin = request.headers.origin;
    const allowed = parseAllowedOrigins(
      this.config.getOrThrow<string>("ALLOWED_ORIGINS"),
      this.config.get<string>("NODE_ENV") ?? "development",
    );
    if (request.method !== "GET" && origin && !allowed.includes(origin))
      throw new ForbiddenException();
    const now = Date.now();
    for (const [key, value] of this.attempts)
      if (value.until <= now) this.attempts.delete(key);
    const key = request.ip ?? "unknown";
    let entry = this.attempts.get(key);
    if (!entry) {
      if (this.attempts.size >= 10_000)
        throw new HttpException("Vui lòng thử lại sau.", 429);
      entry = { count: 0, until: now + 300_000 };
      this.attempts.set(key, entry);
    }
    if (++entry.count > 10)
      throw new HttpException(
        {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Quá số yêu cầu. Vui lòng thử lại sau.",
        },
        429,
      );
    return true;
  }
}
