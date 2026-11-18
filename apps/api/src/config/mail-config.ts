import { z } from "zod";

// Server-only provider configuration; never exposed as a frontend contract.
export const GmailConfigSchema = z
  .object({
    SMTP_HOST: z.literal("smtp.gmail.com").default("smtp.gmail.com"),
    SMTP_PORT: z.coerce
      .number()
      .pipe(z.union([z.literal(465), z.literal(587)]))
      .default(465),
    SMTP_SECURE: z.preprocess(
      (value) => (value === "true" ? true : value === "false" ? false : value),
      z.boolean().default(true),
    ),
    SMTP_USER: z.string().email(),
    SMTP_PASS: z
      .string()
      .transform((value) => value.replace(/\s/g, ""))
      .pipe(z.string().regex(/^[a-zA-Z]{16}$/)),
    MAIL_FROM: z.string().min(1),
  })
  .superRefine((config, ctx) => {
    const address = /^(?:[^<>\r\n]+<([^<>\r\n]+)>|([^<>\s]+))$/.exec(
      config.MAIL_FROM,
    );
    if (
      !address ||
      (address[1] ?? address[2])?.toLowerCase() !==
        config.SMTP_USER.toLowerCase()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["MAIL_FROM"],
        message: "MAIL_FROM must use SMTP_USER as sender.",
      });
    }
    if (config.SMTP_SECURE !== (config.SMTP_PORT === 465)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SMTP_SECURE"],
        message: "Use TLS=true on 465 or STARTTLS=false on 587.",
      });
    }
  });
