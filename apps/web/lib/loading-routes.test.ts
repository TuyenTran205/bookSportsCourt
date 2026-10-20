// @vitest-environment jsdom
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

/**
 * Kiểm chứng biên tải (loading boundary) của Next.js App Router.
 *
 * Nguồn: docs/specs/loading-states-spec.md (SPEC-FE-LOADING-01) mục 5.2.
 *
 * Next.js dùng `loading.tsx` gần nhất trên đường đi từ thư mục của `page.tsx`
 * lên tới `app/`, nên test này mô phỏng đúng quy tắc đó thay vì liệt kê tay.
 */

const APP_DIR = join(process.cwd(), 'app');

function collectPages(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);

    if (statSync(full).isDirectory()) {
      // Bỏ qua thư mục nội bộ của Next.js.
      return entry.startsWith('.') ? [] : collectPages(full);
    }

    return entry === 'page.tsx' ? [full] : [];
  });
}

/** `loading.tsx` gần nhất bao phủ một trang, tính cả chính thư mục của trang. */
function resolveBoundary(pagePath: string): string | null {
  let current = dirname(pagePath);

  for (;;) {
    const candidate = join(current, 'loading.tsx');
    if (existsSync(candidate)) return candidate;
    if (current === APP_DIR) return null;
    current = dirname(current);
  }
}

const pages = collectPages(APP_DIR).sort();
const loadingFiles = pages
  .map(resolveBoundary)
  .filter((file): file is string => file !== null)
  .filter((file, index, all) => all.indexOf(file) === index)
  .sort();

/** Mọi `loading.tsx` trong app/, kể cả file không phủ trang nào (phòng hờ). */
const allLoadingFiles = readdirSync(APP_DIR, { recursive: true, encoding: 'utf8' })
  .map((entry) => join(APP_DIR, entry))
  .filter((entry) => entry.endsWith('loading.tsx') && statSync(entry).isFile())
  .sort();

const relativeToApp = (file: string) => relative(APP_DIR, file).split('\\').join('/');

describe('Route coverage – mọi màn hình đều có loading.tsx', () => {
  it('tìm thấy toàn bộ trang của ứng dụng', () => {
    // Chốt chặn: nếu đường dẫn quét sai, các test dưới sẽ "pass rỗng".
    expect(pages.length).toBeGreaterThanOrEqual(30);
  });

  it.each(pages.map((page) => [relativeToApp(page), page] as const))(
    '%s được bao phủ bởi một loading.tsx',
    (_name, page) => {
      const boundary = resolveBoundary(page);

      expect(boundary, `Thiếu loading.tsx cho ${relativeToApp(page)}`).not.toBeNull();
      expect(statSync(boundary!).isFile()).toBe(true);
    },
  );

  it('có loading boundary ở mọi tầng cần thiết', () => {
    const names = allLoadingFiles.map(relativeToApp);

    expect(names).toEqual(
      expect.arrayContaining([
        'loading.tsx',
        '(public)/loading.tsx',
        '(public)/venues/loading.tsx',
        '(public)/venues/[slug]/loading.tsx',
        '(public)/(auth)/loading.tsx',
        '(customer)/loading.tsx',
        '(customer)/bookings/loading.tsx',
        '(customer)/bookings/[id]/loading.tsx',
        '(customer)/favorites/loading.tsx',
        '(customer)/profile/loading.tsx',
        '(owner)/loading.tsx',
        '(owner)/dashboard/loading.tsx',
        '(owner)/owner/loading.tsx',
        '(admin)/loading.tsx',
        '(admin)/admin/loading.tsx',
        'auth/callback/google/loading.tsx',
      ]),
    );
  });
});

describe('Nội dung loading.tsx', () => {
  /**
   * `import.meta.glob` là API của Vite; dự án không cài `vite/client` trực tiếp
   * nên khai báo kiểu tại chỗ thay vì thêm một global augmentation.
   */
  const modules = (
    import.meta as unknown as {
      glob: <T>(pattern: string, options: { eager: true }) => Record<string, T>;
    }
  ).glob<{ default: React.ComponentType }>('/app/**/loading.tsx', { eager: true });

  it.each(allLoadingFiles.map(relativeToApp))('%s export default một component', (name) => {
    const key = `/app/${name}`;
    const mod = modules[key];

    expect(mod, `Không import được ${key}`).toBeDefined();
    expect(typeof mod?.default).toBe('function');
  });

  it.each(allLoadingFiles.map(relativeToApp))(
    '%s render một live region (Spinner/PageLoader)',
    (name) => {
      const Component = modules[`/app/${name}`]!.default;
      const { container, unmount } = render(React.createElement(Component));

      const status = container.querySelector('[role="status"]');
      expect(status, `${name} không render live region`).not.toBeNull();
      expect(status?.getAttribute('aria-live')).toBe('polite');

      unmount();
    },
  );

  it.each(allLoadingFiles.map(relativeToApp))('%s không vi phạm quy tắc anti-AI', (name) => {
    const source = readFileSync(join(APP_DIR, name), 'utf8');

    // Mục 2: cấm gradient/neon, cấm emoji trong nội dung hiển thị.
    expect(source).not.toMatch(/bg-gradient|drop-shadow-\[|shadow-\[0_0/);
    expect(source).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });
});
