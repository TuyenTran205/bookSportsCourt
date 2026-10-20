import { z } from "zod";
import { parseAllowedOrigins } from "./allowed-origins.js";

export const AppConfigSchema = z
  .object({
    DATABASE_URL: z.string().url(),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
    ALLOWED_ORIGINS: z.string().min(1),
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
