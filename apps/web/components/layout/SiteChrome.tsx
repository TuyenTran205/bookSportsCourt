'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

import { Footer } from '@/components/common/Footer';
import { Header } from '@/components/common/Header';

/** Khu dashboard có khung riêng (sidebar + topbar) nên không dùng Header/Footer của trang khách. */
const DASHBOARD_PREFIXES = ['/owner', '/admin'];

/**
 * SiteChrome – Header/Footer cho trang khách (docs/07-design-system.md mục 11).
 * Owner/Admin dùng DashboardShell, tránh hai thanh điều hướng chồng nhau.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboard =
    pathname !== '/owner/apply' &&
    DASHBOARD_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );

  if (isDashboard) return <div className="flex-1">{children}</div>;

  return (
    <>
      <Header />
      <div className="flex-1">{children}</div>
      <Footer />
    </>
  );
}
