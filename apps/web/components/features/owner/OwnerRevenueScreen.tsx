'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import * as Recharts from 'recharts';
import { CalendarDays, ChartNoAxesCombined, Clock3, DollarSign, TrendingUp } from 'lucide-react';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { StatCard } from '@/components/common/StatCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { listOwnerVenues } from '@/lib/api/endpoints/owner';
import { useOccupancyStats } from '@/lib/hooks/useOccupancyStats';
import { useRevenueStats } from '@/lib/hooks/useRevenueStats';
import { formatCurrency, formatNumber, formatPercent, formatShortDate } from '@/lib/utils/format';

const ResponsiveContainer = Recharts.ResponsiveContainer as unknown as React.ComponentType<Record<string, unknown>>;
const LineChart = Recharts.LineChart as unknown as React.ComponentType<Record<string, unknown>>;
const Line = Recharts.Line as unknown as React.ComponentType<Record<string, unknown>>;
const BarChart = Recharts.BarChart as unknown as React.ComponentType<Record<string, unknown>>;
const Bar = Recharts.Bar as unknown as React.ComponentType<Record<string, unknown>>;
const CartesianGrid = Recharts.CartesianGrid as unknown as React.ComponentType<Record<string, unknown>>;
const Tooltip = Recharts.Tooltip as unknown as React.ComponentType<Record<string, unknown>>;
const XAxis = Recharts.XAxis as unknown as React.ComponentType<Record<string, unknown>>;
const YAxis = Recharts.YAxis as unknown as React.ComponentType<Record<string, unknown>>;

const PERIODS = [7, 30, 90] as const;
type PeriodDays = (typeof PERIODS)[number];
type GroupBy = 'day' | 'week' | 'month';

export function OwnerRevenueScreen() {
  const t = useTranslations('owner');
  const [periodDays, setPeriodDays] = React.useState<PeriodDays>(30);
  const [groupBy, setGroupBy] = React.useState<GroupBy>('day');
  const [venueId, setVenueId] = React.useState('');
  const [courtId, setCourtId] = React.useState('');

  const venuesQuery = useQuery({
    queryKey: ['owner', 'venues'],
    queryFn: listOwnerVenues,
    staleTime: 30_000,
  });
  const venues = venuesQuery.data ?? [];
  const selectedVenue = venues.find((venue) => venue.id === venueId);
  const filters = React.useMemo(
    () => ({ venueId: venueId || undefined, courtId: courtId || undefined, groupBy }),
    [courtId, groupBy, venueId],
  );
  const revenueQuery = useRevenueStats(periodDays, filters);
  const occupancyQuery = useOccupancyStats(periodDays, filters);
  const revenue = revenueQuery.data;
  const occupancy = occupancyQuery.data;

  const reportError = revenueQuery.error ?? occupancyQuery.error;
  const reportHasError = revenueQuery.isError || occupancyQuery.isError;
  const isReportLoading = revenueQuery.isLoading || occupancyQuery.isLoading;

  const retryReports = () => {
    void revenueQuery.refetch();
    void occupancyQuery.refetch();
  };

  const revenueChartData = (revenue?.series ?? []).map((point) => ({
    date: formatShortDate(point.date),
    revenue: point.revenue,
  }));
  const bookingChartData = (revenue?.series ?? []).map((point) => ({
    date: formatShortDate(point.date),
    bookings: point.bookings,
  }));
  const occupancyChartData = (occupancy?.series ?? []).map((point) => ({
    date: formatShortDate(point.date),
    occupancyRate: point.occupancyRate * 100,
  }));

  return (
    <main className="w-full min-w-0 space-y-5 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            {t('revenueTitle')}
          </h1>
          <p className="mt-1 text-sm text-neutral-600">{t('revenueDesc')}</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:flex xl:items-end">
          <label className="space-y-1">
            <span className="text-xs font-medium text-neutral-600">{t('reportPeriod')}</span>
            <NativeSelect
              value={periodDays}
              onChange={(event) => setPeriodDays(Number(event.target.value) as PeriodDays)}
              aria-label={t('reportPeriod')}
              className="min-w-40"
            >
              {PERIODS.map((days) => (
                <option key={days} value={days}>{t(`range${days}Days`)}</option>
              ))}
            </NativeSelect>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-neutral-600">{t('reportGroupBy')}</span>
            <NativeSelect
              value={groupBy}
              onChange={(event) => setGroupBy(event.target.value as GroupBy)}
              aria-label={t('reportGroupBy')}
            >
              <option value="day">{t('groupByDay')}</option>
              <option value="week">{t('groupByWeek')}</option>
              <option value="month">{t('groupByMonth')}</option>
            </NativeSelect>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-neutral-600">{t('reportVenue')}</span>
            <NativeSelect
              value={venueId}
              onChange={(event) => {
                setVenueId(event.target.value);
                setCourtId('');
              }}
              aria-label={t('reportVenue')}
              disabled={venuesQuery.isLoading || venuesQuery.isError}
              className="sm:min-w-48"
            >
              <option value="">{t('allVenues')}</option>
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>{venue.name}</option>
              ))}
            </NativeSelect>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-neutral-600">{t('reportCourt')}</span>
            <NativeSelect
              value={courtId}
              onChange={(event) => setCourtId(event.target.value)}
              aria-label={t('reportCourt')}
              disabled={!selectedVenue || selectedVenue.courts.length === 0}
              className="sm:min-w-40"
            >
              <option value="">{t('allCourts')}</option>
              {selectedVenue?.courts.map((court) => (
                <option key={court.id} value={court.id}>{court.name}</option>
              ))}
            </NativeSelect>
          </label>
        </div>
      </header>

      {venuesQuery.isError && (
        <ErrorState error={venuesQuery.error} onRetry={() => void venuesQuery.refetch()} />
      )}

      {reportHasError ? (
        <ErrorState error={reportError} onRetry={retryReports} />
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label={t('reportSummary')}>
            <StatCard
              label={t('totalRevenue')}
              value={formatCurrency(revenue?.summary.totalRevenue ?? 0)}
              icon={DollarSign}
              loading={isReportLoading}
            />
            <StatCard
              label={t('totalBookingsCount')}
              value={t('unitBookings', { count: revenue?.summary.totalBookings ?? 0 })}
              icon={CalendarDays}
              loading={isReportLoading}
            />
            <StatCard
              label={t('occupancyRate')}
              value={formatPercent(occupancy?.summary.occupancyRate ?? 0)}
              icon={TrendingUp}
              loading={isReportLoading}
            />
          </section>

          <ReportChartCard
            title={t('chartRevenue')}
            loading={isReportLoading}
            hasData={revenueChartData.length > 0}
            emptyTitle={t('noData')}
            emptyDescription={t('noRevenueDataDesc')}
            emptyActionLabel={t('bookings')}
            emptyHref="/owner/bookings"
            icon={ChartNoAxesCombined}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueChartData} margin={{ top: 10, right: 12, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-neutral-100)" />
                <XAxis
                  dataKey="date"
                  stroke="var(--color-neutral-400)"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                  fontSize={11}
                />
                <YAxis
                  stroke="var(--color-neutral-400)"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  tickFormatter={(value: number) => formatCurrency(value)}
                  width={84}
                />
                <Tooltip formatter={(value: number) => [formatCurrency(value), t('totalRevenue')]} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  name={t('totalRevenue')}
                  stroke="var(--color-primary-600)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ReportChartCard>

          <ReportChartCard
            title={t('chartBookings')}
            loading={isReportLoading}
            hasData={bookingChartData.length > 0}
            emptyTitle={t('noData')}
            emptyDescription={t('noRevenueDataDesc')}
            emptyActionLabel={t('bookings')}
            emptyHref="/owner/bookings"
            icon={CalendarDays}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bookingChartData} margin={{ top: 10, right: 12, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-neutral-100)" />
                <XAxis
                  dataKey="date"
                  stroke="var(--color-neutral-400)"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                  fontSize={11}
                />
                <YAxis
                  stroke="var(--color-neutral-400)"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  allowDecimals={false}
                  width={36}
                />
                <Tooltip formatter={(value: number) => [t('unitBookings', { count: value }), t('chartBookings')]} />
                <Bar dataKey="bookings" name={t('chartBookings')} fill="var(--color-primary-600)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ReportChartCard>

          <ReportChartCard
            title={t('chartOccupancy')}
            loading={isReportLoading}
            hasData={occupancyChartData.length > 0}
            emptyTitle={t('noData')}
            emptyDescription={t('noOccupancyDataDesc')}
            emptyActionLabel={t('shortcutTimelineTitle')}
            emptyHref="/owner/timeline"
            icon={TrendingUp}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={occupancyChartData} margin={{ top: 10, right: 12, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-neutral-100)" />
                <XAxis
                  dataKey="date"
                  stroke="var(--color-neutral-400)"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                  fontSize={11}
                />
                <YAxis
                  stroke="var(--color-neutral-400)"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  domain={[0, 100]}
                  tickFormatter={(value: number) => `${value}%`}
                  width={40}
                />
                <Tooltip formatter={(value: number) => [`${Math.round(value)}%`, t('occupancyRate')]} />
                <Line
                  type="monotone"
                  dataKey="occupancyRate"
                  name={t('occupancyRate')}
                  stroke="var(--color-primary-600)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ReportChartCard>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock3 className="size-4 text-primary-700" aria-hidden="true" />
                {t('peakHoursTitle')}
              </CardTitle>
              <p className="text-sm text-neutral-600">{t('peakHoursDescription')}</p>
            </CardHeader>
            <CardContent>
              {isReportLoading ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-16" />)}
                </div>
              ) : occupancy?.summary.peakHours.length ? (
                <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {occupancy.summary.peakHours.map((peak, index) => (
                    <li
                      key={`${peak.startTime}-${peak.endTime}`}
                      className="flex items-center justify-between gap-3 rounded-card border border-neutral-200 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700">
                          {index + 1}
                        </span>
                        <span className="font-medium tabular-nums text-neutral-800">
                          {peak.startTime}–{peak.endTime}
                        </span>
                      </div>
                      <span className="text-sm tabular-nums text-neutral-600">
                        {t('peakHourSlots', { count: peak.bookedSlots })}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="rounded-card border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-600">
                  {t('noPeakHours')}
                </p>
              )}
              {occupancy && (
                <p className="mt-3 text-xs text-neutral-500">
                  {t('reportCapacitySummary', {
                    booked: formatNumber(occupancy.summary.bookedSlots),
                    available: formatNumber(occupancy.summary.availableSlots),
                  })}
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}

interface ReportChartCardProps {
  title: string;
  loading: boolean;
  hasData: boolean;
  emptyTitle: string;
  emptyDescription: string;
  emptyActionLabel: string;
  emptyHref: string;
  icon: typeof ChartNoAxesCombined;
  children: React.ReactNode;
}

function ReportChartCard({
  title,
  loading,
  hasData,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  emptyHref,
  icon,
  children,
}: ReportChartCardProps) {
  const t = useTranslations('owner');

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-xs text-neutral-500">{t('chartRangeHint')}</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4" aria-label={t('loadingReportChart')}>
            <Skeleton className="h-56 w-full" />
            <div className="flex justify-between">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-3 w-10" />
            </div>
          </div>
        ) : hasData ? (
          <div className="h-56 min-w-0 w-full" role="img" aria-label={title}>
            {children}
          </div>
        ) : (
          <EmptyState
            icon={icon}
            title={emptyTitle}
            description={emptyDescription}
            action={
              <Button asChild variant="outline" size="sm">
                <Link href={emptyHref}>{emptyActionLabel}</Link>
              </Button>
            }
          />
        )}
      </CardContent>
    </Card>
  );
}
