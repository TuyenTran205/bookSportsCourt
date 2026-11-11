import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

/**
 * Vitest cho unit test phía FE (docs/12-coding-standards.md mục Testing).
 *
 * Alias `@/` phải khớp `tsconfig.json` để import trong test giống hệt trong
 * component — nếu lệch, test sẽ xanh trên một đường dẫn mà app không dùng.
 *
 * Dùng `@vitejs/plugin-react` (ADR-028) kèm alias react/react-dom về một
 * instance duy nhất: trên Windows + pnpm, react (d:\...) và react-dom (D:\...)
 * có thể bị nạp thành 2 module identity -> "Invalid hook call" khi render qua
 * @testing-library/react. File test cần DOM khai `// @vitest-environment jsdom`.
 */
export default defineConfig({
  plugins: [react()],
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
