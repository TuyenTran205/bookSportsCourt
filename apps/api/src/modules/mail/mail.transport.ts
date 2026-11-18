import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer from "nodemailer";
import { GmailConfigSchema } from "../../config/mail-config.js";

export interface MailRequest {
  /** Private outbox metadata. Missing on legacy snapshots means Resend. */
  provider?: "resend" | "gmail";
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
  private gmailConfig() {
    return GmailConfigSchema.safeParse(
      Object.fromEntries(
        [
          "SMTP_HOST",
          "SMTP_PORT",
          "SMTP_SECURE",
          "SMTP_USER",
          "SMTP_PASS",
          "MAIL_FROM",
        ].map((key) => [key, this.config.get(key)]),
      ),
    );
  }
  assertConfigured() {
    if (this.config.get<string>("MAIL_PROVIDER") === "gmail") {
      if (!this.gmailConfig().success)
        throw new MailDeliveryError("MAIL_NOT_CONFIGURED", false);
      return;
    }
    if (
      !this.config.get<string>("RESEND_API_KEY") ||
      !this.config.get<string>("MAIL_FROM")
    ) {
      throw new MailDeliveryError("MAIL_NOT_CONFIGURED", true);
    }
  }
  async send(request: MailRequest, idempotencyKey?: string): Promise<void> {
    this.assertConfigured();
    // Allowlist fields: never send outbox metadata or arbitrary JSONB properties.
    const message = {
      from: request.from,
      to: request.to,
      subject: request.subject,
      text: request.text,
      ...(request.html === undefined ? {} : { html: request.html }),
    };
    if (this.config.get<string>("MAIL_PROVIDER") === "gmail") {
      await this.sendGmail(message);
      return;
    }
    let response: Response;
    try {
      response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.getOrThrow<string>("RESEND_API_KEY")}`,
          "Content-Type": "application/json",
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        body: JSON.stringify(message),
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

  private async sendGmail(message: MailRequest): Promise<void> {
    const parsed = this.gmailConfig();
    if (!parsed.success)
      throw new MailDeliveryError("MAIL_NOT_CONFIGURED", false);
    const config = parsed.data;
    if (message.from !== config.MAIL_FROM || message.to.length !== 1) {
      throw new MailDeliveryError("MAIL_INVALID_REQUEST", false);
    }
    const smtp = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      requireTLS: !config.SMTP_SECURE,
      auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
      logger: false,
      debug: false,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    try {
      const result = await smtp.sendMail(message);
      if (result.accepted.length !== 1 || result.rejected.length > 0) {
        throw new MailDeliveryError("DELIVERY_AMBIGUOUS", false);
      }
    } catch (error) {
      // SMTP response text can contain addresses, credentials or message content.
      const code =
        error && typeof error === "object" && "responseCode" in error
          ? error.responseCode
          : undefined;
      if (typeof code === "number" && code >= 400 && code < 600) {
        throw new MailDeliveryError("MAIL_PROVIDER_ERROR", code < 500);
      }
      throw new MailDeliveryError("DELIVERY_AMBIGUOUS", false);
    } finally {
      smtp.close();
    }
  }
}
