'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  ArrowRight,
  Building2,
  Calendar,
  Clock,
  CreditCard,
  CircleDollarSign,
  TrendingUp,
} from 'lucide-react';

import { useRevenueStats } from '@/lib/hooks/useRevenueStats';
import { useOccupancyStats } from '@/lib/hooks/useOccupancyStats';
import { useOwnerPayments } from '@/lib/hooks/useOwnerPayments';
import { useOwnerBookings } from '@/lib/hooks/useOwnerBookings';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import type { OwnerBookingItem } from '@/lib/api/endpoints/owner';
import { formatCurrency, formatDateTimeRangeInVietnam } from '@/lib/utils/format';

function formatBookingSlot(startStr: string, endStr: string) {
  return formatDateTimeRangeInVietnam(startStr, endStr);
}

function formatShortId(id: string): string {
  return `${id.slice(0, 8)}…`;
}

export function OwnerDashboardScreen() {
  const t = useTranslations('owner');

  const statsQuery = useRevenueStats(7);
  const occupancyQuery = useOccupancyStats(7);
  const paymentsQuery = useOwnerPayments();
  const bookingsQuery = useOwnerBookings({ limit: 5 });

  const stats = statsQuery.data?.summary;
  const occupancy = occupancyQuery.data?.summary.occupancyRate;
  const pendingCount = paymentsQuery.data?.meta?.total ?? paymentsQuery.data?.data?.length ?? 0;
  const recentBookings: OwnerBookingItem[] = bookingsQuery.data?.data ?? [];

  const isLoading =
    statsQuery.isLoading ||
    occupancyQuery.isLoading ||
    paymentsQuery.isLoading ||
    bookingsQuery.isLoading;
  const isError =
    statsQuery.isError ||
    occupancyQuery.isError ||
    paymentsQuery.isError ||
    bookingsQuery.isError;

  const handleRetryAll = () => {
    void statsQuery.refetch();
    void occupancyQuery.refetch();
    void paymentsQuery.refetch();
    void bookingsQuery.refetch();
  };

  return (
    <div className="w-full min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">
      {/* 1. Header trang */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
          {t('overviewTitle')}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {t('overviewSubtitle')}
        </p>
      </div>

      {isError ? (
        <ErrorState
          error={
            statsQuery.error ??
            occupancyQuery.error ??
            paymentsQuery.error ??
            bookingsQuery.error
          }
          onRetry={handleRetryAll}
        />
      ) : (
        <>
          {/* 2. Bốn thẻ chỉ số (KPIs) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Doanh thu 7 ngày */}
            <Card className="rounded-lg border border-neutral-200 bg-white p-5 shadow-none transition-shadow hover:shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-600">
                  {t('revenue7Days')}
                </span>
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                  <CircleDollarSign className="size-4" strokeWidth={2} />
                </div>
              </div>
              {isLoading ? (
                <Skeleton className="mt-3 h-8 w-28" />
              ) : (
                <div className="mt-2 text-2xl font-bold tabular-nums text-neutral-900">
                  {formatCurrency(stats?.totalRevenue ?? 0)}
                </div>
              )}
            </Card>

            {/* Card 2: Chờ duyệt tiền */}
            <Card className="rounded-lg border border-neutral-200 bg-white p-5 shadow-none transition-shadow hover:shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-600">
                  {t('pendingPayments')}
                </span>
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                  <CreditCard className="size-4" strokeWidth={1.75} />
                </div>
              </div>
              {isLoading ? (
                <Skeleton className="mt-3 h-8 w-24" />
              ) : (
                <div className="mt-2 text-2xl font-bold tabular-nums text-neutral-900">
                  {t('unitOrders', { count: pendingCount })}
                </div>
              )}
            </Card>

            {/* Card 3: Lượt đặt 7 ngày */}
            <Card className="rounded-lg border border-neutral-200 bg-white p-5 shadow-none transition-shadow hover:shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-600">
                  {t('bookings7Days')}
                </span>
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                  <Calendar className="size-4" strokeWidth={1.75} />
                </div>
              </div>
              {isLoading ? (
                <Skeleton className="mt-3 h-8 w-24" />
              ) : (
                <div className="mt-2 text-2xl font-bold tabular-nums text-neutral-900">
                  {t('unitBookings', { count: stats?.totalBookings ?? 0 })}
                </div>
              )}
            </Card>

            {/* Card 4: Tỷ lệ lấp đầy */}
            <Card className="rounded-lg border border-neutral-200 bg-white p-5 shadow-none transition-shadow hover:shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-600">
                  {t('occupancyRate')}
                </span>
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                  <TrendingUp className="size-4" strokeWidth={2} />
                </div>
              </div>
              {isLoading ? (
                <Skeleton className="mt-3 h-8 w-20" />
              ) : (
                <div className="mt-2 text-2xl font-bold tabular-nums text-neutral-900">
                  {Math.round((occupancy ?? 0) * 100)}%
                </div>
              )}
            </Card>
          </div>

          {/* 3. LỐI TẮT CHỨC NĂNG */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              {t('shortcutsTitle')}
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
              {/* Shortcut 1: Lịch sân ngày */}
              <Link href="/owner/timeline" className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600">
                <Card className="flex flex-col items-center justify-center border border-neutral-200 p-5 text-center transition-shadow hover:border-primary-300 hover:shadow-sm">
                  <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary-50 text-primary-700 transition-colors group-hover:bg-primary-100">
                    <Calendar className="size-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-neutral-900 group-hover:text-primary-700">
                    {t('shortcutTimelineTitle')}
                  </h3>
                  <p className="mt-1 text-xs text-neutral-500">
                    {t('shortcutTimelineSubtitle')}
                  </p>
                </Card>
              </Link>

              {/* Shortcut 2: Duyệt thanh toán */}
              <Link href="/owner/payments" className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600">
                <Card className="flex flex-col items-center justify-center border border-neutral-200 p-5 text-center transition-shadow hover:border-warning hover:shadow-sm">
                  <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-warning/10 text-warning transition-colors group-hover:bg-warning/20">
                    <CreditCard className="size-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-neutral-900 group-hover:text-warning">
                    {t('shortcutPaymentsTitle')}
                  </h3>
                  <p className="mt-1 text-xs text-neutral-500">
                    {t('shortcutPaymentsSubtitle', { count: pendingCount })}
                  </p>
                </Card>
              </Link>

              {/* Shortcut 3: Cơ sở & Sân con */}
              <Link href="/owner/venues" className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600">
                <Card className="flex flex-col items-center justify-center border border-neutral-200 p-5 text-center transition-shadow hover:border-primary-300 hover:shadow-sm">
                  <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary-50 text-primary-700 transition-colors group-hover:bg-primary-100">
                    <Building2 className="size-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-neutral-900 group-hover:text-primary-700">
                    {t('shortcutVenuesTitle')}
                  </h3>
                  <p className="mt-1 text-xs text-neutral-500">
                    {t('shortcutVenuesSubtitle')}
                  </p>
                </Card>
              </Link>

              {/* Shortcut 4: Giờ mở & Bảng giá */}
              <Link href="/owner/pricing" className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600">
                <Card className="flex flex-col items-center justify-center border border-neutral-200 p-5 text-center transition-shadow hover:border-primary-300 hover:shadow-sm">
                  <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary-50 text-primary-700 transition-colors group-hover:bg-primary-100">
                    <Clock className="size-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-neutral-900 group-hover:text-primary-700">
                    {t('shortcutPricingTitle')}
                  </h3>
                  <p className="mt-1 text-xs text-neutral-500">
                    {t('shortcutPricingSubtitle')}
                  </p>
                </Card>
              </Link>

              {/* Shortcut 5: Báo cáo doanh thu */}
              <Link href="/owner/revenue" className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600">
                <Card className="flex flex-col items-center justify-center border border-neutral-200 p-5 text-center transition-shadow hover:border-primary-300 hover:shadow-sm">
                  <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary-50 text-primary-700 transition-colors group-hover:bg-primary-100">
                    <TrendingUp className="size-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-neutral-900 group-hover:text-primary-700">
                    {t('shortcutRevenueTitle')}
                  </h3>
                  <p className="mt-1 text-xs text-neutral-500">
                    {t('shortcutRevenueSubtitle')}
                  </p>
                </Card>
              </Link>
            </div>
          </div>

          {/* 4. ĐƠN ĐẶT SÂN GẦN ĐÂY */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                {t('recentBookingsTitle')}
              </h2>
              <Link
                href="/owner/bookings"
                className="inline-flex items-center gap-1 rounded text-xs font-medium text-primary-700 transition-colors hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
              >
                <span>{t('viewAll')}</span>
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            <Card className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-none">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50/50 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                      <th className="px-4 py-3.5 font-semibold text-left">{t('colBookingCode')}</th>
                      <th className="px-4 py-3.5 font-semibold text-left">{t('colCustomer')}</th>
                      <th className="px-4 py-3.5 font-semibold text-left">{t('colCourt')}</th>
                      <th className="px-4 py-3.5 font-semibold text-left">{t('colTimeRange')}</th>
                      <th className="px-4 py-3.5 font-semibold text-right pr-8">{t('colTotalPrice')}</th>
                      <th className="px-4 py-3.5 font-semibold text-right pr-6">{t('colStatus')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {isLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td className="px-4 py-3.5"><Skeleton className="h-4 w-20" /></td>
                          <td className="px-4 py-3.5">
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="mt-1 h-3 w-20" />
                          </td>
                          <td className="px-4 py-3.5"><Skeleton className="h-4 w-32" /></td>
                          <td className="px-4 py-3.5"><Skeleton className="h-4 w-36" /></td>
                          <td className="px-4 py-3.5 text-right pr-8"><Skeleton className="ml-auto h-4 w-16" /></td>
                          <td className="px-4 py-3.5 text-right pr-6"><Skeleton className="ml-auto h-5 w-20 rounded-full" /></td>
                        </tr>
                      ))
                    ) : recentBookings.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12">
                          <EmptyState
                            icon={Calendar}
                            title={t('noRecentBookings')}
                            description={t('noRecentBookingsDesc')}
                            action={
                              <Link
                                href="/owner/timeline"
                                className="inline-flex min-h-11 items-center rounded-btn border border-neutral-300 px-4 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                              >
                                {t('shortcutTimelineTitle')}
                              </Link>
                            }
                          />
                        </td>
                      </tr>
                    ) : (
                      recentBookings.map((b) => (
                        <tr
                          key={b.id}
                          className="hover:bg-neutral-50/60 transition-colors"
                        >
                          <td className="px-4 py-3.5 font-mono text-xs text-neutral-600 whitespace-nowrap">
                            <Link href="/owner/bookings" className="hover:text-primary-700 hover:underline">
                              {formatShortId(b.id)}
                            </Link>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="font-medium text-neutral-900 text-sm">
                              {b.customerName || b.guestName || t('walkInCustomer')}
                            </div>
                            {b.customerPhone && (
                              <div className="text-xs text-neutral-500 mt-0.5">
                                {b.customerPhone}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-sm font-medium text-neutral-800 whitespace-nowrap">
                            {b.courtName}
                          </td>
                          <td className="px-4 py-3.5 text-sm text-neutral-600 tabular-nums whitespace-nowrap">
                            {formatBookingSlot(b.during.start, b.during.end)}
                          </td>
                          <td className="px-4 py-3.5 text-sm font-semibold tabular-nums text-neutral-900 text-right pr-8 whitespace-nowrap">
                            {formatCurrency(b.totalPrice)}
                          </td>
                          <td className="px-4 py-3.5 text-right pr-6 whitespace-nowrap">
                            <StatusBadge kind="booking" status={b.status} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
