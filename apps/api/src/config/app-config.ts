import { z } from "zod";
import { parseAllowedOrigins } from "./allowed-origins.js";
const optionalText = () =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(1).optional(),
  );

export const AppConfigSchema = z
  .object({
    DATABASE_URL: z.string().url(),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
    ALLOWED_ORIGINS: z.string().min(1),
    GOOGLE_CLIENT_ID: optionalText(),
    GOOGLE_CLIENT_SECRET: optionalText(),
    GOOGLE_CALLBACK_URL: optionalText(),
    OAUTH_STATE_ENCRYPTION_KEY: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z
        .string()
        .regex(/^[a-fA-F0-9]{64}$/)
        .optional(),
    ),
    R2_ACCOUNT_ID: z
      .string()
      .regex(/^[a-f0-9]{32}$/)
      .optional()
      .or(z.literal("")),
    R2_ACCESS_KEY: z.string().optional(),
    R2_SECRET_KEY: z.string().optional(),
    R2_BUCKET: z.string().optional(),
    R2_PROOF_BUCKET: z.string().optional(),
    OWNER_REVIEW_TIMEOUT_HOURS: z.coerce.number().int().positive().default(2),
    BUSINESS_MAIL_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    RESEND_API_KEY: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().min(1).optional(),
    ),
    MAIL_FROM: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().min(1).optional(),
    ),
    AUTH_FRONTEND_URL: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().url().optional(),
    ),
    NODE_ENV: z
      .enum(["development", "test", "staging", "production"])
      .default("development"),
  })
  .superRefine((config, ctx) => {
    if (
      [
        config.GOOGLE_CLIENT_ID,
        config.GOOGLE_CLIENT_SECRET,
        config.GOOGLE_CALLBACK_URL,
        config.OAUTH_STATE_ENCRYPTION_KEY,
      ].some(Boolean)
    ) {
      try {
        if (
          !config.GOOGLE_CLIENT_ID ||
          !config.GOOGLE_CLIENT_SECRET ||
          !config.GOOGLE_CALLBACK_URL ||
          !config.OAUTH_STATE_ENCRYPTION_KEY ||
          !config.AUTH_FRONTEND_URL ||
          config.OAUTH_STATE_ENCRYPTION_KEY === config.JWT_ACCESS_SECRET ||
          config.OAUTH_STATE_ENCRYPTION_KEY === config.JWT_REFRESH_SECRET
        )
          throw new Error();
        const callback = new URL(config.GOOGLE_CALLBACK_URL),
          frontend = new URL(config.AUTH_FRONTEND_URL);
        const production = ["production", "staging"].includes(config.NODE_ENV);
        const valid = (url: URL) =>
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash &&
          (url.protocol === "https:" ||
            (!production &&
              url.protocol === "http:" &&
              ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)));
        if (
          !valid(callback) ||
          !valid(frontend) ||
          callback.pathname !== "/api/v1/auth/google/callback" ||
          frontend.pathname !== "/" ||
          !parseAllowedOrigins(
            config.ALLOWED_ORIGINS,
            config.NODE_ENV,
          ).includes(frontend.origin)
        )
          throw new Error();
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["GOOGLE_CALLBACK_URL"],
          message:
            "OAuth needs complete credentials/key, exact callback path and an allowed frontend origin; HTTPS required outside local dev/test.",
        });
      }
    }
    if (
      config.BUSINESS_MAIL_ENABLED &&
      (!config.RESEND_API_KEY || !config.MAIL_FROM)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["BUSINESS_MAIL_ENABLED"],
        message: "Email worker requires RESEND_API_KEY and MAIL_FROM.",
      });
    }
    try {
      parseAllowedOrigins(config.ALLOWED_ORIGINS, config.NODE_ENV);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ALLOWED_ORIGINS"],
        message:
          "Cần origin HTTP(S) chính xác, không wildcard/path; production/staging yêu cầu HTTPS.",
      });
    }
  });

export type AppConfig = z.infer<typeof AppConfigSchema>;

export function validateConfig(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const result = AppConfigSchema.safeParse(config);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return result.data;
}
