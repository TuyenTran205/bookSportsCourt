'use client';

import * as React from 'react';
import Link from 'next/link';
import { Heart, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { FavoriteButton } from '@/components/features/venue/FavoriteButton';
import { VenueCard } from '@/components/features/venue/VenueCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useFavorites } from '@/lib/hooks/useBookings';

/** FavoritesScreen – CUS-13: danh sách sân yêu thích. */
export function FavoritesScreen() {
  const t = useTranslations('favorites');
  const query = useFavorites();
  const venues = query.data ?? [];

  return (
    <main className="container py-8">
      <PageHeader title={t('title')} description={t('desc')} />

      {query.isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : venues.length === 0 ? (
        <EmptyState
          icon={Heart}
          title={t('emptyTitle')}
          description={t('emptyDesc')}
          action={
            <Button asChild variant="primary">
              <Link href="/venues">
                <Search className="size-4" aria-hidden="true" />
                {t('explore')}
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {venues.map((venue) => (
            <li key={venue.id}>
              <VenueCard venue={venue} action={<FavoriteButton venueId={venue.id} />} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
