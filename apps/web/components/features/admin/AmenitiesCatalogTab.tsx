'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Pagination } from '@/components/common/Pagination';
import { AmenityFormDialog } from '@/components/features/admin/AmenityFormDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/errors';
import { useAmenitiesList, useDeleteAmenity } from '@/lib/hooks/useAdminCatalogs';
import { renderCatalogIcon } from './catalog-icons';

const AMENITIES_PAGE_SIZE = 10;

export function AmenitiesCatalogTab() {
  const tCommon = useTranslations('common');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [deletingAmenity, setDeletingAmenity] = React.useState<{ id: string; name: string } | null>(
    null,
  );

  const amenitiesQuery = useAmenitiesList();
  const deleteMutation = useDeleteAmenity();

  const amenities = amenitiesQuery.data ?? [];
  const totalPages = Math.max(1, Math.ceil(amenities.length / AMENITIES_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedAmenities = amenities.slice(
    (safePage - 1) * AMENITIES_PAGE_SIZE,
    safePage * AMENITIES_PAGE_SIZE,
  );

  const handleDelete = (id: string, name: string) => {
    setDeletingAmenity({ id, name });
  };

  const confirmDelete = async () => {
    if (!deletingAmenity) return;
    try {
      await deleteMutation.mutateAsync(deletingAmenity.id);
      toast.success(`Đã xoá tiện ích "${deletingAmenity.name}"`);
      setDeletingAmenity(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tCommon('error'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          Danh mục tiện ích tiêu chuẩn áp dụng cho các cơ sở thể thao ({amenities.length} tiện ích).
        </p>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus className="mr-1.5 size-4" />
          Thêm tiện ích
        </Button>
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
          description="Bấm 'Thêm tiện ích' để bắt đầu định nghĩa danh mục tiện ích cho cơ sở."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-subtle text-xs font-semibold uppercase text-text-secondary">
                  <th className="py-3 px-4">Tên tiện ích</th>
                  <th className="py-3 px-4">Số cơ sở áp dụng</th>
                  <th className="py-3 px-4 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedAmenities.map((amenity) => (
                  <tr key={amenity.id} className="hover:bg-bg-subtle/60">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-8 items-center justify-center rounded-btn bg-bg-subtle text-text-secondary">
                          {renderCatalogIcon(amenity.icon, Sparkles)}
                        </div>
                        <span className="font-semibold text-text-primary">
                          {amenity.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          (amenity.venueCount ?? 0) > 0
                            ? 'bg-primary-50 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300'
                            : 'bg-bg-subtle text-text-secondary'
                        }`}
                      >
                        {(amenity.venueCount ?? 0) > 0
                          ? `${amenity.venueCount} cơ sở`
                          : 'Chưa có cơ sở nào'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={deleteMutation.isPending}
                        onClick={() => handleDelete(amenity.id, amenity.name)}
                        className="text-danger hover:bg-danger/10 hover:text-danger"
                        title="Xoá tiện ích"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border px-4 py-3">
            <Pagination
              page={safePage}
              totalPages={totalPages}
              total={amenities.length}
              limit={AMENITIES_PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        </Card>
      )}

      <AmenityFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />

      <ConfirmDialog
        open={deletingAmenity !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingAmenity(null);
        }}
        variant="danger"
        title="Xác nhận xoá tiện ích"
        description={
          deletingAmenity && (
            <>
              Bạn có chắc chắn muốn xoá tiện ích{' '}
              <span className="font-semibold text-text-primary">
                &ldquo;{deletingAmenity.name}&rdquo;
              </span>
              ?
            </>
          )
        }
        confirmLabel="Xoá tiện ích"
        isPending={deleteMutation.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
