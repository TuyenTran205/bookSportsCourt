'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Columns2, LayoutGrid, Map as MapIcon, MapPin, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { FavoriteButton } from '@/components/features/venue/FavoriteButton';
import { VenueCard } from '@/components/features/venue/VenueCard';
import {
  VenueFilters,
  type VenueFilterValues,
} from '@/components/features/venue/VenueFilters';
import { VenueMapWrapper } from '@/components/features/venue/VenueMapWrapper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { listVenues, type VenueSort } from '@/lib/api/endpoints/venues';
import { cn } from '@/lib/utils/cn';

type ViewMode = 'grid' | 'map' | 'split';

const PAGE_SIZE = 12;

/**
 * Phân tích URL SearchParams thành VenueFilterValues.
 */
function parseFiltersFromSearchParams(sp: URLSearchParams): VenueFilterValues {
  const sportIds = sp.getAll('sportIds').filter(Boolean);
  const amenityIds = sp.getAll('amenityIds').filter(Boolean);
  const maxPriceRaw = sp.get('maxPrice');
  const minRatingRaw = sp.get('minRating');
  const pageRaw = sp.get('page');

  return {
    q: sp.get('q')?.trim() || undefined,
    provinceId: sp.get('provinceId') || undefined,
    districtId: sp.get('districtId') || undefined,
    sportIds: sportIds.length > 0 ? sportIds : undefined,
    amenityIds: amenityIds.length > 0 ? amenityIds : undefined,
    maxPrice: maxPriceRaw ? Number(maxPriceRaw) : undefined,
    minRating: minRatingRaw ? Number(minRatingRaw) : undefined,
    sort: (sp.get('sort') as VenueSort) || 'rating_desc',
    page: pageRaw ? Math.max(1, parseInt(pageRaw, 10)) : 1,
  };
}

/**
 * Trang Tìm sân thể thao (CUS-02 / GST-01 / BSC-020 & BSC-021).
 * Hỗ trợ bộ lọc đa tiêu chí, phân trang đồng bộ URL, chế độ xem Lưới / Bản đồ / Chia đôi.
 */
export default function VenuesPage() {
  const tVenue = useTranslations('venue');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Đọc giá trị bộ lọc từ URL
  const filterValues = React.useMemo(
    () => parseFiltersFromSearchParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  // State local cho từ khoá tìm kiếm (phục vụ debounce)
  const [searchInput, setSearchInput] = React.useState(filterValues.q ?? '');
  const [viewMode, setViewMode] = React.useState<ViewMode>('grid');
  const [selectedVenueId, setSelectedVenueId] = React.useState<string | undefined>(undefined);

  // Cập nhật searchInput khi URL đổi từ bên ngoài (e.g. back/forward)
  React.useEffect(() => {
    setSearchInput(filterValues.q ?? '');
  }, [filterValues.q]);

  // Hàm chuyển đổi filterValues thành URL và điều hướng
  const applyFilterChange = React.useCallback(
    (next: VenueFilterValues) => {
      const sp = new URLSearchParams();

      if (next.q) sp.set('q', next.q);
      if (next.provinceId) sp.set('provinceId', next.provinceId);
      if (next.districtId) sp.set('districtId', next.districtId);
      if (next.sportIds && next.sportIds.length > 0) {
        next.sportIds.forEach((id) => sp.append('sportIds', id));
      }
      if (next.amenityIds && next.amenityIds.length > 0) {
        next.amenityIds.forEach((id) => sp.append('amenityIds', id));
      }
      if (next.maxPrice) sp.set('maxPrice', String(next.maxPrice));
      if (next.minRating) sp.set('minRating', String(next.minRating));
      if (next.sort && next.sort !== 'rating_desc') sp.set('sort', next.sort);
      if (next.page && next.page > 1) sp.set('page', String(next.page));

      const queryStr = sp.toString();
      router.replace(`${pathname}${queryStr ? `?${queryStr}` : ''}`, { scroll: false });
    },
    [pathname, router],
  );

  // Debounce cập nhật từ khoá tìm kiếm 350ms
  React.useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchInput.trim();
      const currentQ = filterValues.q ?? '';
      if (trimmed !== currentQ) {
        applyFilterChange({
          ...filterValues,
          q: trimmed || undefined,
          page: 1,
        });
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput, filterValues, applyFilterChange]);

  // Query danh sách sân theo toàn bộ tham số lọc
  const venuesQuery = useQuery({
    queryKey: [
      'venues',
      'list',
      filterValues.q,
      filterValues.provinceId,
      filterValues.districtId,
      filterValues.sportIds,
      filterValues.amenityIds,
      filterValues.maxPrice,
      filterValues.minRating,
      filterValues.sort,
      filterValues.page,
    ],
    queryFn: () =>
      listVenues({
        q: filterValues.q,
        provinceId: filterValues.provinceId,
        districtId: filterValues.districtId,
        sportIds: filterValues.sportIds,
        amenityIds: filterValues.amenityIds,
        maxPrice: filterValues.maxPrice,
        minRating: filterValues.minRating,
        sort: filterValues.sort,
        page: filterValues.page ?? 1,
        limit: PAGE_SIZE,
      }),
    staleTime: 60 * 1000,
  });

  const venues = venuesQuery.data?.data ?? [];
  const meta = venuesQuery.data?.meta;
  const currentPage = filterValues.page ?? 1;
  const totalPages = meta?.totalPages ?? 1;

  const handleResetFilters = () => {
    setSearchInput('');
    router.replace(pathname, { scroll: false });
  };

  const handlePageChange = (newPage: number) => {
    applyFilterChange({
      ...filterValues,
      page: newPage,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="container py-8">
      {/* Tiêu đề & thanh tìm kiếm */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">
            {tVenue('searchTitle')}
          </h1>
          <p className="text-sm text-neutral-500">
            Khám phá và đặt các cơ sở thể thao chất lượng trên toàn quốc.
          </p>
        </div>

        <div className="flex w-full max-w-sm items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <Input
              type="text"
              placeholder={tCommon('search')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 min-h-11"
            />
          </div>
          {searchInput && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchInput('');
                applyFilterChange({ ...filterValues, q: undefined, page: 1 });
              }}
            >
              {tCommon('clearFilter')}
            </Button>
          )}
        </div>
      </div>

      {/* Bộ lọc nâng cao VenueFilters */}
      <div className="mt-6">
        <VenueFilters
          values={filterValues}
          onChange={applyFilterChange}
          onReset={handleResetFilters}
          totalResults={meta?.total ?? venues.length}
          isLoading={venuesQuery.isFetching}
        />
      </div>

      {/* Thanh chuyển đổi View Mode */}
      <div className="mt-4 flex items-center justify-end">
        <div className="flex items-center rounded-lg border border-border bg-bg-subtle p-1 text-xs">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors',
              viewMode === 'grid'
                ? 'bg-bg-card text-text-primary shadow-xs'
                : 'text-text-secondary hover:text-text-primary',
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
                ? 'bg-bg-card text-text-primary shadow-xs'
                : 'text-text-secondary hover:text-text-primary',
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
                ? 'bg-bg-card text-text-primary shadow-xs'
                : 'text-text-secondary hover:text-text-primary',
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
              <div
                key={i}
                className="flex flex-col gap-3 rounded-card border border-border bg-bg-card p-4"
              >
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
              <Button variant="outline" size="sm" onClick={handleResetFilters}>
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
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {venues.map((venue) => (
                <VenueCard
                  key={venue.id}
                  venue={venue}
                  action={<FavoriteButton venueId={venue.id} />}
                />
              ))}
            </div>

            {/* Phân trang */}
            {totalPages > 1 && (
              <div className="mt-8">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                  disabled={venuesQuery.isFetching}
                />
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
