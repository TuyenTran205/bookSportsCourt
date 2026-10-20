import type { ApiSuccess, PaginationMeta } from '@bsc/shared';
import { ApiError } from './errors';

/**
 * Chạy bằng dữ liệu mẫu (MSW) hay không — cùng cờ với `MockProvider`.
 *
 * Handler MSW đăng ký theo đường dẫn tương đối (`/api/v1/...`) nên chỉ chặn được
 * request cùng origin với FE. Nếu vẫn gọi `NEXT_PUBLIC_API_URL` (cổng 3001) thì
 * request đi thẳng ra ngoài và chết với ERR_CONNECTION_REFUSED vì chưa có backend.
 */
const MOCKING_ENABLED = process.env.NEXT_PUBLIC_API_MOCKING === 'enabled';

/** URL backend thật – khớp `.env.example` (NEXT_PUBLIC_API_URL). Server Component luôn dùng URL này vì MSW chỉ chạy ở trình duyệt. */
export const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/** Base URL mà trình duyệt gọi. Rỗng = cùng origin, để MSW chặn được khi đang dùng dữ liệu mẫu. */
export const API_BASE_URL = MOCKING_ENABLED ? '' : BACKEND_URL;

export const API_PREFIX = '/api/v1';

export interface ApiFetchOptions extends RequestInit {
  /**
   * Query params. Giá trị `undefined`/`null` bị bỏ qua, mảng được lặp lại
   * (`?sportIds=a&sportIds=b`) đúng như docs/11-api-contract.md.
   */
  query?: Record<string, string | number | boolean | string[] | undefined | null>;
}

function buildUrl(path: string, query?: ApiFetchOptions['query']): string {
  // Base rỗng thì `new URL` cần một origin giả để parse; kết quả trả về vẫn là đường dẫn tương đối.
  const url = new URL(`${API_BASE_URL}${API_PREFIX}${path}`, 'http://same-origin.invalid');
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      if (Array.isArray(value)) {
        for (const v of value) url.searchParams.append(key, v);
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return API_BASE_URL ? url.toString() : `${url.pathname}${url.search}`;
}

/**
 * Gọi API và trả về **phần `data`** đã bóc envelope.
 *
 * Mọi response 2xx của dự án đều bọc trong `{ data, meta }`
 * (docs/11-api-contract.md). Hàm này bóc sẵn `data` để component không phải
 * nhớ cấu trúc lồng — đây chính là cạm bẫy tài liệu đã cảnh báo (viết
 * `res.data.length` trong khi danh sách nằm ở `res.data.data`).
 *
 * Cần `meta` phân trang thì dùng `apiFetchWithMeta`.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { data } = await apiFetchWithMeta<T>(path, options);
  return data;
}

/** Như `apiFetch` nhưng giữ cả `meta` – dùng cho bảng/danh sách có phân trang. */
export async function apiFetchWithMeta<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<{ data: T; meta?: PaginationMeta }> {
  const { query, headers, body, ...rest } = options;

  // FormData phải để trình duyệt tự đặt Content-Type kèm boundary.
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      ...rest,
      body,
      credentials: 'include', // gửi cookie httpOnly
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
      },
    });
  } catch (err) {
    // fetch chỉ ném khi lỗi mạng thật (DNS, mất kết nối, CORS).
    throw ApiError.network(err instanceof Error ? err.message : undefined);
  }

  if (!res.ok) throw await ApiError.fromResponse(res);

  // 204 No Content – ví dụ DELETE thành công.
  if (res.status === 204) return { data: undefined as T };

  const json = (await res.json()) as ApiSuccess<T>;
  return { data: json.data, meta: json.meta };
}

/** Tiện ích cho các thao tác ghi – tự stringify body. */
export function jsonBody(data: unknown): Pick<RequestInit, 'body' | 'method'> {
  return { body: JSON.stringify(data) };
}
