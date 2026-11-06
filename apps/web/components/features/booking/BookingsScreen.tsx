'use client';

import * as React from 'react';
import Link from 'next/link';
import { Calendar, ChevronRight, Compass } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { BookingStatus } from '@bsc/shared';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMyBookings } from '@/lib/hooks/useBookings';
import { formatCurrency, formatDateWithWeekday, formatTimeRange } from '@/lib/utils/format';

type Filter = 'all' | BookingStatus;

const FILTERS: Filter[] = ['all', 'held', 'pending_payment', 'confirmed', 'completed', 'cancelled'];

/** BookingsScreen – CUS-10: danh sách đơn của tôi, lọc theo trạng thái. */
export function BookingsScreen() {
  const t = useTranslations('booking');
  const tStatus = useTranslations('status');

  const [filter, setFilter] = React.useState<Filter>('all');
  const [page, setPage] = React.useState(1);

  const query = useMyBookings(filter === 'all' ? undefined : filter, page);
  const bookings = query.data?.data ?? [];

  return (
    <main className="container py-8">
      <PageHeader title={t('myBookings')} description={t('myBookingsDesc')} />

      <Tabs
        value={filter}
        onValueChange={(v) => {
          setFilter(v as Filter);
          setPage(1);
        }}
      >
        <TabsList aria-label={t('filterByStatus')}>
          {FILTERS.map((f) => (
            <TabsTrigger key={f} value={f}>
              {f === 'all' ? t('all') : tStatus(f)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mt-4 space-y-3">
        {query.isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : bookings.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title={t('noBookings')}
            description={t('noBookingsDesc')}
            action={
              <Button asChild variant="primary">
                <Link href="/venues">
                  <Compass className="size-4" aria-hidden="true" />
                  {t('findVenue')}
                </Link>
              </Button>
            }
          />
        ) : (
          <>
            <ul className="space-y-3">
              {bookings.map((b) => (
                <li key={b.id}>
                  <Link
                    href={`/bookings/${b.id}`}
                    className="block rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                  >
                    <Card className="flex items-center gap-4 p-4 transition-colors hover:border-primary-300">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold text-neutral-900">{b.court.venue.name}</p>
                          <StatusBadge kind="booking" status={b.status} size="sm" />
                        </div>
                        <p className="text-sm text-neutral-600">
                          {b.court.name} · {formatTimeRange(b.during.start, b.during.end)} ·{' '}
                          {formatDateWithWeekday(b.during.start)}
                        </p>
                        <p className="text-sm tabular-nums text-neutral-900">
                          {formatCurrency(b.totalPrice)}
                        </p>
                      </div>
                      <ChevronRight className="size-5 shrink-0 text-neutral-400" aria-hidden="true" />
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
            {query.data?.meta && <Pagination meta={query.data.meta} onPageChange={setPage} />}
          </>
        )}
      </div>
    </main>
  );
}
