import { BadRequestException } from "@nestjs/common";
import type { z } from "zod";

export function parseBody<T extends z.ZodTypeAny>(
  schema: T,
  body: unknown,
): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new BadRequestException({
      code: "VALIDATION_ERROR",
      message: "Dữ liệu không hợp lệ.",
      details: result.error.flatten(),
    });
  }
  return result.data;
}
