/**
 * Phân loại link và bọc router — docs/specs/instant-navigation-loading-spec.md §4.2, §6.4.
 *
 * `classifyNavigation` là hàm thuần (không React, không DOM) để test được bằng
 * bảng quyết định R1–R8. Mọi truy cập `window` nằm trong hook/handler.
 */
'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  cancelNavigation,
  completeNavigation,
  getServerSnapshot,
  getSnapshot,
  startNavigation,
  subscribe,
  type NavigationSnapshot,
} from './navigation-store';

export type NavigationKind =
  | 'internal'
  | 'external'
  | 'hash'
  | 'same-route'
  | 'download';

export interface ClassifiedTarget {
  kind: NavigationKind;
  /** pathname + search đã chuẩn hoá; null với external/download */
  href: string | null;
}

export interface ClassifyOptions {
  pathname: string;
  search: string;
  origin: string;
  download?: boolean;
  target?: string;
}

/** Giao thức không bao giờ điều hướng nội bộ — chặn cả XSS (R3). */
const BLOCKED_PROTOCOLS = ['mailto:', 'tel:', 'javascript:', 'data:'];

/** Bỏ trailing slash, trừ path gốc (R7, bước 2). */
function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.replace(/\/+$/, '') || '/';
  }
  return pathname;
}

/**
 * Bảng quyết định R1–R8. Thứ tự kiểm tra là một phần của hợp đồng:
 * R3 phải chạy trước khi `new URL()` chạm tới href.
 */
export function classifyNavigation(
  href: string | null,
  opts: ClassifyOptions,
): ClassifiedTarget {
  const raw = (href ?? '').trim();

  // R1
  if (raw.length === 0) return { kind: 'same-route', href: null };

  // R2
  if (raw.startsWith('#')) return { kind: 'hash', href: null };

  // R3
  const lower = raw.toLowerCase();
  if (BLOCKED_PROTOCOLS.some((protocol) => lower.startsWith(protocol))) {
    return { kind: 'external', href: null };
  }

  // R4
  if (opts.download) return { kind: 'download', href: null };

  // R5
  if (opts.target !== undefined && opts.target !== '_self') {
    return { kind: 'external', href: null };
  }

  let url: URL;
  try {
    url = new URL(raw, opts.origin);
  } catch {
    // href không parse được → không đoán, bỏ qua.
    return { kind: 'same-route', href: null };
  }

  // R6
  if (url.origin !== opts.origin) return { kind: 'external', href: null };

  // R2 (dạng tuyệt đối: https://origin/page#section vẫn là internal nếu khác trang)
  const targetPath = normalizePath(url.pathname);
  const targetHref = `${targetPath}${url.search}`;

  // R7 — so sánh case-sensitive, giữ nguyên thứ tự query của đích.
  const currentPath = normalizePath(opts.pathname);
  const currentSearch = opts.search.startsWith('?')
    ? opts.search
    : opts.search.length > 0
      ? `?${opts.search}`
      : '';
  const currentHref = `${currentPath}${currentSearch}`;

  if (targetHref === currentHref) return { kind: 'same-route', href: null };

  // R8
  return { kind: 'internal', href: targetHref };
}

/**
 * Router có phản hồi điều hướng. Dùng thay `useRouter()` ở mọi chỗ điều hướng
 * lập trình để thanh tiến trình chạy (AC-7).
 */
export function useAppRouter() {
  const router = useRouter();
  const pathname = usePathname();

  /** Chỉ start khi thực sự đổi route; same-route/hash/external để router tự xử lý. */
  const start = React.useCallback(
    (href: string) => {
      if (typeof window === 'undefined') return;
      const classified = classifyNavigation(href, {
        pathname,
        search: window.location.search,
        origin: window.location.origin,
      });
      if (classified.kind === 'internal' && classified.href !== null) {
        startNavigation(classified.href);
      }
    },
    [pathname],
  );

  return React.useMemo(
    () => ({
      push(href: string) {
        start(href);
        try {
          router.push(href);
        } catch (error) {
          // E5: push ném đồng bộ → thanh không được treo.
          cancelNavigation();
          throw error;
        }
      },
      replace(href: string) {
        start(href);
        try {
          router.replace(href);
        } catch (error) {
          cancelNavigation();
          throw error;
        }
      },
      refresh() {
        router.refresh();
      },
    }),
    [router, start],
  );
}

/** Đọc snapshot điều hướng — `useSyncExternalStore` để không cần provider. */
export function useNavigation(): NavigationSnapshot {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Bắt click link nội bộ trên toàn tài liệu. Mount một lần ở `NavigationProgress`.
 *
 * Listener ở pha bubble trên `document`: React 18 gắn handler tại root container
 * nên handler `onClick` của component chạy trước, và `defaultPrevented` đã có giá
 * trị đúng (E8).
 *
 * E11: không xử lý `popstate` — Back/Forward để `loading.tsx` lo.
 */
export function useNavigationListener(enabled: boolean): void {
  React.useEffect(() => {
    if (!enabled) return;

    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.dataset.noProgress !== undefined) return;

      const { kind, href } = classifyNavigation(anchor.getAttribute('href'), {
        pathname: window.location.pathname,
        search: window.location.search,
        origin: window.location.origin,
        download: anchor.hasAttribute('download'),
        target: anchor.getAttribute('target') ?? undefined,
      });

      if (kind === 'internal' && href !== null) startNavigation(href);
    }

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [enabled]);
}

/**
 * Chốt hoàn tất: so pathname + search hiện tại với lúc start.
 * `completeNavigation` idempotent nên gọi thừa không hại.
 *
 * Dùng `useSearchParams` (không phải `location.search`) để phản ứng cả khi chỉ
 * đổi query — ví dụ phân trang `?page=2`. Component gọi hook này được bọc
 * `Suspense` ở root layout.
 */
export function useNavigationCompletion(): void {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const current = `${normalizePath(pathname)}${query.length > 0 ? `?${query}` : ''}`;

  React.useEffect(() => {
    const { phase, target } = getSnapshot();
    if (phase !== 'pending' || target === null) return;
    if (current === target) completeNavigation();
  }, [current]);
}
