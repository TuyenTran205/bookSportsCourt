'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Columns2,
  LayoutGrid,
  Map as MapIcon,
  MapPin,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
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
    provinceCode: sp.get('provinceCode') || undefined,
    wardId: sp.get('wardId') || undefined,
    wardCode: sp.get('wardCode') || undefined,
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
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = React.useState(false);

  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    if (filterValues.provinceId || filterValues.provinceCode) count++;
    if (filterValues.wardId || filterValues.wardCode || filterValues.districtId) count++;
    if (filterValues.sportIds && filterValues.sportIds.length > 0) count += filterValues.sportIds.length;
    if (filterValues.amenityIds && filterValues.amenityIds.length > 0) count += filterValues.amenityIds.length;
    if (filterValues.maxPrice) count++;
    if (filterValues.minRating) count++;
    if (filterValues.sort && filterValues.sort !== 'rating_desc') count++;
    return count;
  }, [filterValues]);

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
      if (next.provinceCode) sp.set('provinceCode', next.provinceCode);
      if (next.wardId) sp.set('wardId', next.wardId);
      if (next.wardCode) sp.set('wardCode', next.wardCode);
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
      filterValues.provinceCode,
      filterValues.wardId,
      filterValues.wardCode,
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
        provinceCode: filterValues.provinceCode,
        wardId: filterValues.wardId,
        wardCode: filterValues.wardCode,
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

  const totalCount = meta?.total ?? venues.length;

  return (
    <main className="container py-6 sm:py-8">
      {/* Tiêu đề & thanh công cụ trên cùng */}
      <div className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            {tVenue('searchTitle')}
          </h1>
          <p className="text-sm text-text-secondary">
            Khám phá và đặt các cơ sở thể thao chất lượng trên toàn quốc.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:flex-nowrap">
          {/* Ô tìm kiếm từ khóa */}
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:w-72 sm:flex-none xl:w-80">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-disabled"
                aria-hidden="true"
              />
              <Input
                type="text"
                aria-label={tCommon('search')}
                placeholder={tCommon('search')}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="min-h-11 pl-9"
              />
            </div>
            {searchInput && (
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={() => {
                  setSearchInput('');
                  applyFilterChange({ ...filterValues, q: undefined, page: 1 });
                }}
              >
                {tCommon('clearFilter')}
              </Button>
            )}
          </div>

          {/* Nút mở bộ lọc cho mobile / tablet */}
          <button
            type="button"
            onClick={() => setIsMobileFiltersOpen((prev) => !prev)}
            aria-expanded={isMobileFiltersOpen}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-bg-card px-3 text-xs font-medium text-text-primary transition-colors hover:bg-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 lg:hidden"
          >
            <SlidersHorizontal className="size-3.5 text-text-secondary" aria-hidden="true" />
            <span>{tCommon('filter')}</span>
            {activeFilterCount > 0 && (
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary-100 text-[11px] font-semibold text-primary-700 dark:bg-primary-950 dark:text-primary-300">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Thanh chuyển đổi View Mode */}
          <div className="flex shrink-0 items-center rounded-lg border border-border bg-bg-subtle p-1 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-pressed={viewMode === 'grid'}
              className={cn(
                'flex min-h-9 items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors',
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
              aria-pressed={viewMode === 'map'}
              className={cn(
                'flex min-h-9 items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors',
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
              aria-pressed={viewMode === 'split'}
              className={cn(
                'hidden min-h-9 items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors sm:flex',
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
      </div>

      {/* Phương án B: Sidebar bộ lọc bên trái + Vùng kết quả mở rộng tối đa bên phải */}
      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[272px_minmax(0,1fr)] xl:grid-cols-[296px_minmax(0,1fr)]">
        <aside
          className={cn(
            'lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto',
            isMobileFiltersOpen ? 'block' : 'hidden lg:block',
          )}
        >
          <VenueFilters
            layout="sidebar"
            values={filterValues}
            onChange={applyFilterChange}
            onReset={handleResetFilters}
            totalResults={totalCount}
            isLoading={venuesQuery.isLoading && venues.length === 0}
          />
        </aside>

        {/* Nội dung kết quả */}
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary sm:text-sm">
            <span>
              Tìm thấy <strong className="font-semibold text-text-primary">{totalCount}</strong> cơ sở
            </span>
          </div>

          {venuesQuery.isPending ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-3 rounded-card border border-border bg-bg-card p-3.5"
                >
                  <Skeleton className="h-40 w-full rounded-md sm:h-44" />
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
            <div className="h-[520px] min-h-[520px] w-full sm:h-[640px] lg:h-[calc(100vh-13rem)]">
              <VenueMapWrapper
                venues={venues}
                selectedVenueId={selectedVenueId}
                onSelectVenue={(v) => setSelectedVenueId(v.id)}
              />
            </div>
          ) : viewMode === 'split' ? (
            /* Chế độ chia đôi 1:2 — Thẻ thu gọn 1 phần bên trái, Bản đồ rộng 2 phần bên phải */
            <>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="flex flex-col gap-3 sm:grid sm:grid-cols-2 lg:col-span-1 lg:flex lg:max-h-[calc(100vh-13rem)] lg:flex-col lg:overflow-y-auto lg:pr-1">
                  {venues.map((venue) => (
                    <div
                      key={venue.id}
                      onMouseEnter={() => setSelectedVenueId(venue.id)}
                      className={cn(
                        'rounded-card transition-all',
                        selectedVenueId === venue.id ? 'ring-2 ring-primary-600' : '',
                      )}
                    >
                      <VenueCard
                        density="compact"
                        venue={venue}
                        action={<FavoriteButton venueId={venue.id} />}
                      />
                    </div>
                  ))}
                </div>

                <div className="h-[440px] sm:h-[520px] lg:sticky lg:top-20 lg:col-span-2 lg:h-[calc(100vh-13rem)] lg:min-h-[540px]">
                  <VenueMapWrapper
                    venues={venues}
                    selectedVenueId={selectedVenueId}
                    onSelectVenue={(v) => setSelectedVenueId(v.id)}
                  />
                </div>
              </div>

              {totalPages > 1 && (
                <div className="mt-6">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                    disabled={venuesQuery.isFetching}
                  />
                </div>
              )}
            </>
          ) : (
            /* Chế độ lưới mở rộng full màn hình */
            <>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
      </div>
    </main>
  );
}
