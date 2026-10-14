'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Building2,
  Calendar,
  ChevronDown,
  Heart,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Shield,
  User as UserIcon,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/hooks/useAuth';
import { cn } from '@/lib/utils/cn';

/**
 * Header – Component điều hướng dùng chung toàn hệ thống.
 * Hỗ trợ phân quyền vai trò (Khách, Chủ sân, Quản trị), responsive mobile menu (touch target ≥ 44px),
 * và đồng bộ phiên đăng nhập thời gian thực.
 */
export function Header() {
  const tNav = useTranslations('nav');
  const tCommon = useTranslations('common');
  const pathname = usePathname();
  const { user, role, isAuthenticated, isLoading, logout } = useAuth();

  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  // Đóng mobile menu khi chuyển trang
  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const navLinks = React.useMemo(() => {
    const links = [{ href: '/venues', label: tNav('venues'), icon: MapPin }];

    if (isAuthenticated) {
      if (role === 'customer') {
        links.push({ href: '/bookings', label: tNav('bookings'), icon: Calendar });
        links.push({ href: '/favorites', label: tNav('favorites'), icon: Heart });
      } else if (role === 'owner') {
        links.push({ href: '/owner/timeline', label: 'Lịch sân', icon: Calendar });
        links.push({ href: '/owner/dashboard', label: tNav('ownerDashboard'), icon: LayoutDashboard });
      } else if (role === 'admin') {
        links.push({ href: '/admin/dashboard', label: tNav('adminDashboard'), icon: Shield });
      }
    }

    return links;
  }, [isAuthenticated, role, tNav]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo & Brand */}
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-bold text-primary-700 transition-colors hover:text-primary-800"
          >
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary-700 text-white">
              <Calendar className="size-5" />
            </div>
            <span>{tCommon('appName')}</span>
          </Link>

          {/* Navigation Links (Desktop) */}
          <nav className="hidden md:flex md:items-center md:gap-1">
            {navLinks.map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'flex items-center gap-1.5 rounded-btn px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Account / Auth Actions (Desktop) */}
        <div className="hidden items-center gap-3 md:flex">
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Skeleton className="size-9 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
          ) : isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-btn border border-neutral-200 p-1.5 pl-2 text-left text-sm transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                  aria-label={tNav('profile')}
                >
                  <div className="flex size-8 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
                    {user.fullName.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex flex-col pr-1">
                    <span className="max-w-[120px] truncate text-xs font-medium text-neutral-900">
                      {user.fullName}
                    </span>
                    <span className="text-[10px] text-neutral-500">
                      {role === 'admin'
                        ? 'Quản trị'
                        : role === 'owner'
                          ? 'Chủ sân'
                          : 'Khách hàng'}
                    </span>
                  </div>
                  <ChevronDown className="size-3.5 text-neutral-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="font-medium text-neutral-900">{user.fullName}</p>
                  <p className="text-xs text-neutral-500">{user.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="flex items-center gap-2">
                    <UserIcon className="size-4" />
                    <span>{tNav('profile')}</span>
                  </Link>
                </DropdownMenuItem>
                {role === 'customer' && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/bookings" className="flex items-center gap-2">
                        <Calendar className="size-4" />
                        <span>{tNav('bookings')}</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/favorites" className="flex items-center gap-2">
                        <Heart className="size-4" />
                        <span>{tNav('favorites')}</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/owner/apply" className="flex items-center gap-2 text-primary-700">
                        <Building2 className="size-4" />
                        <span>Đăng ký làm chủ sân</span>
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                {role === 'owner' && (
                  <DropdownMenuItem asChild>
                    <Link href="/owner/timeline" className="flex items-center gap-2">
                      <Calendar className="size-4" />
                      <span>{tNav('ownerDashboard')}</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                {role === 'admin' && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin/dashboard" className="flex items-center gap-2">
                      <Shield className="size-4" />
                      <span>{tNav('adminDashboard')}</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => void logout()}
                  className="flex items-center gap-2 text-danger focus:bg-danger/10 focus:text-danger"
                >
                  <LogOut className="size-4" />
                  <span>{tNav('logout')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">{tNav('login')}</Link>
              </Button>
              <Button variant="primary" size="sm" asChild>
                <Link href="/register">{tNav('register')}</Link>
              </Button>
            </div>
          )}
        </div>

        {/* Mobile Menu Button (touch target ≥ 44px theo WCAG AA & Quy tắc A7) */}
        <div className="flex items-center md:hidden">
          <button
            type="button"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-btn text-neutral-700 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
            aria-label={tNav('menu')}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="border-b border-neutral-200 bg-white px-4 pb-6 pt-2 md:hidden">
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'flex min-h-[44px] items-center gap-2.5 rounded-btn px-3 text-base font-medium transition-colors',
                    active
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900',
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 border-t border-neutral-200 pt-4">
            {isAuthenticated && user ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3 px-3 py-2">
                  <div className="flex size-9 items-center justify-center rounded-full bg-primary-100 font-semibold text-primary-700">
                    {user.fullName.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-neutral-900">{user.fullName}</span>
                    <span className="text-xs text-neutral-500">{user.email}</span>
                  </div>
                </div>
                <Link
                  href="/profile"
                  className="flex min-h-[44px] items-center gap-2.5 rounded-btn px-3 text-sm text-neutral-700 hover:bg-neutral-100"
                >
                  <UserIcon className="size-4" />
                  <span>{tNav('profile')}</span>
                </Link>
                {role === 'customer' && (
                  <Link
                    href="/owner/apply"
                    className="flex min-h-[44px] items-center gap-2.5 rounded-btn px-3 text-sm font-medium text-primary-700 hover:bg-primary-50"
                  >
                    <Building2 className="size-4" />
                    <span>Đăng ký làm chủ sân</span>
                  </Link>
                )}
                <Button
                  variant="outline"
                  size="md"
                  className="mt-2 w-full justify-start text-danger hover:bg-danger/10"
                  onClick={() => void logout()}
                >
                  <LogOut className="size-4" />
                  <span>{tNav('logout')}</span>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Button variant="outline" size="md" asChild className="w-full">
                  <Link href="/login">{tNav('login')}</Link>
                </Button>
                <Button variant="primary" size="md" asChild className="w-full">
                  <Link href="/register">{tNav('register')}</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
