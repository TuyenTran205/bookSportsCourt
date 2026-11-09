import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { parseAllowedOrigins } from "../../config/allowed-origins.js";

@Injectable()
export class RequestOriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(context: ExecutionContext) {
    const headers = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, unknown> }>().headers;
    const value = headers["x-request-origin"];
    const origin = headers.origin;
    const allowed = parseAllowedOrigins(
      this.config.getOrThrow("ALLOWED_ORIGINS"),
      this.config.get("NODE_ENV") ?? "development",
    );
    const normalize = (v: unknown) => {
      if (typeof v !== "string") return null;
      try {
        const url = new URL(v);
        return url.origin === v && !url.username && !url.password
          ? url.origin
          : null;
      } catch {
        return null;
      }
    };
    const normalized = normalize(value);
    if (
      !normalized ||
      !allowed.includes(normalized) ||
      (origin !== undefined && normalize(origin) !== normalized)
    ) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Origin thanh toán không hợp lệ.",
      });
    }
    return true;
  }
}
