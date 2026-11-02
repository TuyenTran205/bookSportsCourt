'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Filter, RotateCcw, SlidersHorizontal, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/select';
import {
  listAmenities,
  listDistricts,
  listProvinces,
  listSports,
  type VenueSort,
} from '@/lib/api/endpoints/venues';
import { cn } from '@/lib/utils/cn';

export interface VenueFilterValues {
  q?: string;
  provinceId?: string;
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
  className,
}: VenueFiltersProps) {
  const [isAdvancedOpen, setIsAdvancedOpen] = React.useState(false);

  // Danh mục Tỉnh/Thành
  const provincesQuery = useQuery({
    queryKey: ['catalogs', 'provinces'],
    queryFn: listProvinces,
    staleTime: 10 * 60 * 1000,
  });

  // Danh mục Quận/Huyện theo Tỉnh đã chọn
  const districtsQuery = useQuery({
    queryKey: ['catalogs', 'districts', values.provinceId],
    queryFn: () => listDistricts(values.provinceId!),
    enabled: Boolean(values.provinceId),
    staleTime: 5 * 60 * 1000,
  });

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

  const provinces = provincesQuery.data ?? [];
  const districts = districtsQuery.data ?? [];
  const sports = sportsQuery.data ?? [];
  const amenities = amenitiesQuery.data ?? [];

  // Đếm số lượng bộ lọc nâng cao đang áp dụng
  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (values.provinceId) count++;
    if (values.districtId) count++;
    if (values.sportIds && values.sportIds.length > 0) count += values.sportIds.length;
    if (values.amenityIds && values.amenityIds.length > 0) count += values.amenityIds.length;
    if (values.maxPrice) count++;
    if (values.minRating) count++;
    if (values.sort && values.sort !== 'rating_desc') count++;
    return count;
  }, [values]);

  const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextProvinceId = e.target.value || undefined;
    onChange({
      ...values,
      provinceId: nextProvinceId,
      districtId: undefined, // Reset quận khi đổi tỉnh
      page: 1,
    });
  };

  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({
      ...values,
      districtId: e.target.value || undefined,
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
      className={cn('rounded-card border border-neutral-200 bg-white p-4 shadow-xs', className)}
    >
      {/* Hàng lọc nhanh cơ bản */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Tỉnh/Thành phố */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="filter-province" className="text-xs font-semibold text-neutral-700">
            Tỉnh / Thành phố
          </label>
          <NativeSelect
            id="filter-province"
            aria-label="Tỉnh / Thành phố"
            value={values.provinceId ?? ''}
            onChange={handleProvinceChange}
            disabled={isLoading}
            className="min-h-11"
          >
            <option value="">Tất cả Tỉnh/Thành</option>
            {provinces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        </div>

        {/* Quận/Huyện */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="filter-district" className="text-xs font-semibold text-neutral-700">
            Quận / Huyện
          </label>
          <NativeSelect
            id="filter-district"
            aria-label="Quận / Huyện"
            value={values.districtId ?? ''}
            onChange={handleDistrictChange}
            disabled={isLoading || !values.provinceId}
            className="min-h-11"
          >
            <option value="">
              {values.provinceId ? 'Tất cả Quận/Huyện' : 'Chọn Tỉnh/Thành trước'}
            </option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </NativeSelect>
        </div>

        {/* Mức giá trần */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="filter-price" className="text-xs font-semibold text-neutral-700">
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
        <div className="flex flex-col gap-1.5">
          <label htmlFor="filter-sort" className="text-xs font-semibold text-neutral-700">
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

      {/* Thanh công cụ phụ: Nút Mở rộng bộ lọc & Đặt lại */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAdvancedOpen((prev) => !prev)}
            aria-expanded={isAdvancedOpen}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-btn px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
          >
            <SlidersHorizontal className="size-3.5 text-neutral-500" aria-hidden="true" />
            <span>{isAdvancedOpen ? 'Thu gọn bộ lọc' : 'Bộ lọc nâng cao'}</span>
            {activeFiltersCount > 0 && (
              <span className="ml-1 inline-flex size-5 items-center justify-center rounded-full bg-primary-100 text-[11px] font-semibold text-primary-700">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-btn px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
            >
              <RotateCcw className="size-3.5 text-neutral-400" aria-hidden="true" />
              <span>Xóa bộ lọc</span>
            </button>
          )}
        </div>

        {totalResults !== undefined && (
          <span className="text-xs text-neutral-500">
            Tìm thấy <strong className="font-semibold text-neutral-900">{totalResults}</strong> cơ sở
          </span>
        )}
      </div>

      {/* Vùng bộ lọc nâng cao */}
      {isAdvancedOpen && (
        <div className="mt-4 flex flex-col gap-4 border-t border-neutral-100 pt-4">
          {/* Môn thể thao (chọn nhiều) */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-neutral-700">Môn thể thao</span>
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
                      'inline-flex min-h-11 items-center rounded-btn px-3 py-1.5 text-xs font-medium transition-colors',
                      isSelected
                        ? 'bg-primary-700 text-white font-semibold'
                        : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50',
                    )}
                  >
                    {sport.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Đánh giá tối thiểu */}
          <div className="flex flex-col gap-1.5 sm:max-w-xs">
            <label htmlFor="filter-rating" className="text-xs font-semibold text-neutral-700">
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
              <span className="text-xs font-semibold text-neutral-700">Tiện ích đi kèm</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {amenities.map((amenity) => {
                  const isChecked = values.amenityIds?.includes(amenity.id) ?? false;
                  return (
                    <label
                      key={amenity.id}
                      className={cn(
                        'flex min-h-11 cursor-pointer items-center gap-2 rounded-btn border p-2 text-xs transition-colors',
                        isChecked
                          ? 'border-primary-600 bg-primary-50 text-primary-900 font-medium'
                          : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleAmenityToggle(amenity.id)}
                        className="size-4 rounded-xs border-neutral-300 text-primary-600 focus:ring-primary-500"
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
    </section>
  );
}
