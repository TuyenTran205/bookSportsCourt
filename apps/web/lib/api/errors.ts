import type { ApiErrorBody, ApiSuccess } from '@bsc/shared';

/**
 * Lỗi API đã chuẩn hoá.
 *
 * Mọi lỗi từ tầng `apiFetch` đều là `ApiError`, nên component chỉ cần bắt một
 * kiểu và đọc `code` để xử lý (ví dụ 409 `SLOT_TAKEN` → thông báo slot vừa bị
 * người khác lấy). Nguồn: docs/11-api-contract.md.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, string[]>;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Đọc body `{ error: { code, message, details } }` và dựng ApiError. */
  static async fromResponse(res: Response): Promise<ApiError> {
    let code = 'INTERNAL_ERROR';
    let message = `Yêu cầu thất bại (${res.status})`;
    let details: Record<string, string[]> | undefined;

    try {
      const body = (await res.json()) as ApiErrorBody;
      if (body?.error) {
        code = body.error.code || code;
        message = body.error.message || message;
        details = body.error.details;
      }
    } catch {
      // Body không phải JSON (ví dụ 502 từ proxy) – giữ thông báo mặc định.
    }

    return new ApiError(res.status, code, message, details);
  }

  /** Lỗi do mất kết nối / fetch ném ra, không có response. */
  static network(message = 'Không kết nối được tới máy chủ'): ApiError {
    return new ApiError(0, 'NETWORK_ERROR', message);
  }

  get isNotFound() {
    return this.status === 404;
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }
}

/** Kiểu dùng khi cần khai báo tường minh ở chữ ký hàm. */
export type { ApiSuccess };
