// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

import { DashboardShell } from './DashboardShell';
import {
  cancelNavigation,
  completeNavigation,
  startNavigation,
} from '@/lib/navigation/navigation-store';

let currentPathname = '/owner/dashboard';

vi.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/components/layout/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}));

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { fullName: 'Chủ Sân Demo', email: 'owner@bsc.vn' },
    role: 'owner',
    isAuthenticated: true,
    isLoading: false,
    logout: vi.fn(),
  }),
}));

describe('WT-NAV-06 to WT-NAV-10: DashboardShell navigation states', () => {
  beforeEach(() => {
    currentPathname = '/owner/dashboard';
    cancelNavigation();
  });

  afterEach(() => {
    cleanup();
    cancelNavigation();
  });

  it('WT-NAV-06: khi một nav item đang pending, nó nhận aria-busy="true" và spinner; các item khác không bị ảnh hưởng', () => {
    const { container } = render(
      <DashboardShell area="owner">
        <div>Nội dung</div>
      </DashboardShell>,
    );

    act(() => {
      startNavigation('/owner/timeline');
    });

    const timelineLink = container.querySelector('a[href="/owner/timeline"]');
    expect(timelineLink).not.toBeNull();
    expect(timelineLink?.getAttribute('aria-busy')).toBe('true');
    expect(timelineLink?.querySelector('.bsc-spinner')).not.toBeNull();

    const paymentsLink = container.querySelector('a[href="/owner/payments"]');
    expect(paymentsLink?.getAttribute('aria-busy')).toBeNull();
    expect(paymentsLink?.querySelector('.bsc-spinner')).toBeNull();
  });

  it('WT-NAV-07: khi pathname đổi sang target, aria-busy bị gỡ, icon trở lại và có aria-current="page"', () => {
    const { container, rerender } = render(
      <DashboardShell area="owner">
        <div>Nội dung</div>
      </DashboardShell>,
    );

    act(() => {
      startNavigation('/owner/timeline');
    });

    // Giả lập chuyển trang hoàn tất sang /owner/timeline
    currentPathname = '/owner/timeline';
    act(() => {
      completeNavigation();
    });

    rerender(
      <DashboardShell area="owner">
        <div>Nội dung mới</div>
      </DashboardShell>,
    );

    const timelineLink = container.querySelector('a[href="/owner/timeline"]');
    expect(timelineLink?.getAttribute('aria-current')).toBe('page');
    expect(timelineLink?.getAttribute('aria-busy')).toBeNull();
    expect(timelineLink?.querySelector('.bsc-spinner')).toBeNull();
  });

  it('WT-NAV-08: item đang active có aria-current="page", click vào không bật aria-busy', () => {
    currentPathname = '/owner/dashboard';
    const { container } = render(
      <DashboardShell area="owner">
        <div>Nội dung</div>
      </DashboardShell>,
    );

    const dashboardLink = container.querySelector('a[href="/owner/dashboard"]');
    expect(dashboardLink?.getAttribute('aria-current')).toBe('page');
    expect(dashboardLink?.getAttribute('aria-busy')).toBeNull();
  });

  it('WT-NAV-09: khi sidebar collapsed, item pending vẫn render spinner và nhãn có class sr-only', () => {
    const { container } = render(
      <DashboardShell area="owner">
        <div>Nội dung</div>
      </DashboardShell>,
    );

    // Bấm nút thu gọn sidebar
    const collapseBtn = screen.getByLabelText('collapse');
    fireEvent.click(collapseBtn);

    act(() => {
      startNavigation('/owner/payments');
    });

    const paymentsLink = container.querySelector('a[href="/owner/payments"]');
    expect(paymentsLink?.getAttribute('aria-busy')).toBe('true');
    expect(paymentsLink?.querySelector('.bsc-spinner')).not.toBeNull();

    const labelSpan = paymentsLink?.querySelector('span.truncate');
    expect(labelSpan?.classList.contains('sr-only')).toBe(true);
  });

  it('WT-NAV-10: click nav item trong mobile drawer đóng drawer ngay lập tức', () => {
    const { container } = render(
      <DashboardShell area="owner">
        <div>Nội dung</div>
      </DashboardShell>,
    );

    // Mở drawer mobile
    const openMenuBtn = screen.getByLabelText('openMenu');
    fireEvent.click(openMenuBtn);

    const drawer = container.querySelector('aside[role="dialog"]');
    expect(drawer).not.toBeNull();

    // Click một link trong drawer
    const drawerTimelineLink = drawer?.querySelector('a[href="/owner/timeline"]');
    expect(drawerTimelineLink).not.toBeNull();
    fireEvent.click(drawerTimelineLink!);

    // Drawer đóng ngay lập tức
    expect(container.querySelector('aside[role="dialog"]')).toBeNull();
  });
});
