import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface MailRequest {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html?: string;
}

export class MailDeliveryError extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable: boolean,
  ) {
    super(code);
  }
}

@Injectable()
export class MailTransport {
  constructor(private readonly config: ConfigService) {}
  assertConfigured() {
    if (
      !this.config.get<string>("RESEND_API_KEY") ||
      !this.config.get<string>("MAIL_FROM")
    ) {
      throw new MailDeliveryError("MAIL_NOT_CONFIGURED", true);
    }
  }
  async send(request: MailRequest, idempotencyKey?: string): Promise<void> {
    this.assertConfigured();
    let response: Response;
    try {
      response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.getOrThrow<string>("RESEND_API_KEY")}`,
          "Content-Type": "application/json",
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw new MailDeliveryError("DELIVERY_AMBIGUOUS", true);
    }
    // Never propagate provider diagnostics, addresses, message bodies or auth links.
    if (!response.ok) {
      throw new MailDeliveryError(
        response.status === 429 ? "MAIL_RATE_LIMITED" : "MAIL_PROVIDER_ERROR",
        response.status === 429 ||
          response.status === 409 ||
          response.status >= 500,
      );
    }
    try {
      const result: unknown = await response.json();
      if (
        !result ||
        typeof result !== "object" ||
        !("id" in result) ||
        typeof result.id !== "string" ||
        !result.id
      ) {
        throw new Error("MISSING_PROVIDER_RECEIPT");
      }
    } catch {
      throw new MailDeliveryError("DELIVERY_AMBIGUOUS", true);
    }
  }
}
