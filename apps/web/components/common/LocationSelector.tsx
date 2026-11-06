'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Loader2, MapPin, Search, X } from 'lucide-react';
import type { Province, Ward } from '@bsc/shared';
import { PROVINCES, matchUnaccent } from '@bsc/shared';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { listProvinces, listWards } from '@/lib/api/endpoints/venues';
import { cn } from '@/lib/utils/cn';

export interface LocationSelectorProps {
  provinceId?: string;
  provinceCode?: string;
  wardId?: string;
  wardCode?: string;
  onProvinceChange: (province: Province | null) => void;
  onWardChange: (ward: Ward | null) => void;
  disabled?: boolean;
  error?: {
    province?: string;
    ward?: string;
  };
  layout?: 'horizontal' | 'vertical' | 'compact';
  showFooterNotice?: boolean;
  className?: string;
}

export function LocationSelector({
  provinceId,
  provinceCode,
  wardId,
  wardCode,
  onProvinceChange,
  onWardChange,
  disabled = false,
  error,
  layout = 'horizontal',
  showFooterNotice = false,
  className,
}: LocationSelectorProps) {
  const provinceInputRef = React.useRef<HTMLInputElement>(null);
  const wardInputRef = React.useRef<HTMLInputElement>(null);

  // ── 1. Danh sách 34 Tỉnh/Thành ─────────────────────────────────────────────
  const provincesQuery = useQuery({
    queryKey: ['catalogs', 'provinces'],
    queryFn: listProvinces,
    initialData: PROVINCES,
    initialDataUpdatedAt: 0,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const provinces = React.useMemo(() => provincesQuery.data ?? PROVINCES, [provincesQuery.data]);

  // Tìm tỉnh đang được chọn
  const selectedProvince = React.useMemo(() => {
    if (provinceId) {
      return provinces.find((p) => p.id === provinceId) ?? null;
    }
    if (provinceCode) {
      return provinces.find((p) => p.code === provinceCode) ?? null;
    }
    return null;
  }, [provinces, provinceId, provinceCode]);

  // Mã định danh tỉnh dùng để truy vấn xã/phường
  const activeProvinceTarget = selectedProvince?.code ?? selectedProvince?.id ?? provinceCode ?? provinceId;

  // ── 2. Danh sách Xã/Phường theo Tỉnh ────────────────────────────────────────
  const [provinceOpen, setProvinceOpen] = React.useState(false);
  const [provinceSearch, setProvinceSearch] = React.useState('');
  const [provinceActiveIndex, setProvinceActiveIndex] = React.useState(0);

  const [wardOpen, setWardOpen] = React.useState(false);
  const [wardSearch, setWardSearch] = React.useState('');
  const [debouncedWardSearch, setDebouncedWardSearch] = React.useState('');
  const [wardActiveIndex, setWardActiveIndex] = React.useState(0);

  // Debounce 250ms cho tìm kiếm xã
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedWardSearch(wardSearch.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [wardSearch]);

  const wardsQuery = useQuery({
    queryKey: ['catalogs', 'wards', activeProvinceTarget, debouncedWardSearch],
    queryFn: () => listWards(activeProvinceTarget!, { q: debouncedWardSearch || undefined, limit: 50 }),
    enabled: Boolean(activeProvinceTarget),
    staleTime: 30 * 60 * 1000,
  });

  const wards = React.useMemo(() => wardsQuery.data ?? [], [wardsQuery.data]);

  // Tìm xã đang được chọn
  const selectedWard = React.useMemo(() => {
    if (wardId) {
      return wards.find((w) => w.id === wardId) ?? null;
    }
    if (wardCode) {
      return wards.find((w) => w.code === wardCode) ?? null;
    }
    return null;
  }, [wards, wardId, wardCode]);

  // Lọc tỉnh in-memory theo từ khoá (unaccent)
  const filteredProvinces = React.useMemo(() => {
    if (!provinceSearch.trim()) return provinces;
    return provinces.filter((p) => matchUnaccent(provinceSearch, p.name) || (p.code && p.code.includes(provinceSearch)));
  }, [provinces, provinceSearch]);

  // Reset index khi tìm kiếm thay đổi
  React.useEffect(() => {
    setProvinceActiveIndex(0);
  }, [provinceSearch]);

  React.useEffect(() => {
    setWardActiveIndex(0);
  }, [debouncedWardSearch]);

  const handleSelectProvince = (p: Province) => {
    onProvinceChange(p);
    onWardChange(null); // Luôn reset xã khi đổi tỉnh (TC-LOC-02)
    setProvinceOpen(false);
    setProvinceSearch('');
  };

  const handleClearProvince = (e: React.MouseEvent) => {
    e.stopPropagation();
    onProvinceChange(null);
    onWardChange(null);
    setProvinceSearch('');
  };

  const handleSelectWard = (w: Ward) => {
    onWardChange(w);
    setWardOpen(false);
    setWardSearch('');
  };

  const handleClearWard = (e: React.MouseEvent) => {
    e.stopPropagation();
    onWardChange(null);
    setWardSearch('');
  };

  // Keyboard navigation cho Province list
  const handleProvinceKeyDown = (e: React.KeyboardEvent) => {
    if (!provinceOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setProvinceActiveIndex((prev) => (prev < filteredProvinces.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setProvinceActiveIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filteredProvinces[provinceActiveIndex];
      if (target) handleSelectProvince(target);
    } else if (e.key === 'Escape') {
      setProvinceOpen(false);
    }
  };

  // Keyboard navigation cho Ward list
  const handleWardKeyDown = (e: React.KeyboardEvent) => {
    if (!wardOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setWardActiveIndex((prev) => (prev < wards.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setWardActiveIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = wards[wardActiveIndex];
      if (target) handleSelectWard(target);
    } else if (e.key === 'Escape') {
      setWardOpen(false);
    }
  };

  const layoutClass =
    layout === 'horizontal'
      ? 'grid grid-cols-1 sm:grid-cols-2 gap-3'
      : layout === 'compact'
        ? 'grid grid-cols-1 gap-2'
        : 'flex flex-col gap-3';

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className={layoutClass}>
        {/* ── CỘT 1: TỈNH / THÀNH PHỐ ────────────────────────────────────── */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="location-province-btn"
            className="text-xs font-semibold text-text-secondary"
          >
            Tỉnh / Thành phố
          </label>
          <Popover open={provinceOpen} onOpenChange={setProvinceOpen}>
            <PopoverTrigger asChild>
              <button
                id="location-province-btn"
                type="button"
                role="combobox"
                aria-expanded={provinceOpen}
                aria-controls="location-province-listbox"
                aria-haspopup="listbox"
                aria-label="Tỉnh / Thành phố"
                disabled={disabled}
                className={cn(
                  'flex min-h-11 w-full items-center justify-between rounded-btn border border-border bg-bg-card px-3 py-2 text-left text-xs text-text-primary transition-colors',
                  'hover:border-neutral-400 dark:hover:border-neutral-500',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:border-transparent',
                  disabled && 'cursor-not-allowed opacity-50 bg-bg-subtle text-text-disabled',
                  error?.province && 'border-danger text-danger focus-visible:ring-danger',
                )}
              >
                <span className="flex items-center gap-2 truncate">
                  <MapPin className="size-4 shrink-0 text-text-secondary" aria-hidden="true" />
                  <span className={cn('truncate', !selectedProvince ? 'text-text-disabled' : 'text-text-primary')}>
                    {selectedProvince ? selectedProvince.name : 'Chọn Tỉnh / Thành phố'}
                  </span>
                </span>
                <div className="flex items-center gap-1">
                  {selectedProvince && !disabled && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={handleClearProvince}
                      onKeyDown={(e) => e.key === 'Enter' && handleClearProvince(e as unknown as React.MouseEvent)}
                      className="rounded-xs p-0.5 text-text-secondary hover:text-text-primary"
                      aria-label="Xóa chọn tỉnh"
                    >
                      <X className="size-3.5" />
                    </span>
                  )}
                  <ChevronsUpDown className="size-4 shrink-0 text-text-secondary" aria-hidden="true" />
                </div>
              </button>
            </PopoverTrigger>

            <PopoverContent
              className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0 shadow-lg border border-border bg-bg-card text-text-primary"
              align="start"
              onOpenAutoFocus={(e) => {
                e.preventDefault();
                provinceInputRef.current?.focus();
              }}
              onKeyDown={handleProvinceKeyDown}
            >
              <div className="flex items-center border-b border-border px-2.5">
                <Search className="size-4 shrink-0 text-text-secondary" aria-hidden="true" />
                <input
                  ref={provinceInputRef}
                  type="text"
                  value={provinceSearch}
                  onChange={(e) => setProvinceSearch(e.target.value)}
                  placeholder="Tìm kiếm 34 tỉnh/thành..."
                  className="min-h-10 w-full bg-transparent px-2 text-xs text-text-primary outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-text-disabled"
                />
              </div>

              <div
                id="location-province-listbox"
                role="listbox"
                aria-label="Danh sách Tỉnh / Thành phố"
                className="max-h-60 overflow-y-auto p-1 text-xs"
              >
                {filteredProvinces.length === 0 ? (
                  <div className="py-6 text-center text-xs text-text-disabled">
                    Không tìm thấy tỉnh/thành phố nào
                  </div>
                ) : (
                  filteredProvinces.map((p, idx) => {
                    const isSelected = selectedProvince?.id === p.id || selectedProvince?.code === p.code;
                    const isActive = idx === provinceActiveIndex;
                    return (
                      <div
                        key={p.id || p.code}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelectProvince(p)}
                        onMouseEnter={() => setProvinceActiveIndex(idx)}
                        className={cn(
                          'flex min-h-9 cursor-pointer items-center justify-between rounded-xs px-2.5 py-1.5 transition-colors',
                          isActive && 'bg-bg-subtle text-text-primary',
                          isSelected && 'font-semibold text-primary-700 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/40',
                          !isActive && !isSelected && 'text-text-primary hover:bg-bg-subtle',
                        )}
                      >
                        <span className="truncate">{p.name}</span>
                        {isSelected && <Check className="size-3.5 shrink-0 text-primary-700 dark:text-primary-400" />}
                      </div>
                    );
                  })
                )}
              </div>
            </PopoverContent>
          </Popover>
          {error?.province && (
            <p className="text-xs text-danger" role="alert">
              {error.province}
            </p>
          )}
        </div>

        {/* ── CỘT 2: XÃ / PHƯỜNG / ĐẶC KHU ─────────────────────────────────── */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="location-ward-btn"
            className="text-xs font-semibold text-text-secondary"
          >
            Xã / Phường / Đặc khu
          </label>
          <Popover open={wardOpen} onOpenChange={setWardOpen}>
            <PopoverTrigger asChild>
              <button
                id="location-ward-btn"
                type="button"
                role="combobox"
                aria-expanded={wardOpen}
                aria-controls="location-ward-listbox"
                aria-haspopup="listbox"
                aria-label="Xã / Phường / Đặc khu"
                disabled={disabled || !activeProvinceTarget}
                className={cn(
                  'flex min-h-11 w-full items-center justify-between rounded-btn border border-border bg-bg-card px-3 py-2 text-left text-xs text-text-primary transition-colors',
                  'hover:border-neutral-400 dark:hover:border-neutral-500',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:border-transparent',
                  (!activeProvinceTarget || disabled) && 'cursor-not-allowed opacity-50 bg-bg-subtle text-text-disabled',
                  error?.ward && 'border-danger text-danger focus-visible:ring-danger',
                )}
              >
                <span className="flex items-center gap-2 truncate">
                  <MapPin className="size-4 shrink-0 text-text-secondary" aria-hidden="true" />
                  <span className={cn('truncate', !selectedWard ? 'text-text-disabled' : 'text-text-primary')}>
                    {!activeProvinceTarget
                      ? 'Chọn Tỉnh/Thành trước'
                      : wardsQuery.isLoading
                        ? 'Đang nạp dữ liệu xã/phường...'
                        : selectedWard
                          ? selectedWard.name
                          : 'Tất cả Xã / Phường'}
                  </span>
                </span>
                <div className="flex items-center gap-1">
                  {wardsQuery.isFetching && activeProvinceTarget && (
                    <Loader2 className="size-3.5 animate-spin text-text-secondary" />
                  )}
                  {selectedWard && !disabled && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={handleClearWard}
                      onKeyDown={(e) => e.key === 'Enter' && handleClearWard(e as unknown as React.MouseEvent)}
                      className="rounded-xs p-0.5 text-text-secondary hover:text-text-primary"
                      aria-label="Xóa chọn xã"
                    >
                      <X className="size-3.5" />
                    </span>
                  )}
                  <ChevronsUpDown className="size-4 shrink-0 text-text-secondary" aria-hidden="true" />
                </div>
              </button>
            </PopoverTrigger>

            <PopoverContent
              className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0 shadow-lg border border-border bg-bg-card text-text-primary"
              align="start"
              onOpenAutoFocus={(e) => {
                e.preventDefault();
                wardInputRef.current?.focus();
              }}
              onKeyDown={handleWardKeyDown}
            >
              <div className="flex items-center border-b border-border px-2.5">
                <Search className="size-4 shrink-0 text-text-secondary" aria-hidden="true" />
                <input
                  ref={wardInputRef}
                  type="text"
                  value={wardSearch}
                  onChange={(e) => setWardSearch(e.target.value)}
                  placeholder={`Tìm xã/phường tại ${selectedProvince?.name ?? 'tỉnh'}...`}
                  className="min-h-10 w-full bg-transparent px-2 text-xs text-text-primary outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-text-disabled"
                />
              </div>

              <div
                id="location-ward-listbox"
                role="listbox"
                aria-label="Danh sách Xã / Phường"
                className="max-h-60 overflow-y-auto p-1 text-xs"
              >
                {wardsQuery.isLoading ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-xs text-text-disabled">
                    <Loader2 className="size-4 animate-spin text-primary-600" />
                    <span>Đang tìm kiếm dữ liệu...</span>
                  </div>
                ) : wards.length === 0 ? (
                  <div className="py-6 text-center text-xs text-text-disabled">
                    {debouncedWardSearch
                      ? `Không có kết quả khớp với "${debouncedWardSearch}"`
                      : 'Không có dữ liệu xã/phường'}
                  </div>
                ) : (
                  <>
                    {wards.map((w, idx) => {
                      const isSelected = selectedWard?.id === w.id || selectedWard?.code === w.code;
                      const isActive = idx === wardActiveIndex;
                      return (
                        <div
                          key={w.id || w.code}
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => handleSelectWard(w)}
                          onMouseEnter={() => setWardActiveIndex(idx)}
                          className={cn(
                            'flex min-h-9 cursor-pointer items-center justify-between rounded-xs px-2.5 py-1.5 transition-colors',
                            isActive && 'bg-bg-subtle text-text-primary',
                            isSelected && 'font-semibold text-primary-700 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/40',
                            !isActive && !isSelected && 'text-text-primary hover:bg-bg-subtle',
                          )}
                        >
                          <span className="truncate">{w.name}</span>
                          {isSelected && <Check className="size-3.5 shrink-0 text-primary-700 dark:text-primary-400" />}
                        </div>
                      );
                    })}
                    {wards.length >= 50 && (
                      <div className="border-t border-border p-2 text-center text-[11px] text-text-disabled">
                        Hiển thị 50 kết quả đầu tiên (gõ thêm để lọc chính xác)
                      </div>
                    )}
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>
          {error?.ward && (
            <p className="text-xs text-danger" role="alert">
              {error.ward}
            </p>
          )}
        </div>
      </div>

      {showFooterNotice && (
        <div className="mt-1 text-right">
          <p className="text-[11px] text-text-disabled">
            Dữ liệu hành chính cập nhật đến 03/11/2026 — Nguồn: Tổng cục Thống kê & CSDL Quốc gia về Đơn vị Hành chính
          </p>
        </div>
      )}
    </div>
  );
}
