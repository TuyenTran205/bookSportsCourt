import { HttpResponse, delay } from 'msw';
import type { PaginationMeta } from '@bsc/shared';

/** Độ trễ giả lập để thấy được trạng thái loading/skeleton. */
export async function simulateLatency(ms = 300): Promise<void> {
  await delay(ms);
}

/** Response thành công: `{ data }` — đúng envelope docs/11-api-contract.md. */
export function ok<T>(data: T, status = 200) {
  return HttpResponse.json({ data }, { status });
}

/** Response danh sách có phân trang: `{ data, meta }`. */
export function okList<T>(data: T[], meta: PaginationMeta) {
  return HttpResponse.json({ data, meta });
}

/** Response lỗi: `{ error: { code, message, details? } }`. */
export function err(
  status: number,
  code: string,
  message: string,
  details?: Record<string, string[]>,
) {
  return HttpResponse.json({ error: { code, message, details } }, { status });
}

/** Chia trang một mảng theo `page`/`limit` (1-based). */
export function paginate<T>(items: T[], page: number, limit: number): { data: T[]; meta: PaginationMeta } {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * limit;
  return {
    data: items.slice(start, start + limit),
    meta: { page: safePage, limit, total, totalPages },
  };
}

/** Đọc `page`/`limit` từ query string. */
export function readPaging(url: URL): { page: number; limit: number } {
  const page = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
  const limit = Number.parseInt(url.searchParams.get('limit') ?? '20', 10);
  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20,
  };
}

/** Đọc nhiều giá trị của cùng một tham số: `?sportIds=a&sportIds=b`. */
export function readArray(url: URL, key: string): string[] {
  return url.searchParams.getAll(key);
}

/** Id mới cho bản ghi vừa tạo (định dạng UUID để qua được Zod `uuid()`). */
export function newId(): string {
  const hex = (n: number) =>
    Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${hex(8)}-${hex(4)}-7${hex(3)}-8${hex(3)}-${hex(12)}`;
}

/**
 * Mã chuyển khoản in trên mã QR chuyển khoản vào tài khoản ngân hàng của chủ sân.
 *
 * Ngắn và chỉ gồm chữ/số để khách gõ lại dễ, nhưng vẫn đủ phân biệt giữa các
 * đơn. Backend thật phải sinh mã này theo cùng quy tắc để đối soát khớp.
 */
export function transferCode(bookingId: string): string {
  return `BSC${bookingId.replace(/-/g, '').slice(-6).toUpperCase()}`;
}
