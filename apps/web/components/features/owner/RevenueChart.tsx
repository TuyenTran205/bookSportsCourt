'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import * as Recharts from 'recharts';
import { ChartNoAxesCombined } from 'lucide-react';

import { useRevenueStats } from '@/lib/hooks/useRevenueStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { formatCurrency, formatShortDate } from '@/lib/utils/format';
import type { RevenuePoint } from '@bsc/shared';

const ResponsiveContainer = Recharts.ResponsiveContainer as unknown as React.ComponentType<Record<string, unknown>>;
const LineChart = Recharts.LineChart as unknown as React.ComponentType<Record<string, unknown>>;
const Line = Recharts.Line as unknown as React.ComponentType<Record<string, unknown>>;
const CartesianGrid = Recharts.CartesianGrid as unknown as React.ComponentType<Record<string, unknown>>;
const Tooltip = Recharts.Tooltip as unknown as React.ComponentType<Record<string, unknown>>;
const Legend = Recharts.Legend as unknown as React.ComponentType<Record<string, unknown>>;
const XAxis = Recharts.XAxis as unknown as React.ComponentType<Record<string, unknown>>;
const YAxis = Recharts.YAxis as unknown as React.ComponentType<Record<string, unknown>>;

export function RevenueChart() {
  const t = useTranslations('owner');
  const { data, isLoading, isError, error, refetch } = useRevenueStats();

  if (isLoading) {
    return (
      <div className="h-64 space-y-3 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-44 w-full" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  }

  if (!data || data.summary.totalBookings === 0 || data.series.length === 0) {
    return (
      <EmptyState
        icon={ChartNoAxesCombined}
        title={t('noData')}
        description={t('noRevenueDataDesc')}
        action={
          <Button asChild variant="outline">
            <Link href="/owner/bookings">{t('bookings')}</Link>
          </Button>
        }
      />
    );
  }

  const chartData = data.series.map((point: RevenuePoint) => ({
    date: formatShortDate(point.date),
    revenue: point.revenue,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('revenue')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 25 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-neutral-100)" />
              <XAxis
                dataKey="date"
                stroke="var(--color-neutral-400)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="var(--color-neutral-400)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number) => formatCurrency(value)}
              />
              <Tooltip
                formatter={(val: number) => [formatCurrency(val), t('revenue')]}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                name={t('revenue')}
                stroke="var(--color-primary-600)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}