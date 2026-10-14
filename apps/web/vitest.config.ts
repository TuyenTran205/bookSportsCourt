import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

/**
 * Vitest cho unit test phía FE (docs/12-coding-standards.md mục Testing).
 *
 * Alias `@/` phải khớp `tsconfig.json` để import trong test giống hệt trong
 * component — nếu lệch, test sẽ xanh trên một đường dẫn mà app không dùng.
 *
 * Chưa cần `@vitejs/plugin-react`: hiện chỉ có test logic thuần. Khi viết test
 * render component thì thêm plugin đó vào devDependencies.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'e2e'],
  },
});
