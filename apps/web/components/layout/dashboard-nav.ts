import {
  BarChart3,
  Building2,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileClock,
  LayoutDashboard,
  type LucideIcon,
  Settings,
  ShieldCheck,
  Star,
  Tags,
  Users,
  Wallet,
  CircleDollarSign,
  Clock,
} from 'lucide-react';

/** `labelKey` trỏ vào namespace `owner` / `admin` trong messages/vi.json. */
export interface DashboardNavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
}

export type DashboardArea = 'owner' | 'admin';

export const OWNER_NAV: DashboardNavItem[] = [
  { href: '/owner/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  { href: '/owner/timeline', labelKey: 'timeline', icon: CalendarDays },
  { href: '/owner/payments', labelKey: 'payments', icon: CreditCard },
  { href: '/owner/bookings', labelKey: 'bookings', icon: ClipboardList },
  { href: '/owner/venues', labelKey: 'venues', icon: Building2 },
  { href: '/owner/pricing', labelKey: 'pricing', icon: Clock },
  { href: '/owner/revenue', labelKey: 'revenue', icon: CircleDollarSign },
  { href: '/owner/reviews', labelKey: 'reviews', icon: Star },
  { href: '/owner/settings', labelKey: 'settings', icon: Settings },
];

export const ADMIN_NAV: DashboardNavItem[] = [
  { href: '/admin/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  { href: '/admin/owner-applications', labelKey: 'ownerApplications', icon: ShieldCheck },
  { href: '/admin/venues', labelKey: 'venues', icon: Building2 },
  { href: '/admin/users', labelKey: 'users', icon: Users },
  { href: '/admin/catalogs', labelKey: 'catalogs', icon: Tags },
  { href: '/admin/bookings', labelKey: 'bookings', icon: ClipboardList },
  { href: '/admin/analytics', labelKey: 'analytics', icon: BarChart3 },
  { href: '/admin/audit-logs', labelKey: 'auditLogs', icon: FileClock },
];

export const DASHBOARD_NAV: Record<DashboardArea, DashboardNavItem[]> = {
  owner: OWNER_NAV,
  admin: ADMIN_NAV,
};
