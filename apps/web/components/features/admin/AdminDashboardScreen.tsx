'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  DollarSign,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';
import * as Recharts from 'recharts';

import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminStats } from '@/lib/hooks/useAdminDashboard';
import { RECHARTS_TOOLTIP_PROPS } from '@/lib/utils/chart';
import { cn } from '@/lib/utils/cn';
import { formatCurrency } from '@/lib/utils/format';

const ResponsiveContainer = Recharts.ResponsiveContainer as unknown as React.ComponentType<Record<string, unknown>>;
const AreaChart = Recharts.AreaChart as unknown as React.ComponentType<Record<string, unknown>>;
const Area = Recharts.Area as unknown as React.ComponentType<Record<string, unknown>>;
const LineChart = Recharts.LineChart as unknown as React.ComponentType<Record<string, unknown>>;
const Line = Recharts.Line as unknown as React.ComponentType<Record<string, unknown>>;
const BarChart = Recharts.BarChart as unknown as React.ComponentType<Record<string, unknown>>;
const Bar = Recharts.Bar as unknown as React.ComponentType<Record<string, unknown>>;
const CartesianGrid = Recharts.CartesianGrid as unknown as React.ComponentType<Record<string, unknown>>;
const Tooltip = Recharts.Tooltip as unknown as React.ComponentType<Record<string, unknown>>;
const Legend = Recharts.Legend as unknown as React.ComponentType<Record<string, unknown>>;
const XAxis = Recharts.XAxis as unknown as React.ComponentType<Record<string, unknown>>;
const YAxis = Recharts.YAxis as unknown as React.ComponentType<Record<string, unknown>>;

type RangeKey = '7d' | '30d' | '90d';

const RANGE_OPTIONS: Array<{ key: RangeKey; label: string; days: number }> = [
  { key: '7d', label: '7 ngày', days: 7 },
  { key: '30d', label: '30 ngày', days: 30 },
  { key: '90d', label: '90 ngày', days: 90 },
];

function formatShortDate(isoDate: string): string {
  if (!isoDate || isoDate.length < 10) return isoDate;
  return `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}`;
}

function formatCompactMoney(val: number): string {
  if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)}tỷ`;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}tr`;
  if (val >= 1_000) return `${Math.round(val / 1_000)}k`;
  return String(val);
}

export function AdminDashboardScreen() {
  const t = useTranslations('admin');
  const [range, setRange] = React.useState<RangeKey>('30d');

  const rangeParams = React.useMemo(() => {
    const days = RANGE_OPTIONS.find((opt) => opt.key === range)?.days ?? 30;
    const now = new Date();
    const fromDate = new Date(now.getTime() - (days - 1) * 86_400_000);
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    return {
      from: fmt.format(fromDate),
      to: fmt.format(now),
      groupBy: (range === '90d' ? 'week' : 'day') as 'day' | 'week',
    };
  }, [range]);

  const statsQuery = useAdminStats(rangeParams);
  const stats = statsQuery.data;

  const revenueData = React.useMemo(
    () =>
      (stats?.series ?? []).map((point) => ({
        dateLabel: formatShortDate(point.date),
        revenue: point.netRevenue ?? point.grossRevenue ?? 0,
      })),
    [stats?.series],
  );

  const userGrowthData = React.useMemo(
    () =>
      (stats?.userGrowthSeries ?? []).map((point) => ({
        dateLabel: formatShortDate(point.date),
        owners: point.owners,
        customers: point.customers,
      })),
    [stats?.userGrowthSeries],
  );

  const venueGrowthData = React.useMemo(
    () =>
      (stats?.venueGrowthSeries ?? []).map((point) => ({
        dateLabel: formatShortDate(point.date),
        venues: point.venues,
      })),
    [stats?.venueGrowthSeries],
  );

  const bookingData = React.useMemo(
    () =>
      (stats?.series ?? []).map((point) => ({
        dateLabel: formatShortDate(point.date),
        bookings: Object.values(point.bookingCountsByStatus ?? {}).reduce((sum, n) => sum + n, 0),
      })),
    [stats?.series],
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title={t('dashboard')}
          description="Tổng quan hoạt động và các yêu cầu phê duyệt trên nền tảng BookSportsCourt."
        />

        <div
          className="inline-flex items-center rounded-btn border border-border bg-bg-card p-1"
          role="group"
          aria-label="Khoảng thời gian biểu đồ"
        >
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setRange(opt.key)}
              className={cn(
                'rounded px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                range === opt.key
                  ? 'bg-primary-600 text-white'
                  : 'text-text-secondary hover:bg-bg-subtle hover:text-text-primary',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {statsQuery.isPending ? (
        <div className="mt-6 flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-card" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Skeleton className="h-32 w-full rounded-card" />
            <Skeleton className="h-32 w-full rounded-card" />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-72 w-full rounded-card" />
            ))}
          </div>
        </div>
      ) : statsQuery.isError ? (
        <div className="mt-6">
          <ErrorState
            error={statsQuery.error}
            onRetry={() => void statsQuery.refetch()}
          />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          {/* 4 Thẻ KPI toàn sàn */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label={t('totalRevenue')}
              value={formatCurrency(stats?.totalRevenue ?? 0)}
              icon={DollarSign}
            />
            <StatCard
              label={t('totalUsers')}
              value={`${stats?.totalUsers ?? 0} người`}
              icon={Users}
            />
            <StatCard
              label={t('totalVenues')}
              value={`${stats?.totalVenues ?? 0} cơ sở`}
              icon={Building2}
            />
            <StatCard
              label={t('totalBookings')}
              value={`${stats?.totalBookings ?? 0} lượt`}
              icon={CalendarCheck}
            />
          </div>

          {/* 2 Khối cảnh báo chờ phê duyệt */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card className="flex items-center justify-between border-amber-200 bg-amber-50/60 p-5 dark:border-amber-900/50 dark:bg-amber-950/30">
              <div className="flex items-start gap-3.5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-text-primary">
                    Hồ sơ đăng ký chủ sân chờ duyệt
                  </h4>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    Hiện có <strong>{stats?.pendingOwnerApplications ?? 0}</strong> đối tác đang chờ xác minh thông tin doanh nghiệp.
                  </p>
                </div>
              </div>
              <Link href="/admin/owner-applications">
                <Button size="sm" variant="outline" className="border-amber-300 bg-bg-card hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/60">
                  Xử lý ngay
                  <ArrowRight className="ml-1 size-3.5" />
                </Button>
              </Link>
            </Card>

            <Card className="flex items-center justify-between border-blue-200 bg-blue-50/60 p-5 dark:border-blue-900/50 dark:bg-blue-950/30">
              <div className="flex items-start gap-3.5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                  <Building2 className="size-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-text-primary">
                    Cơ sở thể thao mới chờ kiểm duyệt
                  </h4>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    Hiện có <strong>{stats?.pendingVenues ?? 0}</strong> cơ sở mới tạo đang chờ duyệt địa chỉ & tiện ích.
                  </p>
                </div>
              </div>
              <Link href="/admin/venues">
                <Button size="sm" variant="outline" className="border-blue-300 bg-bg-card hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/60">
                  Xem danh sách
                  <ArrowRight className="ml-1 size-3.5" />
                </Button>
              </Link>
            </Card>
          </div>

          {/* 4 Biểu đồ động toàn hệ thống */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* 1. Doanh thu */}
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-text-primary">Doanh thu toàn sàn</h3>
                  <p className="text-xs text-text-secondary">Doanh thu ròng theo mốc thời gian</p>
                </div>
                <TrendingUp className="size-4 text-primary-600" aria-hidden="true" />
              </div>
              {revenueData.length === 0 ? (
                <div className="flex h-64 items-center justify-center text-xs text-text-secondary">
                  Chưa có dữ liệu doanh thu trong khoảng thời gian đã chọn
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="adminRevGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#16a34a" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="dateLabel" stroke="#94a3b8" fontSize={11} tickLine={false} minTickGap={16} />
                      <YAxis
                        stroke="#94a3b8"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={formatCompactMoney}
                      />
                      <Tooltip
                        {...RECHARTS_TOOLTIP_PROPS}
                        formatter={(val: number) => [formatCurrency(Number(val ?? 0)), 'Doanh thu']}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#16a34a"
                        strokeWidth={2}
                        fill="url(#adminRevGrad)"
                        isAnimationActive
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            {/* 2. Người dùng (2 đường: Chủ sân & Khách hàng) */}
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-text-primary">Tăng trưởng người dùng</h3>
                  <p className="text-xs text-text-secondary">Số lượng tích luỹ phân theo Chủ sân &amp; Khách hàng</p>
                </div>
                <Users className="size-4 text-blue-600" aria-hidden="true" />
              </div>
              {userGrowthData.length === 0 ? (
                <div className="flex h-64 items-center justify-center text-xs text-text-secondary">
                  Chưa có dữ liệu người dùng trong khoảng thời gian đã chọn
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={userGrowthData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="dateLabel" stroke="#94a3b8" fontSize={11} tickLine={false} minTickGap={16} />
                      <YAxis
                        stroke="#94a3b8"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        {...RECHARTS_TOOLTIP_PROPS}
                        formatter={(val: number, name: string) => [
                          `${val} tài khoản`,
                          name === 'owners' ? 'Chủ sân' : 'Khách hàng',
                        ]}
                      />
                      <Legend
                        formatter={(val: string) => (val === 'owners' ? 'Chủ sân' : 'Khách hàng')}
                      />
                      <Line
                        type="monotone"
                        dataKey="customers"
                        name="customers"
                        stroke="#2563eb"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                        isAnimationActive
                      />
                      <Line
                        type="monotone"
                        dataKey="owners"
                        name="owners"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                        isAnimationActive
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            {/* 3. Cơ sở */}
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-text-primary">Phát triển cơ sở thể thao</h3>
                  <p className="text-xs text-text-secondary">Tổng số cơ sở tích luỹ theo thời gian</p>
                </div>
                <Building2 className="size-4 text-emerald-600" aria-hidden="true" />
              </div>
              {venueGrowthData.length === 0 ? (
                <div className="flex h-64 items-center justify-center text-xs text-text-secondary">
                  Chưa có dữ liệu cơ sở trong khoảng thời gian đã chọn
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={venueGrowthData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="adminVenueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="dateLabel" stroke="#94a3b8" fontSize={11} tickLine={false} minTickGap={16} />
                      <YAxis
                        stroke="#94a3b8"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        {...RECHARTS_TOOLTIP_PROPS}
                        formatter={(val: number) => [`${val} cơ sở`, 'Tổng cơ sở']}
                      />
                      <Area
                        type="monotone"
                        dataKey="venues"
                        stroke="#0ea5e9"
                        strokeWidth={2}
                        fill="url(#adminVenueGrad)"
                        isAnimationActive
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            {/* 4. Lượt đặt */}
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-text-primary">Lượt đặt sân</h3>
                  <p className="text-xs text-text-secondary">Số đơn đặt sân phát sinh theo kỳ</p>
                </div>
                <CalendarCheck className="size-4 text-violet-600" aria-hidden="true" />
              </div>
              {bookingData.length === 0 ? (
                <div className="flex h-64 items-center justify-center text-xs text-text-secondary">
                  Chưa có dữ liệu lượt đặt trong khoảng thời gian đã chọn
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bookingData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="dateLabel" stroke="#94a3b8" fontSize={11} tickLine={false} minTickGap={16} />
                      <YAxis
                        stroke="#94a3b8"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        {...RECHARTS_TOOLTIP_PROPS}
                        formatter={(val: number) => [`${val} lượt`, 'Lượt đặt']}
                      />
                      <Bar
                        dataKey="bookings"
                        fill="#8b5cf6"
                        radius={[4, 4, 0, 0]}
                        isAnimationActive
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
