'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Calendar, Plus } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useOwnerTimeline } from '@/lib/hooks/useOwnerTimeline';
import { useQuery } from '@tanstack/react-query';
import { listOwnerVenues } from '@/lib/api/endpoints/owner';
import { formatCurrency, formatTimeRange } from '@/lib/utils/format';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { ErrorState } from '@/components/common/ErrorState';

export function OwnerTimeline() {
  const t = useTranslations('owner');
  const { role } = useAuth();

  const venuesQuery = useQuery({
    queryKey: ['owner', 'venues'],
    queryFn: listOwnerVenues,
  });

  const [selectedVenueId, setSelectedVenueId] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    if (venuesQuery.data && venuesQuery.data.length > 0 && !selectedVenueId) {
      setSelectedVenueId(venuesQuery.data[0]!.id);
    }
  }, [venuesQuery.data, selectedVenueId]);

  const timelineQuery = useOwnerTimeline(selectedVenueId);

  if (role !== 'owner' && role !== 'admin') {
    return null;
  }

  if (timelineQuery.isLoading || venuesQuery.isLoading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="mt-4 h-48 w-full" />
      </Card>
    );
  }

  if (timelineQuery.error) {
    return (
      <ErrorState
        error={timelineQuery.error}
        onRetry={() => void timelineQuery.refetch()}
      />
    );
  }

  const timelineData = timelineQuery.data;
  const courts = timelineData?.courts ?? [];
  const bookings = timelineData?.bookings ?? [];

  if (!courts || courts.length === 0) {
    return (
      <Card className="p-8 text-center text-neutral-500">
        <Calendar className="mx-auto mb-2 size-8 text-neutral-400" />
        <p className="font-medium text-neutral-700">{t('timelineNoCourts')}</p>
        <p className="mt-1 text-xs text-neutral-500">{t('timelineNoCourtsDesc')}</p>
        <Link href="/owner/venues" className="mt-4 inline-block">
          <Button size="sm">
            <Plus className="mr-1 size-4" />
            {t('addCourt')}
          </Button>
        </Link>
      </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-5">
      <CardHeader className="flex flex-row items-center justify-between p-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Calendar className="size-5 text-emerald-600" aria-hidden="true" />
          {t('timelineTitle')}
        </CardTitle>

        <div className="flex items-center gap-2">
          {venuesQuery.data && venuesQuery.data.length > 1 && (
            <select
              value={selectedVenueId}
              onChange={(e) => setSelectedVenueId(e.target.value)}
              className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs text-neutral-800"
            >
              {venuesQuery.data.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          )}
          <Link href="/owner/venues">
            <Button size="sm" variant="outline">
              {t('manageCourts')}
            </Button>
          </Link>
        </div>
      </CardHeader>

      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50/50 text-xs font-semibold uppercase text-neutral-500">
              <th className="py-3 px-3">{t('colCourt')}</th>
              <th className="py-3 px-3">{t('colCustomer')}</th>
              <th className="py-3 px-3">{t('colTimeRange')}</th>
              <th className="py-3 px-3">{t('colStatus')}</th>
              <th className="py-3 px-3 text-right">{t('colTotalPrice')}</th>
            </tr>
          </thead>
          <tbody>
            {bookings.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-xs text-neutral-500">
                  Chưa có lịch đặt nào trong ngày đang xem.
                </td>
              </tr>
            ) : (
              bookings.map((booking) => {
                const court = courts.find((c) => c.id === booking.courtId);
                return (
                  <tr key={booking.id} className="border-b border-neutral-100 hover:bg-neutral-50/60">
                    <td className="py-3 px-3 font-medium text-neutral-900">
                      {court?.name ?? 'Sân'}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-neutral-900">
                        {booking.customerName ?? booking.guestName ?? 'Khách vãng lai'}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {booking.source === 'manual' ? t('sourceManual') : t('sourceOnline')}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-neutral-600 tabular-nums">
                      {formatTimeRange(booking.during.start, booking.during.end)}
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge kind="booking" status={booking.status} />
                    </td>
                    <td className="py-3 px-3 text-right font-semibold tabular-nums text-neutral-900">
                      {booking.totalPrice > 0 ? formatCurrency(booking.totalPrice) : '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}