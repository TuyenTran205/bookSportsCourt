// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';

import { NavigationProgress } from './NavigationProgress';
import { NAV_TIMING } from '@/lib/navigation/constants';
import {
  cancelNavigation,
  completeNavigation,
  startNavigation,
} from '@/lib/navigation/navigation-store';

vi.mock('next/navigation', () => ({
  usePathname: () => '/current',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const messages: Record<string, string> = {
      navigating: 'Đang chuyển trang…',
      navigatingSlow: 'Đang tải dữ liệu, vui lòng chờ…',
      navigationComplete: 'Đã tải xong trang',
      networkOffline: 'Mất kết nối mạng',
    };
    return messages[key] ?? key;
  },
}));

describe('WT-NAV-01 to WT-NAV-05: NavigationProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    cancelNavigation();
  });

  afterEach(() => {
    cleanup();
    cancelNavigation();
    vi.useRealTimers();
  });

  it('WT-NAV-01: ở trạng thái idle, không render thanh tiến trình và không có aria-busy', () => {
    const { container } = render(<NavigationProgress />);

    const bar = container.querySelector('[data-testid="navigation-progress-bar"]');
    expect(bar).toBeNull();
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();

    const liveRegion = container.querySelector('[role="status"]');
    expect(liveRegion).not.toBeNull();
    expect(liveRegion?.getAttribute('aria-live')).toBe('polite');
  });

  it('WT-NAV-02: start + 150ms thanh xuất hiện, aria-hidden="true", height: 2px (h-0.5), bg-primary-600', () => {
    const { container } = render(<NavigationProgress />);

    act(() => {
      startNavigation('/venues');
      vi.advanceTimersByTime(150);
    });

    const wrapper = container.querySelector('[aria-hidden="true"]');
    expect(wrapper).not.toBeNull();
    expect(wrapper?.classList.contains('h-0.5')).toBe(true);

    const bar = container.querySelector('[data-testid="navigation-progress-bar"]');
    expect(bar).not.toBeNull();
    expect(bar?.classList.contains('bg-primary-600')).toBe(true);
  });

  it('WT-NAV-03: start rồi complete, thanh đạt 100% rồi unmount sau FADE_MS', () => {
    const { container } = render(<NavigationProgress />);

    act(() => {
      startNavigation('/venues');
      vi.advanceTimersByTime(NAV_TIMING.SHOW_DELAY_MS + 10);
    });

    act(() => {
      completeNavigation();
    });

    const bar = container.querySelector('[data-testid="navigation-progress-bar"]');
    expect(bar).not.toBeNull();
    expect(bar?.getAttribute('style')).toContain('100%');

    // Chờ MIN_VISIBLE_MS + FADE_MS
    act(() => {
      vi.advanceTimersByTime(NAV_TIMING.MIN_VISIBLE_MS + NAV_TIMING.FADE_MS + 50);
    });

    expect(container.querySelector('[data-testid="navigation-progress-bar"]')).toBeNull();
  });

  it('WT-NAV-04: start rồi chờ SLOW_HINT_MS thì live region đổi sang navigatingSlow', () => {
    const { container } = render(<NavigationProgress />);

    act(() => {
      startNavigation('/venues');
      // Chờ SHOW_DELAY_MS để visible = true, kích hoạt useEffect
      vi.advanceTimersByTime(NAV_TIMING.SHOW_DELAY_MS + 10);
    });

    act(() => {
      // Chờ tiếp SLOW_HINT_MS để thông báo navigatingSlow
      vi.advanceTimersByTime(NAV_TIMING.SLOW_HINT_MS + 50);
    });

    const liveRegion = container.querySelector('[role="status"]');
    expect(liveRegion?.textContent).toBe('Đang tải dữ liệu, vui lòng chờ…');
  });

  it('WT-NAV-05: complete trước SLOW_HINT_MS thì live region không đọc navigatingSlow', () => {
    const { container } = render(<NavigationProgress />);

    act(() => {
      startNavigation('/venues');
      vi.advanceTimersByTime(NAV_TIMING.SHOW_DELAY_MS + 20); // 140ms < 800ms
      completeNavigation();
    });

    const liveRegion = container.querySelector('[role="status"]');
    expect(liveRegion?.textContent).not.toBe('Đang tải dữ liệu, vui lòng chờ…');
    expect(liveRegion?.textContent).toBe('Đã tải xong trang');
  });
});
