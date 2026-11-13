'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import type { Province, Ward } from '@bsc/shared';

import { LocationSelector } from '@/components/common/LocationSelector';
import { NativeSelect } from '@/components/ui/select';
import {
  listAmenities,
  listSports,
  type VenueSort,
} from '@/lib/api/endpoints/venues';
import { cn } from '@/lib/utils/cn';

export interface VenueFilterValues {
  q?: string;
  provinceId?: string;
  provinceCode?: string;
  wardId?: string;
  wardCode?: string;
  districtId?: string;
  sportIds?: string[];
  amenityIds?: string[];
  maxPrice?: number;
  minRating?: number;
  sort?: VenueSort;
  page?: number;
}

export interface VenueFiltersProps {
  values: VenueFilterValues;
  onChange: (nextValues: VenueFilterValues) => void;
  onReset: () => void;
  totalResults?: number;
  isLoading?: boolean;
  /** Bố cục thanh ngang mặc định hoặc cột sidebar dọc ở màn tìm sân (Phương án B). */
  layout?: 'horizontal' | 'sidebar';
  className?: string;
}

const PRICE_OPTIONS = [
  { value: '', label: 'Tất cả mức giá' },
  { value: '150000', label: 'Dưới 150.000 ₫/h' },
  { value: '300000', label: 'Dưới 300.000 ₫/h' },
  { value: '500000', label: 'Dưới 500.000 ₫/h' },
  { value: '1000000', label: 'Dưới 1.000.000 ₫/h' },
];

const RATING_OPTIONS = [
  { value: '', label: 'Tất cả đánh giá' },
  { value: '3', label: 'Từ 3.0 sao trở lên' },
  { value: '4', label: 'Từ 4.0 sao trở lên' },
  { value: '4.5', label: 'Từ 4.5 sao trở lên' },
];

const SORT_OPTIONS: Array<{ value: VenueSort; label: string }> = [
  { value: 'rating_desc', label: 'Đánh giá cao nhất' },
  { value: 'price_asc', label: 'Giá từ thấp đến cao' },
  { value: 'price_desc', label: 'Giá từ cao đến thấp' },
  { value: 'newest', label: 'Sân mới nhất' },
];

export function VenueFilters({
  values,
  onChange,
  onReset,
  totalResults,
  isLoading = false,
  layout = 'horizontal',
  className,
}: VenueFiltersProps) {
  const [isAdvancedOpen, setIsAdvancedOpen] = React.useState(false);
  const isSidebar = layout === 'sidebar';
  const showAdvanced = isSidebar || isAdvancedOpen;

  // Danh mục Môn thể thao
  const sportsQuery = useQuery({
    queryKey: ['catalogs', 'sports'],
    queryFn: listSports,
    staleTime: 10 * 60 * 1000,
  });

  // Danh mục Tiện ích
  const amenitiesQuery = useQuery({
    queryKey: ['catalogs', 'amenities'],
    queryFn: listAmenities,
    staleTime: 10 * 60 * 1000,
  });

  const sports = sportsQuery.data ?? [];
  const amenities = amenitiesQuery.data ?? [];

  // Đếm số lượng bộ lọc đang áp dụng
  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (values.provinceId || values.provinceCode) count++;
    if (values.wardId || values.wardCode || values.districtId) count++;
    if (values.sportIds && values.sportIds.length > 0) count += values.sportIds.length;
    if (values.amenityIds && values.amenityIds.length > 0) count += values.amenityIds.length;
    if (values.maxPrice) count++;
    if (values.minRating) count++;
    if (values.sort && values.sort !== 'rating_desc') count++;
    return count;
  }, [values]);

  // LocationSelector gọi onProvinceChange rồi onWardChange(null) liên tiếp trong cùng một
  // tick. Nếu mỗi handler dựa vào `values` (closure cũ) thì lần gọi thứ hai sẽ ghi đè lần
  // đầu và tỉnh vừa chọn bị mất. Dùng ref giữ giá trị mới nhất để các lần gọi nối tiếp nhau.
  const latestValuesRef = React.useRef(values);
  latestValuesRef.current = values;

  const emitChange = (patch: Partial<VenueFilterValues>) => {
    const next = { ...latestValuesRef.current, ...patch };
    latestValuesRef.current = next;
    onChange(next);
  };

  const handleProvinceChange = (province: Province | null) => {
    emitChange({
      provinceId: province?.id,
      provinceCode: province?.code,
      wardId: undefined,
      wardCode: undefined,
      districtId: undefined, // Reset cấp xã/quận khi đổi tỉnh
      page: 1,
    });
  };

  const handleWardChange = (ward: Ward | null) => {
    emitChange({
      wardId: ward?.id,
      wardCode: ward?.code,
      page: 1,
    });
  };

  const handleSportToggle = (sportId: string) => {
    const current = values.sportIds ?? [];
    const exists = current.includes(sportId);
    const next = exists ? current.filter((id) => id !== sportId) : [...current, sportId];
    onChange({
      ...values,
      sportIds: next.length > 0 ? next : undefined,
      page: 1,
    });
  };

  const handleAmenityToggle = (amenityId: string) => {
    const current = values.amenityIds ?? [];
    const exists = current.includes(amenityId);
    const next = exists ? current.filter((id) => id !== amenityId) : [...current, amenityId];
    onChange({
      ...values,
      amenityIds: next.length > 0 ? next : undefined,
      page: 1,
    });
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value ? Number(e.target.value) : undefined;
    onChange({
      ...values,
      maxPrice: val,
      page: 1,
    });
  };

  const handleRatingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value ? Number(e.target.value) : undefined;
    onChange({
      ...values,
      minRating: val,
      page: 1,
    });
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = (e.target.value || 'rating_desc') as VenueSort;
    onChange({
      ...values,
      sort: val,
      page: 1,
    });
  };

  return (
    <section
      aria-label="Bộ lọc tìm kiếm sân"
      className={cn(
        'rounded-card border border-border bg-bg-card p-4 text-text-primary shadow-xs',
        className,
      )}
    >
      {/* Tiêu đề cột sidebar (Phương án B) */}
      {isSidebar && (
        <div className="mb-4 flex items-center justify-between gap-2 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-primary-700 dark:text-primary-400" aria-hidden="true" />
            <span className="text-sm font-bold text-text-primary">Bộ lọc</span>
            {activeFiltersCount > 0 && (
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary-100 text-[11px] font-semibold text-primary-700 dark:bg-primary-950 dark:text-primary-300">
                {activeFiltersCount}
              </span>
            )}
          </div>
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex min-h-8 items-center gap-1 rounded-btn px-2 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-subtle hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
            >
              <RotateCcw className="size-3" aria-hidden="true" />
              <span>Xóa bộ lọc</span>
            </button>
          )}
        </div>
      )}

      {/* Hàng / Cột lọc nhanh cơ bản */}
      <div
        className={
          isSidebar
            ? 'grid grid-cols-1 gap-3.5'
            : 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4'
        }
      >
        {/* Tỉnh/Thành phố & Xã/Phường qua LocationSelector */}
        <div className={isSidebar ? undefined : 'sm:col-span-2'}>
          <LocationSelector
            provinceId={values.provinceId}
            provinceCode={values.provinceCode}
            wardId={values.wardId}
            wardCode={values.wardCode}
            onProvinceChange={handleProvinceChange}
            onWardChange={handleWardChange}
            disabled={isLoading}
            layout={isSidebar ? 'vertical' : 'horizontal'}
          />
        </div>

        {/* Mức giá trần */}
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-price" className="text-xs font-semibold text-text-secondary">
            Mức giá
          </label>
          <NativeSelect
            id="filter-price"
            aria-label="Mức giá"
            value={values.maxPrice ? String(values.maxPrice) : ''}
            onChange={handlePriceChange}
            disabled={isLoading}
            className="min-h-11"
          >
            {PRICE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </NativeSelect>
        </div>

        {/* Tiêu chí sắp xếp */}
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-sort" className="text-xs font-semibold text-text-secondary">
            Sắp xếp theo
          </label>
          <NativeSelect
            id="filter-sort"
            aria-label="Sắp xếp theo"
            value={values.sort ?? 'rating_desc'}
            onChange={handleSortChange}
            disabled={isLoading}
            className="min-h-11"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {/* Thanh công cụ phụ ở layout ngang: Nút Mở rộng bộ lọc & Đặt lại */}
      {!isSidebar && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAdvancedOpen((prev) => !prev)}
              aria-expanded={isAdvancedOpen}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-btn px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-subtle hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
            >
              <SlidersHorizontal className="size-3.5 text-text-secondary" aria-hidden="true" />
              <span>{isAdvancedOpen ? 'Thu gọn bộ lọc' : 'Bộ lọc nâng cao'}</span>
              {activeFiltersCount > 0 && (
                <span className="ml-1 inline-flex size-5 items-center justify-center rounded-full bg-primary-100 text-[11px] font-semibold text-primary-700 dark:bg-primary-950 dark:text-primary-300">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={onReset}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-btn px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-subtle hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
              >
                <RotateCcw className="size-3.5 text-text-secondary" aria-hidden="true" />
                <span>Xóa bộ lọc</span>
              </button>
            )}
          </div>

          {totalResults !== undefined && (
            <span className="text-xs text-text-secondary">
              Tìm thấy <strong className="font-semibold text-text-primary">{totalResults}</strong> cơ sở
            </span>
          )}
        </div>
      )}

      {/* Vùng bộ lọc nâng cao (luôn mở ở sidebar) */}
      {showAdvanced && (
        <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4">
          {/* Môn thể thao (chọn nhiều) */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-text-secondary">Môn thể thao</span>
            <div className="flex flex-wrap gap-2">
              {sports.map((sport) => {
                const isSelected = values.sportIds?.includes(sport.id) ?? false;
                return (
                  <button
                    key={sport.id}
                    type="button"
                    onClick={() => handleSportToggle(sport.id)}
                    aria-pressed={isSelected}
                    className={cn(
                      'inline-flex items-center rounded-btn px-3 py-1.5 text-xs font-medium transition-colors',
                      isSidebar ? 'min-h-9' : 'min-h-11',
                      isSelected
                        ? 'bg-primary-700 font-semibold text-white dark:bg-primary-600'
                        : 'border border-border bg-bg-card text-text-secondary hover:bg-bg-subtle hover:text-text-primary',
                    )}
                  >
                    {sport.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Đánh giá tối thiểu */}
          <div className={cn('flex flex-col gap-1.5', !isSidebar && 'sm:max-w-xs')}>
            <label htmlFor="filter-rating" className="text-xs font-semibold text-text-secondary">
              Đánh giá sao tối thiểu
            </label>
            <NativeSelect
              id="filter-rating"
              aria-label="Đánh giá sao tối thiểu"
              value={values.minRating ? String(values.minRating) : ''}
              onChange={handleRatingChange}
              disabled={isLoading}
              className="min-h-11"
            >
              {RATING_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </NativeSelect>
          </div>

          {/* Tiện ích sân */}
          {amenities.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-text-secondary">Tiện ích đi kèm</span>
              <div
                className={
                  isSidebar
                    ? 'grid grid-cols-1 gap-1.5'
                    : 'grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4'
                }
              >
                {amenities.map((amenity) => {
                  const isChecked = values.amenityIds?.includes(amenity.id) ?? false;
                  return (
                    <label
                      key={amenity.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-btn border p-2 text-xs transition-colors',
                        isSidebar ? 'min-h-10' : 'min-h-11',
                        isChecked
                          ? 'border-primary-600 bg-primary-50 font-medium text-primary-900 dark:border-primary-500 dark:bg-primary-950/40 dark:text-primary-200'
                          : 'border-border bg-bg-card text-text-secondary hover:bg-bg-subtle hover:text-text-primary',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleAmenityToggle(amenity.id)}
                        className="size-4 rounded-xs border-border text-primary-600 focus:ring-primary-500"
                      />
                      <span className="truncate">{amenity.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dòng ghi chú bản quyền & mốc dữ liệu ĐVHC */}
      <div
        className={cn(
          'mt-3 border-t border-border pt-2.5',
          isSidebar ? 'text-left' : 'text-right',
        )}
      >
        <p className="text-[11px] leading-relaxed text-text-disabled">
          Dữ liệu hành chính cập nhật đến 03/11/2026 — Nguồn: Tổng cục Thống kê &amp; CSDL Quốc gia về Đơn vị Hành chính
        </p>
      </div>
    </section>
  );
}
