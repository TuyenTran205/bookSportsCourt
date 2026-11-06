// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { ThemeToggle } from './ThemeToggle';
import * as useThemeModule from '@/lib/hooks/useTheme';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      toggle: 'Chuyển chế độ giao diện',
      light: 'Sáng',
      dark: 'Tối',
      system: 'Hệ thống',
    };
    return translations[key] ?? key;
  },
}));

describe('ThemeToggle component (SPEC-FE-BATCH3-01 / TODO-13)', () => {
  const mockSetTheme = vi.fn();

  beforeEach(() => {
    mockSetTheme.mockClear();
    vi.spyOn(useThemeModule, 'useTheme').mockReturnValue({
      theme: 'system',
      resolvedTheme: 'light',
      setTheme: mockSetTheme,
      mounted: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('render nút disabled khi chưa mounted (tránh mismatch SSR)', () => {
    vi.spyOn(useThemeModule, 'useTheme').mockReturnValue({
      theme: 'system',
      resolvedTheme: 'light',
      setTheme: mockSetTheme,
      mounted: false,
    });

    render(<ThemeToggle />);

    const button = screen.getByRole('button', { name: 'Chuyển chế độ giao diện' });
    expect(button).toBeDefined();
    expect(button.getAttribute('disabled')).toBe('');
  });

  it('TC-TH-04: render nút toggle với aria-label khi đã mounted', () => {
    render(<ThemeToggle />);

    const button = screen.getByRole('button', { name: 'Chuyển chế độ giao diện' });
    expect(button).toBeDefined();
    expect(button.getAttribute('disabled')).toBeNull();
  });

  it('hiển thị icon mặt trời khi resolvedTheme là light', () => {
    vi.spyOn(useThemeModule, 'useTheme').mockReturnValue({
      theme: 'light',
      resolvedTheme: 'light',
      setTheme: mockSetTheme,
      mounted: true,
    });

    const { container } = render(<ThemeToggle />);
    // Sun icon từ lucide-react render svg với class size-4 text-amber-500
    const icon = container.querySelector('svg.text-amber-500');
    expect(icon).not.toBeNull();
  });

  it('hiển thị icon mặt trăng khi resolvedTheme là dark', () => {
    vi.spyOn(useThemeModule, 'useTheme').mockReturnValue({
      theme: 'dark',
      resolvedTheme: 'dark',
      setTheme: mockSetTheme,
      mounted: true,
    });

    const { container } = render(<ThemeToggle />);
    // Moon icon từ lucide-react render svg với class size-4 text-neutral-200
    const icon = container.querySelector('svg.text-neutral-200');
    expect(icon).not.toBeNull();
  });

  it('mở menu dropdown và kích hoạt setTheme("dark") khi chọn "Tối"', () => {
    render(<ThemeToggle />);

    const trigger = screen.getByRole('button', { name: 'Chuyển chế độ giao diện' });
    fireEvent.keyDown(trigger, { key: 'Enter' });

    const darkOption = screen.getByText('Tối');
    expect(darkOption).toBeDefined();

    fireEvent.click(darkOption);
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('mở menu dropdown và kích hoạt setTheme("light") khi chọn "Sáng"', () => {
    render(<ThemeToggle />);

    const trigger = screen.getByRole('button', { name: 'Chuyển chế độ giao diện' });
    fireEvent.keyDown(trigger, { key: 'Enter' });

    const lightOption = screen.getByText('Sáng');
    expect(lightOption).toBeDefined();

    fireEvent.click(lightOption);
    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });

  it('mở menu dropdown và kích hoạt setTheme("system") khi chọn "Hệ thống"', () => {
    render(<ThemeToggle />);

    const trigger = screen.getByRole('button', { name: 'Chuyển chế độ giao diện' });
    fireEvent.keyDown(trigger, { key: 'Enter' });

    const systemOption = screen.getByText('Hệ thống');
    expect(systemOption).toBeDefined();

    fireEvent.click(systemOption);
    expect(mockSetTheme).toHaveBeenCalledWith('system');
  });
});
