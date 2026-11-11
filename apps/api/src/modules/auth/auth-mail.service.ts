import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MailTransport } from "../mail/mail.transport.js";
import { parseAllowedOrigins } from "../../config/allowed-origins.js";

@Injectable()
export class AuthMailService {
  private readonly logger = new Logger(AuthMailService.name);
  constructor(
    private readonly config: ConfigService,
    private readonly transport: MailTransport,
  ) {}

  assertConfigured(): void {
    for (const key of ["RESEND_API_KEY", "MAIL_FROM", "AUTH_FRONTEND_URL"]) {
      if (!this.config.get<string>(key)) {
        throw new ServiceUnavailableException({
          code: "SERVICE_UNAVAILABLE",
          message: "Dịch vụ email chưa sẵn sàng.",
        });
      }
    }
    try {
      const url = new URL(this.config.getOrThrow<string>("AUTH_FRONTEND_URL"));
      const mode = this.config.get<string>("NODE_ENV") ?? "development";
      const allowed = parseAllowedOrigins(
        this.config.getOrThrow<string>("ALLOWED_ORIGINS"),
        mode,
      );
      if (
        url.pathname !== "/" ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        !allowed.includes(url.origin) ||
        (["staging", "production"].includes(mode) && url.protocol !== "https:")
      )
        throw new Error();
    } catch {
      throw new ServiceUnavailableException({
        code: "SERVICE_UNAVAILABLE",
        message: "Cấu hình email chưa sẵn sàng.",
      });
    }
  }

  async send(
    email: string,
    token: string,
    type: "email_verify" | "password_reset",
  ): Promise<void> {
    this.assertConfigured();
    const url = new URL(
      type === "email_verify" ? "/verify-email" : "/reset-password",
      this.config.getOrThrow<string>("AUTH_FRONTEND_URL"),
    );
    url.searchParams.set("token", token);
    try {
      await this.transport.send({
        from: this.config.getOrThrow<string>("MAIL_FROM"),
        to: [email],
        subject:
          type === "email_verify"
            ? "Xác thực email BookSportsCourt"
            : "Đặt lại mật khẩu BookSportsCourt",
        text: `Mở liên kết để tiếp tục: ${url.toString()}\nNếu bạn không yêu cầu, hãy bỏ qua email này.`,
      });
    } catch {
      // Never log provider bodies, addresses or token-bearing links.
      this.logger.warn("Auth email delivery failed");
      throw new ServiceUnavailableException({
        code: "SERVICE_UNAVAILABLE",
        message: "Không thể gửi email lúc này.",
      });
    }
  }
}
