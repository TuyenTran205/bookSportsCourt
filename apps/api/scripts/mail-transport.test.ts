import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import nodemailer from "nodemailer";
import { ConfigService } from "@nestjs/config";
import { validateConfig } from "../src/config/app-config.js";
import {
  MailDeliveryError,
  MailTransport,
} from "../src/modules/mail/mail.transport.js";
import { AuthMailService } from "../src/modules/auth/auth-mail.service.js";

const gmail = {
  MAIL_PROVIDER: "gmail",
  SMTP_USER: "team@gmail.com",
  SMTP_PASS: "abcd efgh ijkl mnop",
  MAIL_FROM: "BookSportsCourt <team@gmail.com>",
  AUTH_FRONTEND_URL: "http://localhost:3000",
  ALLOWED_ORIGINS: "http://localhost:3000",
};
const environment = {
  DATABASE_URL: "postgresql://localhost/test",
  JWT_ACCESS_SECRET: "a".repeat(32),
  JWT_REFRESH_SECRET: "b".repeat(32),
  ...gmail,
};
const message = {
  from: gmail.MAIL_FROM,
  to: ["recipient@gmail.com"],
  subject: "Đặt sân",
  text: "Nội dung",
  html: "<p>Nội dung</p>",
};

test("Gmail config is provider-specific, fails closed and never discloses secrets", () => {
  assert.equal(
    validateConfig({ ...environment, BUSINESS_MAIL_ENABLED: "true" })
      .MAIL_PROVIDER,
    "gmail",
  );
  assert.doesNotThrow(() =>
    validateConfig({ ...environment, SMTP_PORT: "587", SMTP_SECURE: "false" }),
  );
  for (const invalid of [
    { SMTP_USER: undefined },
    { SMTP_PASS: "private-secret" },
    { MAIL_FROM: "Other <other@gmail.com>" },
    { SMTP_HOST: "attacker.test" },
    { SMTP_PORT: "25" },
    { SMTP_PORT: "587" },
    { SMTP_SECURE: "false" },
    { SMTP_SECURE: "yes" },
    { MAIL_PROVIDER: "unknown" },
  ]) {
    assert.throws(
      () => validateConfig({ ...environment, ...invalid }),
      (error: unknown) =>
        error instanceof Error && !error.message.includes("private-secret"),
    );
  }
  assert.equal(
    validateConfig({
      ...environment,
      MAIL_PROVIDER: undefined,
      SMTP_PASS: undefined,
    }).MAIL_PROVIDER,
    "resend",
  );
  assert.throws(() =>
    validateConfig({
      ...environment,
      MAIL_PROVIDER: "resend",
      BUSINESS_MAIL_ENABLED: "true",
    }),
  );
});

test("Gmail Auth sends verification/reset via TLS without Resend; SMTP data is sanitized", async (t) => {
  const smtp = nodemailer.createTransport({ streamTransport: true });
  const create = t.mock.method(nodemailer, "createTransport", () => smtp);
  const sent = t.mock.method(
    smtp,
    "sendMail",
    async (): Promise<{ accepted: string[]; rejected: string[] }> => ({
      accepted: message.to,
      rejected: [],
    }),
  );
  const close = t.mock.method(smtp, "close");
  const fetch = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Resend must not be called");
  });
  const transport = new MailTransport(new ConfigService(gmail));
  const auth = new AuthMailService(new ConfigService(gmail), transport);
  for (const type of ["email_verify", "password_reset"] as const)
    await auth.send(message.to[0]!, "secret-token", type);
  assert.equal(fetch.mock.callCount(), 0);
  const options = create.mock.calls[0]!.arguments[0] as {
    secure: boolean;
    port: number;
    auth: { pass: string };
    logger: boolean;
  };
  assert.equal(options.port, 465);
  assert.equal(options.secure, true);
  assert.equal(options.auth.pass, "abcdefghijklmnop");
  assert.equal(options.logger, false);
  assert.match(
    sent.mock.calls[0]!.arguments[0]!.text as string,
    /verify-email\?token=secret-token/,
  );
  assert.match(
    sent.mock.calls[1]!.arguments[0]!.text as string,
    /reset-password\?token=secret-token/,
  );
  await transport.send({ ...message, provider: "gmail" }, "bsc/key");
  assert.deepEqual(sent.mock.calls[2]!.arguments[0], message);
  const startTls = new MailTransport(
    new ConfigService({ ...gmail, SMTP_PORT: "587", SMTP_SECURE: "false" }),
  );
  await startTls.send(message);
  assert.equal(
    (create.mock.calls[3]!.arguments[0] as { requireTLS: boolean }).requireTLS,
    true,
  );
  for (const [responseCode, retryable, code] of [
    [421, true, "MAIL_PROVIDER_ERROR"],
    [535, false, "MAIL_PROVIDER_ERROR"],
    [undefined, false, "DELIVERY_AMBIGUOUS"],
  ] as const) {
    sent.mock.mockImplementation(async () => {
      throw Object.assign(new Error("private-secret"), { responseCode });
    });
    await assert.rejects(
      () => transport.send(message),
      (error: unknown) =>
        error instanceof MailDeliveryError &&
        error.code === code &&
        error.retryable === retryable &&
        !error.message.includes("private-secret"),
    );
  }
  sent.mock.mockImplementation(async () => ({
    accepted: [],
    rejected: message.to,
  }));
  await assert.rejects(() => transport.send(message), {
    message: "DELIVERY_AMBIGUOUS",
  });
  assert.equal(close.mock.callCount(), 8);
  await assert.rejects(
    () => transport.send({ ...message, from: "other@gmail.com" }),
    { message: "MAIL_INVALID_REQUEST" },
  );
  assert.throws(
    () =>
      new AuthMailService(
        new ConfigService({ ...gmail, SMTP_PASS: "" }),
        new MailTransport(new ConfigService({ ...gmail, SMTP_PASS: "" })),
      ).assertConfigured(),
    /Cấu hình email/,
  );
});
