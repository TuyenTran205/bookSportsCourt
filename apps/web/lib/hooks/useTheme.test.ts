// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { THEME_STORAGE_KEY, useTheme } from './useTheme';

function setupMatchMedia(initialMatches = false) {
  let matches = initialMatches;
  const listeners = new Set<(e: { matches: boolean }) => void>();

  const matchMediaMock = vi.fn().mockImplementation((query: string) => ({
    get matches() {
      return matches;
    },
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn((event: string, cb: (e: { matches: boolean }) => void) => {
      if (event === 'change') {
        listeners.add(cb);
      }
    }),
    removeEventListener: vi.fn((event: string, cb: (e: { matches: boolean }) => void) => {
      if (event === 'change') {
        listeners.delete(cb);
      }
    }),
    dispatchEvent: vi.fn(),
  }));

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: matchMediaMock,
  });

  return {
    setMatches(nextMatches: boolean) {
      matches = nextMatches;
      listeners.forEach((listener) => listener({ matches: nextMatches }));
    },
  };
}

describe('useTheme hook (SPEC-FE-BATCH3-01 / TODO-13)', () => {
  let mediaHelper: ReturnType<typeof setupMatchMedia>;

  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    mediaHelper = setupMatchMedia(false);
  });

  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    vi.restoreAllMocks();
  });

  it('khởi tạo mặc định với system theme và resolvedTheme là light khi matchMedia false', () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('system');
    expect(result.current.resolvedTheme).toBe('light');
    expect(result.current.mounted).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('TC-TH-01: chuyển theme sang dark, documentElement nhận class "dark" và lưu localStorage', () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('dark');
    });

    expect(result.current.theme).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('TC-TH-02: chuyển theme sang light, gỡ bỏ class "dark" và lưu localStorage', () => {
    document.documentElement.classList.add('dark');
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme('light');
    });

    expect(result.current.theme).toBe('light');
    expect(result.current.resolvedTheme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('TC-TH-03: đồng bộ system preference khi matchMedia đổi trạng thái', () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('system');
    expect(result.current.resolvedTheme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    // Hệ điều hành đổi sang dark mode
    act(() => {
      mediaHelper.setMatches(true);
    });

    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    // Hệ điều hành đổi lại light mode
    act(() => {
      mediaHelper.setMatches(false);
    });

    expect(result.current.resolvedTheme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('khôi phục theme đã lưu trong localStorage khi mount', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('hoạt động an toàn khi localStorage bị lỗi hoặc bị chặn', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage access denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage quota exceeded');
    });

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('system');

    // Gọi setTheme không ném ngoại lệ
    expect(() => {
      act(() => {
        result.current.setTheme('dark');
      });
    }).not.toThrow();

    expect(result.current.theme).toBe('dark');
  });
});
