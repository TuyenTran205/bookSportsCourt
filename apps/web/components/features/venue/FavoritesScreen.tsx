'use client';

import * as React from 'react';
import Link from 'next/link';
import { Heart, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { FavoriteButton } from '@/components/features/venue/FavoriteButton';
import { VenueCard } from '@/components/features/venue/VenueCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useFavorites } from '@/lib/hooks/useBookings';

const FAVORITES_PAGE_SIZE = 8;

/** FavoritesScreen – CUS-13: danh sách sân yêu thích. */
export function FavoritesScreen() {
  const t = useTranslations('favorites');
  const query = useFavorites();
  const [page, setPage] = React.useState(1);
  const venues = query.data ?? [];
  const totalPages = Math.max(1, Math.ceil(venues.length / FAVORITES_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedVenues = venues.slice(
    (safePage - 1) * FAVORITES_PAGE_SIZE,
    safePage * FAVORITES_PAGE_SIZE,
  );

  return (
    <main className="container py-8">
      <PageHeader title={t('title')} description={t('desc')} />

      {query.isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
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
        <div className="space-y-6">
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {paginatedVenues.map((venue) => (
              <li key={venue.id}>
                <VenueCard venue={venue} action={<FavoriteButton venueId={venue.id} />} />
              </li>
            ))}
          </ul>
          <Pagination
            page={safePage}
            totalPages={totalPages}
            total={venues.length}
            limit={FAVORITES_PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      )}
    </main>
  );
}
