import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class AuthMailService {
  private readonly logger = new Logger(AuthMailService.name);
  constructor(private readonly config: ConfigService) {}

  assertConfigured(): void {
    for (const key of ["RESEND_API_KEY", "MAIL_FROM", "AUTH_FRONTEND_URL"]) {
      if (!this.config.get<string>(key)) {
        throw new ServiceUnavailableException({
          code: "SERVICE_UNAVAILABLE",
          message: "Dịch vụ email chưa sẵn sàng.",
        });
      }
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
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.getOrThrow<string>("RESEND_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.config.getOrThrow<string>("MAIL_FROM"),
          to: [email],
          subject:
            type === "email_verify"
              ? "Xác thực email BookSportsCourt"
              : "Đặt lại mật khẩu BookSportsCourt",
          text: `Mở liên kết để tiếp tục: ${url.toString()}\nNếu bạn không yêu cầu, hãy bỏ qua email này.`,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error("Email delivery failed");
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
