'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Columns2, LayoutGrid, Map as MapIcon, MapPin, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { FavoriteButton } from '@/components/features/venue/FavoriteButton';
import { VenueCard } from '@/components/features/venue/VenueCard';
import { VenueMapWrapper } from '@/components/features/venue/VenueMapWrapper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { listSports, listVenues } from '@/lib/api/endpoints/venues';
import { cn } from '@/lib/utils/cn';

type ViewMode = 'grid' | 'map' | 'split';

/**
 * Trang Tìm sân thể thao (CUS-02 / CUS-05 / BSC-020 & BSC-021).
 * Cho phép tìm kiếm theo từ khoá, lọc theo môn thể thao, hiển thị danh sách thẻ
 * và bản đồ tương tác OpenStreetMap (Leaflet).
 */
export default function VenuesPage() {
  const tVenue = useTranslations('venue');
  const tCommon = useTranslations('common');
  const searchParams = useSearchParams();

  const [query, setQuery] = React.useState(() => searchParams.get('q') ?? '');
  const [selectedSport, setSelectedSport] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<ViewMode>('grid');
  const [selectedVenueId, setSelectedVenueId] = React.useState<string | undefined>(undefined);

  const sportsQuery = useQuery({
    queryKey: ['catalogs', 'sports'],
    queryFn: listSports,
    staleTime: 10 * 60 * 1000,
  });

  const venuesQuery = useQuery({
    queryKey: ['venues', 'list', query, selectedSport],
    queryFn: () =>
      listVenues({
        q: query || undefined,
        sportIds: selectedSport ? [selectedSport] : undefined,
      }),
    staleTime: 60 * 1000,
  });

  const sports = sportsQuery.data ?? [];
  const venues = venuesQuery.data?.data ?? [];

  return (
    <main className="container py-8">
      {/* Tiêu đề & thanh tìm kiếm */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">{tVenue('searchTitle')}</h1>
          <p className="text-sm text-neutral-500">Khám phá và đặt các cơ sở thể thao chất lượng trên toàn quốc.</p>
        </div>

        <div className="flex w-full max-w-sm items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <Input
              type="text"
              placeholder={tCommon('search')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          {query && (
            <Button variant="ghost" size="sm" onClick={() => setQuery('')}>
              {tCommon('clearFilter')}
            </Button>
          )}
        </div>
      </div>

      {/* Bộ lọc môn thể thao & Bộ chuyển chế độ xem */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-4">
        {/* Pills chọn môn */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedSport(null)}
            className={`rounded-full px-3.5 py-1 text-xs font-medium transition-colors ${
              selectedSport === null
                ? 'bg-primary-700 text-white'
                : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            Tất cả môn
          </button>
          {sports.map((sport) => {
            const isSelected = selectedSport === sport.id;
            return (
              <button
                key={sport.id}
                type="button"
                onClick={() => setSelectedSport(isSelected ? null : sport.id)}
                className={`rounded-full px-3.5 py-1 text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-primary-700 text-white'
                    : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                {sport.name}
              </button>
            );
          })}
        </div>

        {/* Nút chuyển đổi View Mode */}
        <div className="flex items-center rounded-lg border border-neutral-200 bg-neutral-50 p-1 text-xs">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors',
              viewMode === 'grid'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900',
            )}
            title="Dạng lưới"
          >
            <LayoutGrid className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Lưới</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('map')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors',
              viewMode === 'map'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900',
            )}
            title="Dạng bản đồ"
          >
            <MapIcon className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Bản đồ</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('split')}
            className={cn(
              'hidden sm:flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors',
              viewMode === 'split'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900',
            )}
            title="Chia đôi (Lưới & Bản đồ)"
          >
            <Columns2 className="size-3.5" aria-hidden="true" />
            <span>Chia đôi</span>
          </button>
        </div>
      </div>

      {/* Nội dung kết quả */}
      <div className="mt-6">
        {venuesQuery.isPending ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-3 rounded-card border border-neutral-200 p-4">
                <Skeleton className="aspect-video w-full rounded-md" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            ))}
          </div>
        ) : venuesQuery.isError ? (
          <ErrorState error={venuesQuery.error} onRetry={() => void venuesQuery.refetch()} />
        ) : venues.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title={tVenue('noResults')}
            description={tVenue('noResultsDesc')}
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuery('');
                  setSelectedSport(null);
                }}
              >
                {tCommon('clearFilter')}
              </Button>
            }
          />
        ) : viewMode === 'map' ? (
          /* Chế độ chỉ bản đồ */
          <div className="h-[650px] w-full">
            <VenueMapWrapper
              venues={venues}
              selectedVenueId={selectedVenueId}
              onSelectVenue={(v) => setSelectedVenueId(v.id)}
            />
          </div>
        ) : viewMode === 'split' ? (
          /* Chế độ chia đôi: Danh sách bên trái + Bản đồ bên phải */
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="flex max-h-[720px] flex-col gap-4 overflow-y-auto pr-1 sm:grid sm:grid-cols-2 lg:col-span-6 lg:flex lg:flex-col xl:col-span-5">
              {venues.map((venue) => (
                <div
                  key={venue.id}
                  onMouseEnter={() => setSelectedVenueId(venue.id)}
                  className={cn(
                    'rounded-card transition-all',
                    selectedVenueId === venue.id ? 'ring-2 ring-primary-600' : '',
                  )}
                >
                  <VenueCard venue={venue} action={<FavoriteButton venueId={venue.id} />} />
                </div>
              ))}
            </div>

            <div className="h-[450px] lg:col-span-6 lg:h-[720px] xl:col-span-7">
              <VenueMapWrapper
                venues={venues}
                selectedVenueId={selectedVenueId}
                onSelectVenue={(v) => setSelectedVenueId(v.id)}
              />
            </div>
          </div>
        ) : (
          /* Chế độ lưới 3 cột mặc định */
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {venues.map((venue) => (
              <VenueCard
                key={venue.id}
                venue={venue}
                action={<FavoriteButton venueId={venue.id} />}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
