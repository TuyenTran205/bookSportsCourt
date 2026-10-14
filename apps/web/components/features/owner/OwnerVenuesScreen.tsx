'use client';

import * as React from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Building2, Edit2, Layers, MapPin, Plus, Star } from 'lucide-react';
import type { VenueDetail } from '@bsc/shared';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { CourtsManagerModal } from '@/components/features/owner/CourtsManagerModal';
import { VenueFormDialog } from '@/components/features/owner/VenueFormDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { useOwnerVenuesList } from '@/lib/hooks/useOwnerVenuesManager';

export function OwnerVenuesScreen() {
  const t = useTranslations('owner');

  const venuesQuery = useOwnerVenuesList();
  const venues = venuesQuery.data ?? [];

  const [formOpen, setFormOpen] = React.useState(false);
  const [editingVenue, setEditingVenue] = React.useState<VenueDetail | null>(null);
  const [managingCourtsVenue, setManagingCourtsVenue] = React.useState<VenueDetail | null>(null);

  const handleEdit = (venue: VenueDetail) => {
    setEditingVenue(venue);
    setFormOpen(true);
  };

  const handleCreate = () => {
    setEditingVenue(null);
    setFormOpen(true);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t('venuesTitle')}
        description={t('venuesDesc')}
        actions={
          <Button onClick={handleCreate}>
            <Plus className="mr-1.5 size-4" aria-hidden="true" />
            {t('addVenue')}
          </Button>
        }
      />

      {venuesQuery.isPending ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="overflow-hidden p-0">
              <Skeleton className="h-44 w-full" />
              <div className="flex flex-col gap-2 p-5">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </Card>
          ))}
        </div>
      ) : venuesQuery.isError ? (
        <ErrorState
          error={venuesQuery.error}
          onRetry={() => void venuesQuery.refetch()}
        />
      ) : venues.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Bạn chưa có cơ sở thể thao nào"
          description="Bắt đầu cho thuê sân bằng cách thêm cơ sở thể thao đầu tiên của bạn."
          action={
            <Button onClick={handleCreate}>
              <Plus className="mr-1.5 size-4" aria-hidden="true" />
              {t('addVenue')}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {venues.map((venue) => {
            const cover = venue.images?.[0]?.url ?? venue.coverUrl;
            return (
              <Card
                key={venue.id}
                className="flex flex-col overflow-hidden p-0 transition-shadow hover:shadow-md"
              >
                {/* Ảnh bìa */}
                <div className="relative h-44 w-full bg-neutral-100">
                  {cover ? (
                    <Image
                      src={cover}
                      alt={venue.name}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-neutral-400">
                      <Building2 className="size-12" aria-hidden="true" />
                    </div>
                  )}

                  {/* Badge trạng thái */}
                  <div className="absolute right-3 top-3">
                    <StatusBadge kind="venue" status={venue.status} />
                  </div>
                </div>

                {/* Nội dung */}
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-lg font-bold text-neutral-900">{venue.name}</h3>
                    <div className="flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
                      <Star className="size-3.5 fill-amber-500 text-amber-500" aria-hidden="true" />
                      <span>{venue.ratingAvg.toFixed(1)}</span>
                      <span className="font-normal text-neutral-400">({venue.reviewCount})</span>
                    </div>
                  </div>

                  <p className="mt-2 flex items-start gap-1.5 text-xs text-neutral-600">
                    <MapPin className="mt-0.5 size-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
                    <span className="line-clamp-2">{venue.address}</span>
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {venue.sports.map((s) => (
                      <span
                        key={s.id}
                        className="rounded-btn bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700"
                      >
                        {s.name}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3 text-xs text-neutral-500">
                    <span className="inline-flex items-center gap-1">
                      <Layers className="size-3.5" aria-hidden="true" />
                      <strong>{venue.courts.length}</strong> sân con
                    </span>
                    <span>ID: {venue.id.slice(0, 8)}…</span>
                  </div>

                  {/* Hành động */}
                  <div className="mt-4 flex items-center gap-2 border-t border-neutral-100 pt-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setManagingCourtsVenue(venue)}
                    >
                      <Layers className="mr-1.5 size-3.5" aria-hidden="true" />
                      {t('manageCourts')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(venue)}
                      title={t('editVenue')}
                      aria-label={t('editVenue')}
                    >
                      <Edit2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <VenueFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingVenue(null);
        }}
        venueToEdit={editingVenue}
      />

      <CourtsManagerModal
        venue={managingCourtsVenue}
        onClose={() => setManagingCourtsVenue(null)}
      />
    </div>
  );
}
