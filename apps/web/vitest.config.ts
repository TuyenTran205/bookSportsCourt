import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

/**
 * Vitest cho unit test phía FE (docs/12-coding-standards.md mục Testing).
 *
 * Alias `@/` phải khớp `tsconfig.json` để import trong test giống hệt trong
 * component — nếu lệch, test sẽ xanh trên một đường dẫn mà app không dùng.
 *
 * Chưa cần `@vitejs/plugin-react`: test render dùng `esbuild.jsx: 'automatic'`
 * là đủ cho các component thuần (không Fast Refresh trong test). File test nào
 * cần DOM thì khai báo `// @vitest-environment jsdom` ở đầu file.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'e2e'],
  },
});
