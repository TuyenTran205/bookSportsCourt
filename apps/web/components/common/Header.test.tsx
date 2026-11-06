// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

import { Header } from './Header';
import {
  cancelNavigation,
  startNavigation,
} from '@/lib/navigation/navigation-store';

let currentPathname = '/';

vi.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/components/layout/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}));

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { fullName: 'Khách Hàng Demo', email: 'customer@bsc.vn' },
    role: 'customer',
    isAuthenticated: true,
    isLoading: false,
    logout: vi.fn(),
  }),
}));

describe('WT-NAV-11: Header navigation states', () => {
  beforeEach(() => {
    currentPathname = '/';
    cancelNavigation();
  });

  afterEach(() => {
    cleanup();
    cancelNavigation();
  });

  it('khi nav item desktop đang pending, nhận aria-busy="true" và hiển thị spinner', () => {
    const { container } = render(<Header />);

    act(() => {
      startNavigation('/venues');
    });

    const venuesLink = container.querySelector('a[href="/venues"]');
    expect(venuesLink).not.toBeNull();
    expect(venuesLink?.getAttribute('aria-busy')).toBe('true');
    expect(venuesLink?.querySelector('.bsc-spinner')).not.toBeNull();

    const bookingsLink = container.querySelector('a[href="/bookings"]');
    expect(bookingsLink?.getAttribute('aria-busy')).toBeNull();
    expect(bookingsLink?.querySelector('.bsc-spinner')).toBeNull();
  });

  it('click nav link trong mobile drawer đóng drawer ngay lập tức', () => {
    const { container } = render(<Header />);

    // Mở menu mobile (nút menu aria-label="menu")
    const menuBtn = screen.getByLabelText('menu');
    fireEvent.click(menuBtn);

    // Xác nhận drawer mobile đang hiển thị
    const drawerNav = container.querySelector('.md\\:hidden nav');
    expect(drawerNav).not.toBeNull();

    // Click link /venues trong drawer
    const drawerVenuesLink = drawerNav?.querySelector('a[href="/venues"]');
    expect(drawerVenuesLink).not.toBeNull();

    fireEvent.click(drawerVenuesLink!);

    // Drawer đóng ngay lập tức
    expect(container.querySelector('.md\\:hidden nav')).toBeNull();
  });
});
