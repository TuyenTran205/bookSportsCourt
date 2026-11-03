'use client';

import * as React from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'bsc-theme-mode';

/**
 * useTheme – Quản lý chế độ giao diện Sáng / Tối / Hệ thống (docs/07-design-system.md).
 * Tự động đồng bộ class 'dark' trên thẻ <html> và lưu trữ trạng thái trong localStorage.
 * An toàn tuyệt đối trong môi trường SSR và jsdom unit test (kiểm tra window.matchMedia).
 */
export function useTheme() {
  const [theme, setThemeState] = React.useState<ThemeMode>('system');
  const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>('light');
  const [mounted, setMounted] = React.useState(false);

  // Đọc từ localStorage sau khi mount
  React.useEffect(() => {
    setMounted(true);
    try {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setThemeState(saved);
      }
    } catch {
      // localStorage bị vô hiệu hóa
    }
  }, []);

  // Đồng bộ class trên documentElement và resolvedTheme
  React.useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;

    const hasMatchMedia = typeof window.matchMedia === 'function';
    const mediaQuery = hasMatchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

    const applyTheme = () => {
      let activeTheme: ResolvedTheme = 'light';

      if (theme === 'system') {
        activeTheme = mediaQuery?.matches ? 'dark' : 'light';
      } else {
        activeTheme = theme;
      }

      setResolvedTheme(activeTheme);

      if (activeTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    applyTheme();

    if (!mediaQuery) return;

    const handleChange = () => {
      if (theme === 'system') {
        applyTheme();
      }
    };

    mediaQuery.addEventListener?.('change', handleChange);
    return () => mediaQuery.removeEventListener?.('change', handleChange);
  }, [theme, mounted]);

  const setTheme = React.useCallback((mode: ThemeMode) => {
    setThemeState(mode);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // localStorage bị vô hiệu hóa
    }
  }, []);

  return {
    theme,
    resolvedTheme,
    setTheme,
    mounted,
  };
}
