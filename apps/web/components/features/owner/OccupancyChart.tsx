'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import * as Recharts from 'recharts';
import { ChartNoAxesColumnIncreasing } from 'lucide-react';

import { useOccupancyStats } from '@/lib/hooks/useOccupancyStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { formatPercent, formatShortDate } from '@/lib/utils/format';

const ResponsiveContainer = Recharts.ResponsiveContainer as unknown as React.ComponentType<Record<string, unknown>>;
const BarChart = Recharts.BarChart as unknown as React.ComponentType<Record<string, unknown>>;
const Bar = Recharts.Bar as unknown as React.ComponentType<Record<string, unknown>>;
const CartesianGrid = Recharts.CartesianGrid as unknown as React.ComponentType<Record<string, unknown>>;
const Tooltip = Recharts.Tooltip as unknown as React.ComponentType<Record<string, unknown>>;
const Legend = Recharts.Legend as unknown as React.ComponentType<Record<string, unknown>>;
const XAxis = Recharts.XAxis as unknown as React.ComponentType<Record<string, unknown>>;
const YAxis = Recharts.YAxis as unknown as React.ComponentType<Record<string, unknown>>;

export function OccupancyChart() {
  const t = useTranslations('owner');
  const { data, isLoading, isError, error, refetch } = useOccupancyStats();

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

  if (!data || data.summary.bookedSlots === 0 || data.series.length === 0) {
    return (
      <EmptyState
        icon={ChartNoAxesColumnIncreasing}
        title={t('noData')}
        description={t('noOccupancyDataDesc')}
        action={
          <Button asChild variant="outline">
            <Link href="/owner/timeline">{t('shortcutTimelineTitle')}</Link>
          </Button>
        }
      />
    );
  }

  const chartData = data.series.map((point) => ({
    date: formatShortDate(point.date),
    occupancyRate: point.occupancyRate * 100,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('occupancyRate')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full" role="img" aria-label={t('occupancyChartAria')}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
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
                domain={[0, 100]}
                tickFormatter={(value: number) => `${value}%`}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(val: number) => [formatPercent(val / 100), t('occupancyRate')]}
              />
              <Legend />
              <Bar dataKey="occupancyRate" name={t('occupancyRate')} fill="var(--color-primary-600)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}