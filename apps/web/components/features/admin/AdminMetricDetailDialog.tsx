'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Clock,
  DollarSign,
  Layers,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { listAdminBookings, listAdminUsers, listAdminVenues } from '@/lib/api/endpoints/admin';
import type { AdminStats } from '@/lib/api/endpoints/admin';
import { useAdminAnalytics } from '@/lib/hooks/useAdminDashboard';
import { cn } from '@/lib/utils/cn';
import { formatCurrency } from '@/lib/utils/format';

export type MetricModalType = 'revenue' | 'users' | 'venues' | 'bookings' | null;

export interface AdminMetricDetailDialogProps {
  type: MetricModalType;
  onClose: () => void;
  stats?: AdminStats;
}

export function AdminMetricDetailDialog({
  type,
  onClose,
  stats,
}: AdminMetricDetailDialogProps) {
  const isOpen = type !== null;

  // Query analytics cho Pop-up Doanh thu
  const analyticsQuery = useAdminAnalytics();
  const analytics = analyticsQuery.data;

  // Query danh sách người dùng cho Pop-up Người dùng
  const usersQuery = useQuery({
    queryKey: ['admin', 'users', 'preview-modal'],
    queryFn: () => listAdminUsers({ limit: 5 }),
    enabled: type === 'users',
    staleTime: 60 * 1000,
  });

  // Query danh sách cơ sở cho Pop-up Cơ sở
  const venuesQuery = useQuery({
    queryKey: ['admin', 'venues', 'preview-modal'],
    queryFn: () => listAdminVenues({ limit: 5 }),
    enabled: type === 'venues',
    staleTime: 60 * 1000,
  });

  // Query danh sách lượt đặt cho Pop-up Lượt đặt
  const bookingsQuery = useQuery({
    queryKey: ['admin', 'bookings', 'preview-modal'],
    queryFn: () => listAdminBookings({ limit: 5 }),
    enabled: type === 'bookings',
    staleTime: 60 * 1000,
  });

  // Dữ liệu doanh thu theo cơ sở: ưu tiên hiển thị các cơ sở có phát sinh doanh thu trước
  const venuesRevenue = React.useMemo(() => {
    const list = analytics?.byVenue ?? [];
    const withRevenue = list.filter((v) => (v.revenue || 0) > 0).sort((a, b) => b.revenue - a.revenue);
    if (withRevenue.length > 0) return withRevenue;
    return [...list].sort((a, b) => b.revenue - a.revenue);
  }, [analytics?.byVenue]);

  const totalVenueRev = React.useMemo(() => {
    return venuesRevenue.reduce((sum, v) => sum + (v.revenue || 0), 0) || stats?.totalRevenue || 1;
  }, [venuesRevenue, stats?.totalRevenue]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        {type === 'revenue' && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2.5 text-primary-700 dark:text-primary-400">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-950/60">
                  <DollarSign className="size-4.5" />
                </span>
                <DialogTitle>Chi tiết Doanh thu toàn sàn</DialogTitle>
              </div>
              <DialogDescription>
                Phân bổ dòng tiền thanh toán và đóng góp doanh thu theo từng cơ sở thể thao.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-2 flex flex-col gap-4">
              {/* 3 Thẻ thống kê tài chính */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="rounded-lg border border-primary-200 bg-primary-50/60 p-2.5 sm:p-3 dark:border-primary-900/40 dark:bg-primary-950/30">
                  <span className="text-[11px] font-medium text-text-secondary">Doanh thu ròng</span>
                  <p className="mt-1 text-sm sm:text-base font-bold tabular-nums text-primary-700 dark:text-primary-300">
                    {formatCurrency(stats?.totalRevenue ?? stats?.summary?.netRevenue ?? 0)}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-bg-subtle p-2.5 sm:p-3">
                  <span className="text-[11px] font-medium text-text-secondary">Doanh thu gộp</span>
                  <p className="mt-1 text-sm sm:text-base font-bold tabular-nums text-text-primary">
                    {formatCurrency(stats?.summary?.grossRevenue ?? stats?.totalRevenue ?? 0)}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-bg-subtle p-2.5 sm:p-3">
                  <span className="text-[11px] font-medium text-text-secondary">Hoàn tiền</span>
                  <p className="mt-1 text-sm sm:text-base font-bold tabular-nums text-danger">
                    {formatCurrency(stats?.summary?.refundedAmount ?? 0)}
                  </p>
                </div>
              </div>

              {/* Danh sách cơ sở đóng góp doanh thu */}
              <div className="flex flex-col gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Đóng góp theo cơ sở thể thao
                </h4>

                {analyticsQuery.isPending ? (
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-14 w-full rounded-md" />
                    <Skeleton className="h-14 w-full rounded-md" />
                    <Skeleton className="h-14 w-full rounded-md" />
                  </div>
                ) : venuesRevenue.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-text-secondary">
                    Chưa ghi nhận dữ liệu doanh thu chi tiết từ các cơ sở trong kỳ.
                  </div>
                ) : (
                  <div className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
                    {venuesRevenue.map((venue) => {
                      const percent = Math.min(100, Math.round((venue.revenue / totalVenueRev) * 100)) || 0;
                      return (
                        <div
                          key={venue.venueId}
                          className="flex flex-col gap-1.5 rounded-lg border border-border bg-bg-card p-3 transition-colors hover:bg-bg-subtle"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-text-primary text-xs sm:text-sm line-clamp-1">
                              {venue.name}
                            </span>
                            <span className="shrink-0 font-bold tabular-nums text-primary-700 dark:text-primary-300 text-xs sm:text-sm">
                              {formatCurrency(venue.revenue)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-text-secondary">
                            <span>{venue.bookings} lượt hoàn thành</span>
                            <span>{percent}% tổng doanh thu</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                            <div
                              className="h-full bg-primary-600 transition-all duration-300"
                              style={{ width: `${Math.max(percent, 4)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="mt-4 gap-2">
              <DialogClose asChild>
                <Button variant="ghost" size="sm">Đóng</Button>
              </DialogClose>
              <Link href="/admin/bookings">
                <Button variant="outline" size="sm">
                  Xem tất cả đơn đặt
                  <ArrowRight className="ml-1 size-3.5" />
                </Button>
              </Link>
            </DialogFooter>
          </>
        )}

        {type === 'users' && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400">
                <span className="flex size-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950/60">
                  <Users className="size-4.5" />
                </span>
                <DialogTitle>Cơ cấu Người dùng nền tảng</DialogTitle>
              </div>
              <DialogDescription>
                Phân bổ tài khoản theo vai trò hoạt động trên toàn hệ thống.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-2 flex flex-col gap-4">
              {/* 3 Thẻ vai trò */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="rounded-lg border border-border bg-bg-subtle p-2.5 sm:p-3">
                  <span className="text-[11px] font-medium text-text-secondary">Khách hàng</span>
                  <p className="mt-1 text-sm sm:text-base font-bold tabular-nums text-text-primary">
                    {stats?.summary?.userCountsByRole?.customer ?? 0} người
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-bg-subtle p-2.5 sm:p-3">
                  <span className="text-[11px] font-medium text-text-secondary">Chủ cơ sở</span>
                  <p className="mt-1 text-sm sm:text-base font-bold tabular-nums text-primary-700 dark:text-primary-300">
                    {stats?.summary?.userCountsByRole?.owner ?? 0} người
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-bg-subtle p-2.5 sm:p-3">
                  <span className="text-[11px] font-medium text-text-secondary">Quản trị viên</span>
                  <p className="mt-1 text-sm sm:text-base font-bold tabular-nums text-purple-700 dark:text-purple-300">
                    {stats?.summary?.userCountsByRole?.admin ?? 0} người
                  </p>
                </div>
              </div>

              {/* Danh sách người dùng gần đây */}
              <div className="flex flex-col gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Tài khoản hoạt động gần đây
                </h4>

                {usersQuery.isPending ? (
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-12 w-full rounded-md" />
                    <Skeleton className="h-12 w-full rounded-md" />
                    <Skeleton className="h-12 w-full rounded-md" />
                  </div>
                ) : (usersQuery.data?.data ?? []).length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-text-secondary">
                    Chưa có danh sách người dùng.
                  </div>
                ) : (
                  <div className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
                    {(usersQuery.data?.data ?? []).map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg-card p-2.5 transition-colors hover:bg-bg-subtle"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-text-primary text-xs sm:text-sm truncate">
                            {user.fullName}
                          </p>
                          <p className="text-[11px] text-text-secondary truncate">{user.email}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[11px] font-medium',
                              user.role === 'admin'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300'
                                : user.role === 'owner'
                                  ? 'bg-primary-100 text-primary-800 dark:bg-primary-950/50 dark:text-primary-300'
                                  : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
                            )}
                          >
                            {user.role === 'admin' ? 'Quản trị' : user.role === 'owner' ? 'Chủ sân' : 'Khách hàng'}
                          </span>
                          <StatusBadge kind="user" status={user.status} size="sm" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="mt-4 gap-2">
              <DialogClose asChild>
                <Button variant="ghost" size="sm">Đóng</Button>
              </DialogClose>
              <Link href="/admin/users">
                <Button variant="outline" size="sm">
                  Quản lý toàn bộ người dùng
                  <ArrowRight className="ml-1 size-3.5" />
                </Button>
              </Link>
            </DialogFooter>
          </>
        )}

        {type === 'venues' && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2.5 text-primary-700 dark:text-primary-400">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-950/60">
                  <Building2 className="size-4.5" />
                </span>
                <DialogTitle>Thống kê Cơ sở thể thao</DialogTitle>
              </div>
              <DialogDescription>
                Tình trạng kiểm duyệt và danh sách cơ sở kinh doanh đăng ký trên sàn.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-2 flex flex-col gap-4">
              {/* 3 Thẻ trạng thái cơ sở */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="rounded-lg border border-primary-200 bg-primary-50/60 p-2.5 sm:p-3 dark:border-primary-900/40 dark:bg-primary-950/30">
                  <span className="text-[11px] font-medium text-text-secondary">Đã duyệt</span>
                  <p className="mt-1 text-sm sm:text-base font-bold tabular-nums text-primary-700 dark:text-primary-300">
                    {stats?.summary?.venueCountsByStatus?.approved ?? 0} cơ sở
                  </p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 sm:p-3 dark:border-amber-900/40 dark:bg-amber-950/30">
                  <span className="text-[11px] font-medium text-text-secondary">Chờ duyệt</span>
                  <p className="mt-1 text-sm sm:text-base font-bold tabular-nums text-amber-700 dark:text-amber-300">
                    {stats?.summary?.venueCountsByStatus?.draft ?? stats?.pendingVenues ?? 0} cơ sở
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-bg-subtle p-2.5 sm:p-3">
                  <span className="text-[11px] font-medium text-text-secondary">Tạm ngưng/Khác</span>
                  <p className="mt-1 text-sm sm:text-base font-bold tabular-nums text-text-secondary">
                    {(stats?.summary?.venueCountsByStatus?.rejected ?? 0) +
                      (stats?.summary?.venueCountsByStatus?.suspended ?? 0)}{' '}
                    cơ sở
                  </p>
                </div>
              </div>

              {/* Danh sách cơ sở thể thao */}
              <div className="flex flex-col gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Danh sách cơ sở trên hệ thống
                </h4>

                {venuesQuery.isPending ? (
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-12 w-full rounded-md" />
                    <Skeleton className="h-12 w-full rounded-md" />
                    <Skeleton className="h-12 w-full rounded-md" />
                  </div>
                ) : (venuesQuery.data?.data ?? []).length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-text-secondary">
                    Chưa có cơ sở thể thao nào.
                  </div>
                ) : (
                  <div className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
                    {(venuesQuery.data?.data ?? []).map((venue) => (
                      <div
                        key={venue.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg-card p-2.5 transition-colors hover:bg-bg-subtle"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-text-primary text-xs sm:text-sm truncate">
                            {venue.name}
                          </p>
                          <p className="text-[11px] text-text-secondary truncate">
                            {venue.district && venue.province
                              ? `${venue.district}, ${venue.province}`
                              : venue.address}
                          </p>
                        </div>
                        <StatusBadge kind="venue" status={venue.status} size="sm" className="shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="mt-4 gap-2">
              <DialogClose asChild>
                <Button variant="ghost" size="sm">Đóng</Button>
              </DialogClose>
              <Link href="/admin/venues">
                <Button variant="outline" size="sm">
                  Quản lý & Duyệt cơ sở
                  <ArrowRight className="ml-1 size-3.5" />
                </Button>
              </Link>
            </DialogFooter>
          </>
        )}

        {type === 'bookings' && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2.5 text-primary-700 dark:text-primary-400">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-950/60">
                  <CalendarCheck className="size-4.5" />
                </span>
                <DialogTitle>Thống kê Lượt đặt sân</DialogTitle>
              </div>
              <DialogDescription>
                Phân loại tình trạng đặt chỗ và các đơn giao dịch gần nhất.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-2 flex flex-col gap-4">
              {/* 4 Thẻ trạng thái đơn */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-lg border border-primary-200 bg-primary-50/60 p-2 sm:p-2.5 dark:border-primary-900/40 dark:bg-primary-950/30">
                  <span className="text-[10px] sm:text-[11px] font-medium text-text-secondary">Hoàn thành</span>
                  <p className="mt-0.5 text-sm sm:text-base font-bold tabular-nums text-primary-700 dark:text-primary-300">
                    {stats?.summary?.bookingCountsByStatus?.completed ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-2 sm:p-2.5 dark:border-blue-900/40 dark:bg-blue-950/30">
                  <span className="text-[10px] sm:text-[11px] font-medium text-text-secondary">Đã thanh toán</span>
                  <p className="mt-0.5 text-sm sm:text-base font-bold tabular-nums text-blue-700 dark:text-blue-300">
                    {stats?.summary?.bookingCountsByStatus?.confirmed ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-2 sm:p-2.5 dark:border-amber-900/40 dark:bg-amber-950/30">
                  <span className="text-[10px] sm:text-[11px] font-medium text-text-secondary">Chờ duyệt / Giữ</span>
                  <p className="mt-0.5 text-sm sm:text-base font-bold tabular-nums text-amber-700 dark:text-amber-300">
                    {(stats?.summary?.bookingCountsByStatus?.pending_payment ?? 0) +
                      (stats?.summary?.bookingCountsByStatus?.held ?? 0)}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-bg-subtle p-2 sm:p-2.5">
                  <span className="text-[10px] sm:text-[11px] font-medium text-text-secondary">Hủy / Hết hạn</span>
                  <p className="mt-0.5 text-sm sm:text-base font-bold tabular-nums text-text-secondary">
                    {(stats?.summary?.bookingCountsByStatus?.cancelled ?? 0) +
                      (stats?.summary?.bookingCountsByStatus?.expired ?? 0) +
                      (stats?.summary?.bookingCountsByStatus?.no_show ?? 0)}
                  </p>
                </div>
              </div>

              {/* Danh sách lượt đặt gần đây */}
              <div className="flex flex-col gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Đơn đặt sân gần đây
                </h4>

                {bookingsQuery.isPending ? (
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-12 w-full rounded-md" />
                    <Skeleton className="h-12 w-full rounded-md" />
                    <Skeleton className="h-12 w-full rounded-md" />
                  </div>
                ) : (bookingsQuery.data?.data ?? []).length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-text-secondary">
                    Chưa có đơn đặt sân nào.
                  </div>
                ) : (
                  <div className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
                    {(bookingsQuery.data?.data ?? []).map((booking) => (
                      <div
                        key={booking.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg-card p-2.5 transition-colors hover:bg-bg-subtle"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-text-primary text-xs sm:text-sm truncate">
                            {booking.courtName} - {booking.venueName}
                          </p>
                          <p className="text-[11px] text-text-secondary truncate">
                            Mã: #{booking.id.slice(0, 8)} • Khách: {booking.customerName}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="font-semibold tabular-nums text-text-primary text-xs">
                            {formatCurrency(booking.totalPrice)}
                          </span>
                          <StatusBadge kind="booking" status={booking.status} size="sm" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="mt-4 gap-2">
              <DialogClose asChild>
                <Button variant="ghost" size="sm">Đóng</Button>
              </DialogClose>
              <Link href="/admin/bookings">
                <Button variant="outline" size="sm">
                  Quản lý tất cả đơn đặt
                  <ArrowRight className="ml-1 size-3.5" />
                </Button>
              </Link>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
