import { cookies } from 'next/headers';
import type { ApiSuccess, PaginationMeta } from '@bsc/shared';
import { ApiError } from './errors';
import { BACKEND_URL, API_PREFIX } from './client';

/**
 * Biến thể dành cho Server Component.
 *
 * Khác `apiFetch` ở chỗ: chuyển tiếp cookie của người dùng sang backend
 * (`next/headers`) và mặc định `cache: 'no-store'` — dữ liệu đặt sân luôn phải
 * tươi, không được Next cache lại (docs/09-frontend-conventions.md).
 *
 * Lưu ý: KHÔNG dùng hàm này ở Client Component — ở đó dùng `apiFetch`.
 */
export async function apiFetchServer<T>(
  path: string,
  options: RequestInit & { query?: Record<string, string | number | undefined> } = {},
): Promise<{ data: T; meta?: PaginationMeta }> {
  const { query, headers, ...rest } = options;

  const url = new URL(`${BACKEND_URL}${API_PREFIX}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }

  const cookieStore = cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      ...rest,
      cache: rest.cache ?? 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        ...headers,
      },
    });
  } catch (err) {
    throw ApiError.network(err instanceof Error ? err.message : undefined);
  }

  if (!res.ok) throw await ApiError.fromResponse(res);
  if (res.status === 204) return { data: undefined as T };

  const json = (await res.json()) as ApiSuccess<T>;
  return { data: json.data, meta: json.meta };
}
