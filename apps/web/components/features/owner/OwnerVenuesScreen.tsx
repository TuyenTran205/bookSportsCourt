'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Building2, MapPin, Plus, Trophy } from 'lucide-react';

import { listOwnerVenues } from '@/lib/api/endpoints/owner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';

export function OwnerVenuesScreen() {
  const t = useTranslations('owner');
  const venuesQuery = useQuery({
    queryKey: ['owner', 'venues'],
    queryFn: listOwnerVenues,
  });

  const venues = venuesQuery.data ?? [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            {t('venuesTitle')}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {t('venuesDesc')}
          </p>
        </div>
        <Button variant="primary" onClick={() => alert('Chức năng thêm cơ sở mới')}>
          <Plus className="mr-2 size-4" />
          {t('addVenue')}
        </Button>
      </div>

      {venuesQuery.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="mt-2 h-4 w-64" />
              <Skeleton className="mt-6 h-28 w-full" />
            </Card>
          ))}
        </div>
      ) : venuesQuery.isError ? (
        <ErrorState
          error={venuesQuery.error}
          onRetry={() => void venuesQuery.refetch()}
        />
      ) : venues.length === 0 ? (
        <Card className="p-12 text-center">
          <EmptyState
            icon={Building2}
            title="Chưa có cơ sở nào"
            description="Hãy bắt đầu bằng việc thêm cơ sở thể thao đầu tiên của bạn."
            action={
              <Button variant="primary">
                <Plus className="mr-2 size-4" />
                {t('addVenue')}
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {venues.map((venue) => (
            <Card key={venue.id} className="overflow-hidden border border-neutral-200 bg-white">
              <CardHeader className="p-5 pb-3 border-b border-neutral-100 flex flex-row items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg font-bold text-neutral-900">
                      {venue.name}
                    </CardTitle>
                    <StatusBadge kind="venue" status={venue.status ?? 'approved'} />
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500">
                    <MapPin className="size-3.5 shrink-0 text-neutral-400" />
                    <span>{venue.address}</span>
                  </p>
                </div>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
                    Danh sách sân ({venue.courts.length} sân)
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {venue.courts.map((court) => (
                      <div
                        key={court.id}
                        className="flex items-center justify-between rounded-md border border-neutral-100 bg-neutral-50 px-3 py-2 text-xs"
                      >
                        <span className="font-medium text-neutral-800">{court.name}</span>
                        <span className="text-[11px] text-emerald-600 font-medium">Hoạt động</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-neutral-100">
                  <span className="text-xs text-neutral-500 flex items-center gap-1">
                    <Trophy className="size-3.5 text-neutral-400" />
                    <span>{venue.sports?.map((s) => s.name).join(', ') || 'Thể thao'}</span>
                  </span>
                  <div className="space-x-2">
                    <Button size="sm" variant="outline">
                      {t('editVenue')}
                    </Button>
                    <Button size="sm" variant="outline">
                      {t('addCourt')}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
