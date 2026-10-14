'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  CalendarCheck,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const AreaChartComp = AreaChart as unknown as React.ComponentType<Record<string, unknown>>;
const AreaComp = Area as unknown as React.ComponentType<Record<string, unknown>>;
const BarChartComp = BarChart as unknown as React.ComponentType<Record<string, unknown>>;
const BarComp = Bar as unknown as React.ComponentType<Record<string, unknown>>;
const CartesianGridComp = CartesianGrid as unknown as React.ComponentType<Record<string, unknown>>;
const ResponsiveContainerComp = ResponsiveContainer as unknown as React.ComponentType<Record<string, unknown>>;
const TooltipComp = Tooltip as unknown as React.ComponentType<Record<string, unknown>>;
const XAxisComp = XAxis as unknown as React.ComponentType<Record<string, unknown>>;
const YAxisComp = YAxis as unknown as React.ComponentType<Record<string, unknown>>;

import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Card } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useOwnerRevenue } from '@/lib/hooks/useOwnerRevenue';
import { formatCurrency, formatDate } from '@/lib/utils/format';

export function OwnerRevenueScreen() {
  const t = useTranslations('owner');

  const [days, setDays] = React.useState<number>(30);
  const revenueQuery = useOwnerRevenue(days);

  const data = revenueQuery.data;
  const summary = data?.summary;
  const series = data?.series ?? data?.points ?? [];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader title={t('revenueTitle')} description={t('revenueDesc')} />

        <div className="w-full sm:w-48">
          <NativeSelect
            value={String(days)}
            onChange={(e) => setDays(Number(e.target.value))}
            className="h-10 text-sm font-medium"
          >
            <option value="7">7 ngày qua</option>
            <option value="30">30 ngày qua</option>
            <option value="90">90 ngày qua</option>
          </NativeSelect>
        </div>
      </div>

      {revenueQuery.isPending ? (
        <div className="mt-6 flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-card" />
            ))}
          </div>
          <Skeleton className="h-80 w-full rounded-card" />
          <Skeleton className="h-64 w-full rounded-card" />
        </div>
      ) : revenueQuery.isError ? (
        <div className="mt-6">
          <ErrorState
            error={revenueQuery.error}
            onRetry={() => void revenueQuery.refetch()}
          />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          {/* Thẻ chỉ số KPI */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label={t('totalRevenue')}
              value={formatCurrency(summary?.totalRevenue ?? 0)}
              icon={DollarSign}
            />
            <StatCard
              label={t('totalBookingsCount')}
              value={`${summary?.totalBookings ?? 0} lượt`}
              icon={CalendarCheck}
            />
            <StatCard
              label={t('occupancyRate')}
              value={`${Math.round((summary?.occupancyRate ?? 0) * 100)}%`}
              icon={TrendingUp}
            />
          </div>

          {/* Biểu đồ Doanh thu (Area Chart) */}
          <Card className="p-5">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-neutral-900">
                Biểu đồ doanh thu theo ngày
              </h3>
              <p className="text-xs text-neutral-500">
                Xu hướng doanh thu các ngày trong khoảng thời gian đã chọn
              </p>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainerComp width="100%" height="100%">
                <AreaChartComp data={series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGridComp strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxisComp
                    dataKey="date"
                    tickFormatter={(val: string) => {
                      const parts = val.split('-');
                      return `${parts[2]}/${parts[1]}`;
                    }}
                    stroke="#94a3b8"
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxisComp
                    tickFormatter={(val: number) => {
                      if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
                      if (val >= 1_000) return `${(val / 1_000).toFixed(0)}k`;
                      return String(val);
                    }}
                    stroke="#94a3b8"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <TooltipComp
                    formatter={(val: number) => [formatCurrency(val), 'Doanh thu']}
                    labelFormatter={(label: string) => `Ngày ${formatDate(label)}`}
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#e2e8f0',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <AreaComp
                    type="monotone"
                    dataKey="revenue"
                    stroke="#16a34a"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#revenueGradient)"
                  />
                </AreaChartComp>
              </ResponsiveContainerComp>
            </div>
          </Card>

          {/* Biểu đồ Số lượt đặt sân (Bar Chart) */}
          <Card className="p-5">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-neutral-900">
                Số lượt đặt sân theo ngày
              </h3>
              <p className="text-xs text-neutral-500">
                Số lượng giao dịch đặt sân thành công mỗi ngày
              </p>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainerComp width="100%" height="100%">
                <BarChartComp data={series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGridComp strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxisComp
                    dataKey="date"
                    tickFormatter={(val: string) => {
                      const parts = val.split('-');
                      return `${parts[2]}/${parts[1]}`;
                    }}
                    stroke="#94a3b8"
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxisComp
                    stroke="#94a3b8"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <TooltipComp
                    formatter={(val: number) => [`${val} lượt`, 'Lượt đặt']}
                    labelFormatter={(label: string) => `Ngày ${formatDate(label)}`}
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#e2e8f0',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <BarComp dataKey="bookings" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChartComp>
              </ResponsiveContainerComp>
            </div>
          </Card>

          {/* Bảng chi tiết */}
          <Card className="p-5">
            <h3 className="mb-3 text-base font-semibold text-neutral-900">
              Chi tiết doanh thu theo ngày
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-xs font-semibold uppercase text-neutral-500">
                    <th className="py-3 pr-4">Ngày</th>
                    <th className="py-3 px-4 text-center">Số lượt đặt</th>
                    <th className="py-3 pl-4 text-right">Doanh thu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {series
                    .slice()
                    .reverse()
                    .map((point) => (
                      <tr key={point.date} className="hover:bg-neutral-50/50">
                        <td className="py-3 pr-4 font-medium text-neutral-900">
                          {formatDate(point.date)}
                        </td>
                        <td className="py-3 px-4 text-center text-neutral-600">
                          {point.bookings} lượt
                        </td>
                        <td className="py-3 pl-4 text-right font-semibold tabular-nums text-neutral-900">
                          {formatCurrency(point.revenue)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
