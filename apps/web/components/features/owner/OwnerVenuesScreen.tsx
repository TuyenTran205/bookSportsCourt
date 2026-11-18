'use client';

import * as React from 'react';
import Image from 'next/image';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Building2, ImageOff, MapPin, Pencil, Plus, Settings2, Star } from 'lucide-react';

import type { Court, VenueDetail } from '@bsc/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Pagination } from '@/components/common/Pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  createCourt,
  createOwnerVenue,
  deleteCourt,
  listOwnerVenues,
  uploadVenueImage,
  updateOwnerVenue,
} from '@/lib/api/endpoints/owner';
import { formatNumber } from '@/lib/utils/format';
import { VenueCourtsDialog } from './venues/VenueCourtsDialog';
import { VenueFormDialog, type VenueFormInput } from './venues/VenueFormDialog';

async function saveVenueWithOptionalImage(save: () => Promise<VenueDetail>, image?: File) {
  const venue = await save();
  if (!image) return { venue, imageError: null };

  try {
    await uploadVenueImage(venue.id, image);
    return { venue, imageError: null };
  } catch (imageError) {
    return {
      venue,
      imageError: imageError instanceof Error ? imageError : new Error('Không thể tải ảnh lên.'),
    };
  }
}

const VENUES_PAGE_SIZE = 8;

export function OwnerVenuesScreen() {
  const t = useTranslations('owner');
  const queryClient = useQueryClient();
  const [venueFormOpen, setVenueFormOpen] = React.useState(false);
  const [editingVenue, setEditingVenue] = React.useState<VenueDetail | undefined>();
  const [managingVenueId, setManagingVenueId] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);

  const venuesQuery = useQuery({
    queryKey: ['owner', 'venues'],
    queryFn: listOwnerVenues,
    staleTime: 30 * 1000,
  });
  const venues = venuesQuery.data ?? [];
  const totalPages = Math.max(1, Math.ceil(venues.length / VENUES_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedVenues = venues.slice(
    (safePage - 1) * VENUES_PAGE_SIZE,
    safePage * VENUES_PAGE_SIZE,
  );
  const managingVenue = venues.find((venue) => venue.id === managingVenueId) ?? null;

  const refreshVenues = async () => {
    await queryClient.invalidateQueries({ queryKey: ['owner', 'venues'] });
  };

  const createVenueMutation = useMutation({
    mutationFn: ({ image, ...input }: VenueFormInput) =>
      saveVenueWithOptionalImage(() => createOwnerVenue(input), image),
    onSuccess: async ({ imageError }) => {
      await refreshVenues();
      setVenueFormOpen(false);
      if (imageError) {
        toast.error(t('venueImageUploadFailedAfterSave', { reason: imageError.message }));
      } else {
        toast.success(t('venueCreatedSuccess'));
      }
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t('venueSaveFailed')),
  });

  const updateVenueMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: VenueFormInput }) => {
      const { image, ...venueInput } = input;
      return saveVenueWithOptionalImage(
        () => updateOwnerVenue(id, venueInput),
        image,
      );
    },
    onSuccess: async ({ imageError }) => {
      await refreshVenues();
      setVenueFormOpen(false);
      setEditingVenue(undefined);
      if (imageError) {
        toast.error(t('venueImageUploadFailedAfterSave', { reason: imageError.message }));
      } else {
        toast.success(t('venueUpdatedSuccess'));
      }
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t('venueSaveFailed')),
  });

  const createCourtMutation = useMutation({
    mutationFn: ({
      venueId,
      input,
    }: {
      venueId: string;
      input: { name: string; sportId: string };
    }) => createCourt(venueId, input),
    onSuccess: async () => {
      await refreshVenues();
      toast.success(t('courtCreatedSuccess'));
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t('courtSaveFailed')),
  });

  const deleteCourtMutation = useMutation({
    mutationFn: (court: Court) => deleteCourt(court.id),
    onSuccess: async () => {
      await refreshVenues();
      toast.success(t('deleteCourtSuccess'));
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t('courtDeleteFailed')),
  });

  const openCreateForm = () => {
    setEditingVenue(undefined);
    setVenueFormOpen(true);
  };

  const openEditForm = (venue: VenueDetail) => {
    setEditingVenue(venue);
    setVenueFormOpen(true);
  };

  const submitVenue = (input: VenueFormInput) => {
    if (editingVenue) {
      updateVenueMutation.mutate({ id: editingVenue.id, input });
    } else {
      createVenueMutation.mutate(input);
    }
  };

  const formOpenChange = (open: boolean) => {
    setVenueFormOpen(open);
    if (!open) setEditingVenue(undefined);
  };

  const isVenueSaving = createVenueMutation.isPending || updateVenueMutation.isPending;

  return (
    <div className="w-full min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">{t('venuesTitle')}</h1>
          <p className="mt-1 text-sm text-text-secondary">{t('venuesDesc')}</p>
        </div>
        <Button type="button" onClick={openCreateForm}>
          <Plus aria-hidden="true" />
          {t('addVenue')}
        </Button>
      </header>

      {venuesQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Card key={index} className="overflow-hidden border border-border p-0">
              <Skeleton className="aspect-[16/10] w-full rounded-none" />
              <div className="space-y-2.5 p-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-7 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            </Card>
          ))}
        </div>
      ) : venuesQuery.isError ? (
        <ErrorState error={venuesQuery.error} onRetry={() => void venuesQuery.refetch()} />
      ) : venues.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={t('noVenuesTitle')}
          description={t('noVenuesDescription')}
          action={
            <Button type="button" onClick={openCreateForm}>
              <Plus aria-hidden="true" />
              {t('addVenue')}
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {paginatedVenues.map((venue, index) => (
              <Card
                key={venue.id}
                className="group flex flex-col justify-between overflow-hidden rounded-card border border-border bg-bg-card p-0 shadow-none transition-shadow hover:shadow-md"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-bg-subtle">
                  {venue.coverUrl || (venue as { images?: Array<{ url: string }> })?.images?.[0]?.url ? (
                    <Image
                      src={(venue.coverUrl || (venue as { images?: Array<{ url: string }> })?.images?.[0]?.url)!}
                      alt={t('venueCoverAlt', { name: venue.name })}
                      fill
                      priority={index === 0}
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      unoptimized={
                        (venue.coverUrl || '').startsWith('data:') ||
                        (venue.coverUrl || '').startsWith('blob:')
                      }
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex size-full flex-col items-center justify-center gap-1.5 text-text-disabled">
                      <ImageOff className="size-7" aria-hidden="true" />
                      <span className="text-xs">{t('venueNoCover')}</span>
                    </div>
                  )}
                  <div className="absolute right-2 top-2">
                    <StatusBadge kind="venue" status={venue.status} size="sm" />
                  </div>
                </div>

                <div className="flex flex-1 flex-col justify-between space-y-2.5 p-3">
                  <div className="space-y-2">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-bold text-text-primary">{venue.name}</h2>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-text-secondary">
                          <MapPin className="size-3 shrink-0" aria-hidden="true" />
                          <span className="truncate">{venue.address}</span>
                        </p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-text-primary">
                        <Star className="size-3 fill-amber-500 text-amber-500" aria-hidden="true" />
                        {formatNumber(venue.ratingAvg ?? 0)}
                        <span className="font-normal text-text-secondary">({venue.reviewCount ?? 0})</span>
                      </span>
                    </div>

                    <ul className="flex min-h-5 flex-wrap gap-1" aria-label={t('venueSportsLabel')}>
                      {(venue.sports ?? []).map((sport) => (
                        <li
                          key={sport.id}
                          className="rounded bg-bg-subtle px-1.5 py-0.5 text-[11px] text-text-secondary"
                        >
                          {sport.name}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-t border-border pt-2 text-xs text-text-secondary">
                      <span>{t('venueCourtCount', { count: (venue.courts ?? []).length })}</span>
                      <span className="font-mono">{t('venueIdShort', { id: venue.id.slice(0, 8) })}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 flex-1 text-xs"
                        onClick={() => setManagingVenueId(venue.id)}
                      >
                        <Settings2 className="size-3.5" aria-hidden="true" />
                        {t('manageCourts')}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9 shrink-0"
                        aria-label={t('editVenueNamed', { name: venue.name })}
                        onClick={() => openEditForm(venue)}
                      >
                        <Pencil className="size-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Pagination
            page={safePage}
            totalPages={totalPages}
            total={venues.length}
            limit={VENUES_PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      )}

      <VenueFormDialog
        open={venueFormOpen}
        venue={editingVenue}
        submitting={isVenueSaving}
        onOpenChange={formOpenChange}
        onSubmit={submitVenue}
      />
      <VenueCourtsDialog
        venue={managingVenue}
        submitting={createCourtMutation.isPending}
        deletingCourtId={deleteCourtMutation.isPending ? deleteCourtMutation.variables?.id ?? null : null}
        onOpenChange={(open) => {
          if (!open) setManagingVenueId(null);
        }}
        onCreate={(input) => {
          if (managingVenue) createCourtMutation.mutate({ venueId: managingVenue.id, input });
        }}
        onDelete={(court) => deleteCourtMutation.mutate(court)}
      />
    </div>
  );
}
