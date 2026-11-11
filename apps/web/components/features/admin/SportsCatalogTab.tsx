'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Activity, Plus, Trash2, Trophy } from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { SportFormDialog } from '@/components/features/admin/SportFormDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/errors';
import { useDeleteSport, useSportsList } from '@/lib/hooks/useAdminCatalogs';
import { renderCatalogIcon } from './catalog-icons';

export function SportsCatalogTab() {
  const tCommon = useTranslations('common');
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const sportsQuery = useSportsList();
  const deleteMutation = useDeleteSport();

  const sports = sportsQuery.data ?? [];

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xoá môn thể thao "${name}"?`)) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success(`Đã xoá môn "${name}"`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tCommon('error'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
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
                <tr className="border-b border-neutral-200 bg-neutral-50/50 text-xs font-semibold uppercase text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-400">
                  <th className="py-3 px-4">Tên môn thể thao</th>
                  <th className="py-3 px-4">Số cơ sở kinh doanh</th>
                  <th className="py-3 px-4 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {sports.map((sport) => (
                  <tr key={sport.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-8 items-center justify-center rounded-btn bg-primary-50 text-primary-600 dark:bg-primary-950/60 dark:text-primary-400">
                          {renderCatalogIcon(sport.icon, Activity)}
                        </div>
                        <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                          {sport.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          (sport.venueCount ?? 0) > 0
                            ? 'bg-primary-50 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300'
                            : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
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
        </Card>
      )}

      <SportFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}
