import { BadRequestException, type PipeTransform } from "@nestjs/common";
import type { z } from "zod";

/** Runtime validation for inferred DTOs, which have no class-validator metadata. */
export class ZodValidationPipe<T extends z.ZodTypeAny> implements PipeTransform<
  unknown,
  z.output<T>
> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const details: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const path = issue.path.join(".") || "_root";
        (details[path] ??= []).push(issue.message);
      }
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Input không hợp lệ",
        details,
      });
    }
    return result.data;
  }
}
