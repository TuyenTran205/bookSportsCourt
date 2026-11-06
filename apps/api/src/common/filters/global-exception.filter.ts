import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { redactLog } from "./redact-log.js";

type HttpResponse = {
  status(status: number): HttpResponse;
  json(body: unknown): void;
};

type NormalizedError = {
  code: string;
  message: string;
  httpStatus: number;
  details?: unknown;
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<HttpResponse>();
    const httpStatus = this.getHttpStatus(exception);
    const error = this.normalizeError(exception, httpStatus);

    if (!(exception instanceof HttpException)) {
      this.logger.error(
        exception instanceof Error
          ? redactLog(exception.message)
          : "Unexpected exception",
        exception instanceof Error && exception.stack
          ? redactLog(exception.stack)
          : undefined,
      );
    }

    response.status(httpStatus).json({ error });
  }

  private getHttpStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    return (
      this.getDatabaseError(exception)?.httpStatus ??
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }

  private normalizeError(
    exception: unknown,
    httpStatus: number,
  ): NormalizedError {
    if (exception instanceof HttpException) {
      return this.normalizeHttpException(exception, httpStatus);
    }

    const databaseError = this.getDatabaseError(exception);
    if (databaseError) {
      return {
        code: databaseError.code,
        message: databaseError.message,
        httpStatus,
      };
    }

    return {
      code: "INTERNAL_ERROR",
      message: "Đã xảy ra lỗi phía máy chủ.",
      httpStatus,
    };
  }

  private normalizeHttpException(
    exception: HttpException,
    httpStatus: number,
  ): NormalizedError {
    const payload = exception.getResponse();

    if (typeof payload === "string") {
      return {
        code: this.defaultCode(httpStatus),
        message: payload,
        httpStatus,
      };
    }

    const body = payload as {
      error?: string | { code?: string; message?: string; details?: unknown };
      message?: string | string[];
      code?: string;
      details?: unknown;
    };
    const nestedError =
      typeof body.error === "object" && body.error !== null
        ? body.error
        : undefined;
    const messages = nestedError?.message ?? body.message;
    const isValidation = Array.isArray(messages);

    return {
      code:
        nestedError?.code ??
        body.code ??
        (isValidation ? "VALIDATION_ERROR" : this.defaultCode(httpStatus)),
      message: isValidation
        ? "Input không hợp lệ"
        : (nestedError?.message ??
          (typeof body.error === "string" ? body.error : messages) ??
          exception.message),
      httpStatus,
      ...(isValidation
        ? { details: messages }
        : nestedError?.details !== undefined
          ? { details: nestedError.details }
          : body.details !== undefined
            ? { details: body.details }
            : {}),
    };
  }

  private getDatabaseError(
    exception: unknown,
  ): { code: string; message: string; httpStatus: number } | undefined {
    if (!this.isDatabaseError(exception)) {
      return undefined;
    }

    switch (exception.code) {
      case "23505":
        return {
          code: "ALREADY_EXISTS",
          message: "Dữ liệu đã tồn tại.",
          httpStatus: HttpStatus.CONFLICT,
        };
      case "23503":
        return {
          code: "RESOURCE_IN_USE",
          message: "Dữ liệu đang được sử dụng bởi tài nguyên khác.",
          httpStatus: HttpStatus.CONFLICT,
        };
      case "23514":
        return {
          code: "VALIDATION_ERROR",
          message: "Dữ liệu không hợp lệ.",
          httpStatus: HttpStatus.BAD_REQUEST,
        };
      case "23P01":
        return {
          code: "BOOKING_CONFLICT",
          message: "Khoảng thời gian này đã có tài nguyên bị trùng.",
          httpStatus: HttpStatus.CONFLICT,
        };
      default:
        return undefined;
    }
  }

  private isDatabaseError(exception: unknown): exception is { code: string } {
    return (
      typeof exception === "object" &&
      exception !== null &&
      "code" in exception &&
      typeof exception.code === "string"
    );
  }

  private defaultCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return "VALIDATION_ERROR";
      case HttpStatus.UNAUTHORIZED:
        return "UNAUTHORIZED";
      case HttpStatus.FORBIDDEN:
        return "FORBIDDEN";
      case HttpStatus.NOT_FOUND:
        return "NOT_FOUND";
      case HttpStatus.CONFLICT:
        return "CONFLICT";
      case HttpStatus.TOO_MANY_REQUESTS:
        return "RATE_LIMIT_EXCEEDED";
      case HttpStatus.SERVICE_UNAVAILABLE:
        return "SERVICE_UNAVAILABLE";
      default:
        return "INTERNAL_ERROR";
    }
  }
}
