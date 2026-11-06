'use client';

import * as React from 'react';
import { MapPin, Plus, Search } from 'lucide-react';
import { matchUnaccent } from '@bsc/shared';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { AreaFormDialog } from '@/components/features/admin/AreaFormDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAreasList } from '@/lib/hooks/useAdminCatalogs';

export function AreasCatalogTab() {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const areasQuery = useAreasList();

  const areas = areasQuery.data ?? [];
  const provinces = areas.filter((a) => a.type === 'province');
  const wards = areas.filter((a) => a.type === 'ward');
  const districts = areas.filter((a) => a.type === 'district');

  const filteredProvinces = React.useMemo(() => {
    if (!searchQuery.trim()) return provinces;
    return provinces.filter(
      (p) =>
        matchUnaccent(searchQuery, p.name) ||
        (p.code && p.code.includes(searchQuery)) ||
        p.slug.includes(searchQuery.toLowerCase()),
    );
  }, [provinces, searchQuery]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-3 dark:border-neutral-800">
        <div>
          <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            Mô hình ĐVHC 2 cấp (Mốc 03/11/2026)
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Tổng cộng: <strong className="font-semibold text-neutral-800 dark:text-neutral-200">{provinces.length} Tỉnh/Thành phố</strong>,{' '}
            <strong className="font-semibold text-neutral-800 dark:text-neutral-200">{wards.length} Xã/Phường/Đặc khu</strong>{' '}
            {districts.length > 0 && `(và ${districts.length} đơn vị quận/huyện legacy)`}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setDialogOpen(true)} size="sm">
            <Plus className="mr-1.5 size-4" />
            Thêm địa bàn
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm theo tên tỉnh hoặc mã..."
          className="pl-9 text-xs"
        />
      </div>

      {areasQuery.isPending ? (
        <Card className="p-4">
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </Card>
      ) : areasQuery.isError ? (
        <ErrorState
          error={areasQuery.error}
          onRetry={() => void areasQuery.refetch()}
        />
      ) : provinces.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="Chưa có dữ liệu địa bàn"
          description="Bấm 'Thêm địa bàn' để bắt đầu cấu hình danh mục khu vực."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {filteredProvinces.map((province) => {
            const provinceWards = areas.filter(
              (a) => a.type === 'ward' && a.parentId === province.id,
            );
            const provinceDistricts = areas.filter(
              (a) => a.type === 'district' && a.parentId === province.id,
            );

            return (
              <Card key={province.id} className="p-4">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-btn bg-primary-100 text-primary-700 dark:bg-primary-950 dark:text-primary-300">
                      <MapPin className="size-3.5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {province.name}{' '}
                        {province.code && (
                          <span className="font-mono text-xs font-normal text-neutral-400">
                            (Mã: {province.code})
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-neutral-500">Slug: {province.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-btn bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-950 dark:text-primary-300">
                      {provinceWards.length} xã/phường
                    </span>
                    {provinceDistricts.length > 0 && (
                      <span className="rounded-btn bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                        {provinceDistricts.length} quận (legacy)
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3">
                  <p className="mb-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Đơn vị cấp cơ sở trực thuộc ({provinceWards.length} xã/phường):
                  </p>
                  {provinceWards.length === 0 ? (
                    <p className="text-xs italic text-neutral-400">Chưa có đơn vị cấp cơ sở nào</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
                      {provinceWards.slice(0, 30).map((ward) => (
                        <div
                          key={ward.id}
                          className="flex items-center gap-1.5 rounded-btn border border-neutral-200 bg-neutral-50/50 px-2 py-0.5 text-xs text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-300"
                        >
                          <span className="font-medium">{ward.name}</span>
                          {ward.code && (
                            <span className="font-mono text-[10px] text-neutral-400">
                              #{ward.code}
                            </span>
                          )}
                        </div>
                      ))}
                      {provinceWards.length > 30 && (
                        <span className="self-center text-xs text-neutral-400">
                          +{provinceWards.length - 30} đơn vị khác...
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AreaFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}
