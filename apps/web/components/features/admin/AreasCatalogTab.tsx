'use client';

import * as React from 'react';
import { MapPin, Plus } from 'lucide-react';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { AreaFormDialog } from '@/components/features/admin/AreaFormDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAreasList } from '@/lib/hooks/useAdminCatalogs';

export function AreasCatalogTab() {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const areasQuery = useAreasList();

  const areas = areasQuery.data ?? [];
  const provinces = areas.filter((a) => a.type === 'province');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-600">
          Danh mục Tỉnh/Thành phố và Quận/Huyện phục vụ tìm kiếm địa bàn ({provinces.length} tỉnh/thành).
        </p>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus className="mr-1.5 size-4" />
          Thêm địa bàn
        </Button>
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
          {provinces.map((province) => {
            const districts = areas.filter(
              (a) => a.type === 'district' && a.parentId === province.id,
            );

            return (
              <Card key={province.id} className="p-4">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-btn bg-primary-100 text-primary-700">
                      <MapPin className="size-3.5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-neutral-900">{province.name}</h4>
                      <p className="text-xs text-neutral-500">Slug: {province.slug}</p>
                    </div>
                  </div>
                  <span className="rounded-btn bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                    {districts.length} quận/huyện
                  </span>
                </div>

                <div className="mt-3">
                  <p className="mb-2 text-xs font-semibold uppercase text-neutral-500">
                    Quận / Huyện trực thuộc:
                  </p>
                  {districts.length === 0 ? (
                    <p className="text-xs italic text-neutral-400">Chưa có quận/huyện nào</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {districts.map((district) => (
                        <div
                          key={district.id}
                          className="flex items-center gap-1.5 rounded-btn border border-neutral-200 bg-neutral-50/50 px-2.5 py-1 text-xs text-neutral-700"
                        >
                          <span className="font-medium">{district.name}</span>
                          <span className="text-[11px] text-neutral-400 font-mono">({district.slug})</span>
                        </div>
                      ))}
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
