'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronsLeft, ChevronsRight, LogOut, Menu, Store, X } from 'lucide-react';

import { NotificationBell } from '@/components/layout/NotificationBell';
import { DASHBOARD_NAV, type DashboardArea } from '@/components/layout/dashboard-nav';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/hooks/useAuth';
import { cn } from '@/lib/utils/cn';

const COLLAPSE_KEY = 'bsc.dashboard.sidebarCollapsed';

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeCollapsed(value: boolean) {
  try {
    window.localStorage.setItem(COLLAPSE_KEY, value ? '1' : '0');
  } catch {
    /* localStorage bị chặn: chỉ mất tiện ích ghi nhớ, không ảnh hưởng chức năng */
  }
}

interface NavListProps {
  area: DashboardArea;
  collapsed: boolean;
  onNavigate?: () => void;
}

function NavList({ area, collapsed, onNavigate }: NavListProps) {
  const pathname = usePathname();
  const t = useTranslations(area);

  return (
    <nav aria-label={area} className="flex-1 space-y-1 overflow-y-auto px-3 py-4 scrollbar-thin">
      {DASHBOARD_NAV[area].map(({ href, labelKey, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        const label = t(labelKey);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            title={collapsed ? label : undefined}
            className={cn(
              'flex h-10 items-center gap-3 rounded-btn px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600',
              active
                ? 'bg-primary-50 text-primary-700'
                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
              collapsed && 'justify-center px-0',
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden="true" />
            <span className={cn('truncate', collapsed && 'sr-only')}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * DashboardShell – khung chung cho Owner/Admin (docs/07-design-system.md mục 11).
 * Desktop: sidebar cố định, thu gọn được. Mobile: drawer mở từ nút menu ở topbar.
 */
export function DashboardShell({
  area,
  children,
}: {
  area: DashboardArea;
  children: React.ReactNode;
}) {
  const t = useTranslations('shell');
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const [collapsed, setCollapsed] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  React.useEffect(() => {
    setCollapsed(readCollapsed());
  }, []);

  // Đổi trang thì đóng drawer.
  React.useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Drawer mở: Esc để đóng, khoá cuộn nền.
  React.useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [drawerOpen]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      writeCollapsed(!prev);
      return !prev;
    });
  };

  const areaTitle = area === 'owner' ? t('ownerArea') : t('adminArea');

  return (
    <div className="flex min-h-screen w-full min-w-0 bg-neutral-50">
      <a
        href="#dashboard-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-btn focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-700 focus:shadow-md"
      >
        {t('skipToContent')}
      </a>

      {/* Sidebar desktop */}
      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-neutral-200 bg-white transition-[width] duration-200 lg:flex',
          collapsed ? 'w-[72px]' : 'w-64',
        )}
      >
        <div
          className={cn(
            'flex h-16 items-center gap-2 border-b border-neutral-200 px-4',
            collapsed && 'justify-center px-0',
          )}
        >
          <Store className="size-6 shrink-0 text-primary-600" aria-hidden="true" />
          <span className={cn('truncate text-base font-semibold', collapsed && 'sr-only')}>
            {areaTitle}
          </span>
        </div>
        <NavList area={area} collapsed={collapsed} />
        <div className="border-t border-neutral-200 p-3">
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? t('expand') : t('collapse')}
            className={cn(
              'flex h-10 w-full items-center gap-3 rounded-btn px-3 text-sm text-neutral-600 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600',
              collapsed && 'justify-center px-0',
            )}
          >
            {collapsed ? (
              <ChevronsRight className="size-5" aria-hidden="true" />
            ) : (
              <>
                <ChevronsLeft className="size-5" aria-hidden="true" />
                <span>{t('collapse')}</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Drawer mobile */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={t('closeMenu')}
            className="absolute inset-0 bg-neutral-900/50"
            onClick={() => setDrawerOpen(false)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={areaTitle}
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-md"
          >
            <div className="flex h-16 items-center justify-between border-b border-neutral-200 px-4">
              <span className="flex items-center gap-2 text-base font-semibold">
                <Store className="size-6 text-primary-600" aria-hidden="true" />
                {areaTitle}
              </span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label={t('closeMenu')}
                className="inline-flex size-10 items-center justify-center rounded-btn text-neutral-600 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <NavList area={area} collapsed={false} onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b border-neutral-200 bg-white px-4 lg:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label={t('openMenu')}
            className="inline-flex size-10 items-center justify-center rounded-btn text-neutral-600 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 lg:hidden"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <p className="truncate text-base font-semibold lg:hidden">{areaTitle}</p>

          <div className="ml-auto flex items-center gap-1">
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-10 items-center gap-2 rounded-btn px-2 text-sm hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                  aria-label={t('account')}
                >
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
                    {(user?.fullName ?? '?').trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden max-w-[140px] truncate font-medium text-neutral-900 sm:block">
                    {user?.fullName}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/">{t('backToSite')}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void logout()}>
                  <LogOut className="mr-2 size-4" aria-hidden="true" />
                  {t('logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main
          id="dashboard-main"
          tabIndex={-1}
          className="w-full min-w-0 max-w-full flex-1 focus:outline-none"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
