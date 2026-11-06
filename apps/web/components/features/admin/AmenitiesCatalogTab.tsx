'use client';

import * as React from 'react';
import { Sparkles } from 'lucide-react';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAmenitiesList } from '@/lib/hooks/useAdminCatalogs';

export function AmenitiesCatalogTab() {
  const amenitiesQuery = useAmenitiesList();
  const amenities = amenitiesQuery.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-600">
          Danh mục tiện ích tiêu chuẩn áp dụng cho các cơ sở thể thao ({amenities.length} tiện ích).
        </p>
      </div>

      {amenitiesQuery.isPending ? (
        <Card className="p-4">
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </Card>
      ) : amenitiesQuery.isError ? (
        <ErrorState
          error={amenitiesQuery.error}
          onRetry={() => void amenitiesQuery.refetch()}
        />
      ) : amenities.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Chưa có tiện ích nào"
          description="Hệ thống chưa có danh mục tiện ích được cấu hình."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/50 text-xs font-semibold uppercase text-neutral-500">
                  <th className="py-3 px-4">Tên tiện ích</th>
                  <th className="py-3 px-4">Đường dẫn tĩnh (Slug)</th>
                  <th className="py-3 px-4">Mã biểu tượng (Icon)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {amenities.map((amenity) => (
                  <tr key={amenity.id} className="hover:bg-neutral-50/50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-8 items-center justify-center rounded-btn bg-neutral-100 text-neutral-600">
                          <Sparkles className="size-4" />
                        </div>
                        <span className="font-semibold text-neutral-900">{amenity.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-neutral-500">{amenity.slug}</td>
                    <td className="py-3 px-4 text-xs font-mono text-neutral-600">
                      {amenity.icon ?? 'sparkles'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
