import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { realpathSync } from 'node:fs';
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
 *
 * Nguyên nhân gốc (đo được): chữ hoa/thường của ký tự ổ đĩa trong cwd. Khi chạy
 * từ `d:\...`, Vite resolve `react` qua chuỗi `d:\...` còn Node (require CJS
 * trong react-dom / @testing-library) dùng realpath `D:\...` -> 2 module
 * identity, 33 file test đổ "Cannot read properties of null (reading 'useMemo')".
 * Chạy từ `D:\...` thì 456/456 pass. Vì vậy alias dưới đây chuẩn hoá ký tự ổ
 * đĩa về chữ hoa để kết quả test không phụ thuộc cwd.
 */
const withUppercaseDrive = (absolutePath: string) =>
    absolutePath.replace(/^([a-z]):/, (_, drive: string) => `${drive.toUpperCase()}:`);
/**
 * Trả về realpath (đã bung symlink pnpm) của một gói, chuẩn hoá ký tự ổ đĩa về
 * chữ hoa — đúng chuỗi mà Node dùng khi tự `require('react')` từ trong
 * react-dom, nhờ vậy Vite và Node chia sẻ cùng một module identity.
 */
const packageRealPath = (packageSpecifier: string, entryFile?: string) => {
    const packageDir = realpathSync(resolve(__dirname, 'node_modules', packageSpecifier));
    return withUppercaseDrive(entryFile ? realpathSync(resolve(packageDir, entryFile)) : packageDir);
};

const reactRealPath = packageRealPath('react');
const reactDomRealPath = packageRealPath('react-dom');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Match chính xác để không phá các subpath của react-dom/@testing-library.
      { find: /^react$/, replacement: reactRealPath },
      { find: /^react\/jsx-runtime$/, replacement: packageRealPath('react', 'jsx-runtime.js') },
      { find: /^react\/jsx-dev-runtime$/, replacement: packageRealPath('react', 'jsx-dev-runtime.js') },
      { find: /^react-dom$/, replacement: reactDomRealPath },
      { find: /^react-dom\/client$/, replacement: packageRealPath('react-dom', 'client.js') },
      { find: /^react-dom\/test-utils$/, replacement: packageRealPath('react-dom', 'test-utils.js') },
      { find: '@', replacement: resolve(__dirname, './') },
    ],
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'e2e'],
  },
});
