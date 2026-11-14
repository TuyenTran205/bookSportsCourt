'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Activity, Plus, Trash2, Trophy } from 'lucide-react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Pagination } from '@/components/common/Pagination';
import { SportFormDialog } from '@/components/features/admin/SportFormDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/errors';
import { useDeleteSport, useSportsList } from '@/lib/hooks/useAdminCatalogs';
import { renderCatalogIcon } from './catalog-icons';

const SPORTS_PAGE_SIZE = 10;

export function SportsCatalogTab() {
  const tCommon = useTranslations('common');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [deletingSport, setDeletingSport] = React.useState<{ id: string; name: string } | null>(
    null,
  );

  const sportsQuery = useSportsList();
  const deleteMutation = useDeleteSport();

  const sports = sportsQuery.data ?? [];
  const totalPages = Math.max(1, Math.ceil(sports.length / SPORTS_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedSports = sports.slice(
    (safePage - 1) * SPORTS_PAGE_SIZE,
    safePage * SPORTS_PAGE_SIZE,
  );

  const handleDelete = (id: string, name: string) => {
    setDeletingSport({ id, name });
  };

  const confirmDelete = async () => {
    if (!deletingSport) return;
    try {
      await deleteMutation.mutateAsync(deletingSport.id);
      toast.success(`Đã xoá môn "${deletingSport.name}"`);
      setDeletingSport(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tCommon('error'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          Danh sách các bộ môn thể thao được hỗ trợ trên nền tảng ({sports.length} môn).
        </p>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus className="mr-1.5 size-4" />
          Thêm môn thể thao
        </Button>
      </div>

      {sportsQuery.isPending ? (
        <Card className="p-4">
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </Card>
      ) : sportsQuery.isError ? (
        <ErrorState
          error={sportsQuery.error}
          onRetry={() => void sportsQuery.refetch()}
        />
      ) : sports.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Chưa có môn thể thao nào"
          description="Bấm 'Thêm môn thể thao' để bắt đầu định nghĩa danh mục."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-subtle text-xs font-semibold uppercase text-text-secondary">
                  <th className="py-3 px-4">Tên môn thể thao</th>
                  <th className="py-3 px-4">Số cơ sở kinh doanh</th>
                  <th className="py-3 px-4 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedSports.map((sport) => (
                  <tr key={sport.id} className="hover:bg-bg-subtle/60">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-8 items-center justify-center rounded-btn bg-primary-50 text-primary-600 dark:bg-primary-950/60 dark:text-primary-400">
                          {renderCatalogIcon(sport.icon, Activity)}
                        </div>
                        <span className="font-semibold text-text-primary">
                          {sport.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          (sport.venueCount ?? 0) > 0
                            ? 'bg-primary-50 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300'
                            : 'bg-bg-subtle text-text-secondary'
                        }`}
                      >
                        {(sport.venueCount ?? 0) > 0
                          ? `${sport.venueCount} cơ sở`
                          : 'Chưa có cơ sở nào'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={deleteMutation.isPending}
                        onClick={() => handleDelete(sport.id, sport.name)}
                        className="text-danger hover:bg-danger/10 hover:text-danger"
                        title="Xoá môn thể thao"
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
              total={sports.length}
              limit={SPORTS_PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        </Card>
      )}

      <SportFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />

      <ConfirmDialog
        open={deletingSport !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingSport(null);
        }}
        variant="danger"
        title="Xác nhận xoá môn thể thao"
        description={
          deletingSport && (
            <>
              Bạn có chắc chắn muốn xoá môn thể thao{' '}
              <span className="font-semibold text-text-primary">
                &ldquo;{deletingSport.name}&rdquo;
              </span>
              ?
            </>
          )
        }
        confirmLabel="Xoá môn thể thao"
        isPending={deleteMutation.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
