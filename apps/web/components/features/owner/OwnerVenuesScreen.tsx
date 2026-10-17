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

export function OwnerVenuesScreen() {
  const t = useTranslations('owner');
  const queryClient = useQueryClient();
  const [venueFormOpen, setVenueFormOpen] = React.useState(false);
  const [editingVenue, setEditingVenue] = React.useState<VenueDetail | undefined>();
  const [managingVenueId, setManagingVenueId] = React.useState<string | null>(null);

  const venuesQuery = useQuery({
    queryKey: ['owner', 'venues'],
    queryFn: listOwnerVenues,
    staleTime: 30 * 1000,
  });
  const venues = venuesQuery.data ?? [];
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
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">{t('venuesTitle')}</h1>
          <p className="mt-1 text-sm text-neutral-500">{t('venuesDesc')}</p>
        </div>
        <Button type="button" onClick={openCreateForm}>
          <Plus aria-hidden="true" />
          {t('addVenue')}
        </Button>
      </header>

      {venuesQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Card key={index} className="overflow-hidden border border-neutral-200 p-0">
              <Skeleton className="aspect-video w-full rounded-none" />
              <div className="space-y-3 p-4">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-10 w-full" />
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {venues.map((venue, index) => (
            <Card
              key={venue.id}
              className="group overflow-hidden rounded-card border border-neutral-200 bg-white p-0 shadow-none transition-shadow hover:shadow-md"
            >
              <div className="relative aspect-video overflow-hidden bg-neutral-100">
                {venue.coverUrl ? (
                  <Image
                    src={venue.coverUrl}
                    alt={t('venueCoverAlt', { name: venue.name })}
                    fill
                    priority={index === 0}
                    sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                    unoptimized={venue.coverUrl.startsWith('data:')}
                    className="object-cover"
                  />
                ) : (
                  <div className="flex size-full flex-col items-center justify-center gap-2 text-neutral-400">
                    <ImageOff className="size-8" aria-hidden="true" />
                    <span className="text-xs">{t('venueNoCover')}</span>
                  </div>
                )}
                <div className="absolute right-2 top-2">
                  <StatusBadge kind="venue" status={venue.status} size="sm" />
                </div>
              </div>

              <div className="space-y-3 p-4">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-bold text-neutral-900">{venue.name}</h2>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500">
                      <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{venue.address}</span>
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-neutral-800">
                    <Star className="size-3.5 fill-amber-500 text-amber-500" aria-hidden="true" />
                    {formatNumber(venue.ratingAvg)}
                    <span className="font-normal text-neutral-500">({venue.reviewCount})</span>
                  </span>
                </div>

                <ul className="flex min-h-6 flex-wrap gap-1.5" aria-label={t('venueSportsLabel')}>
                  {venue.sports.map((sport) => (
                    <li
                      key={sport.id}
                      className="rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-700"
                    >
                      {sport.name}
                    </li>
                  ))}
                </ul>

                <div className="flex items-center justify-between border-t border-neutral-100 pt-3 text-xs text-neutral-500">
                  <span>{t('venueCourtCount', { count: venue.courts.length })}</span>
                  <span className="font-mono">{t('venueIdShort', { id: venue.id.slice(0, 8) })}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 flex-1"
                    onClick={() => setManagingVenueId(venue.id)}
                  >
                    <Settings2 aria-hidden="true" />
                    {t('manageCourts')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="min-h-11 min-w-11 shrink-0"
                    aria-label={t('editVenueNamed', { name: venue.name })}
                    onClick={() => openEditForm(venue)}
                  >
                    <Pencil aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
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
