'use client';

import * as React from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Building2, Check, Eye, X } from 'lucide-react';
import { toast } from 'sonner';
import type { AdminVenueRow } from '@/lib/api/endpoints/admin';

import { Pagination } from '@/components/common/Pagination';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { RejectVenueDialog } from '@/components/features/admin/RejectVenueDialog';
import { VenueReviewDrawer } from '@/components/features/admin/VenueReviewDrawer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { ApiError } from '@/lib/api/errors';
import { useAdminVenues, useReviewVenue } from '@/lib/hooks/useAdminVenues';

export function AdminVenuesScreen() {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');

  const [page, setPage] = React.useState(1);
  const [statusFilter, setStatusFilter] = React.useState<string | undefined>(undefined);
  const [viewingVenue, setViewingVenue] = React.useState<AdminVenueRow | null>(null);
  const [rejectingVenue, setRejectingVenue] = React.useState<AdminVenueRow | null>(null);

  const venuesQuery = useAdminVenues({
    page,
    limit: 10,
    status: statusFilter,
  });

  const reviewMutation = useReviewVenue();

  const venues = venuesQuery.data?.data ?? [];
  const meta = venuesQuery.data?.meta;

  const handleUpdateStatus = async (
    venue: AdminVenueRow,
    status: 'approved' | 'suspended',
    label: string,
  ) => {
    if (!window.confirm(`Bạn có chắc chắn muốn ${label} cơ sở "${venue.name}"?`)) return;
    try {
      await reviewMutation.mutateAsync({
        id: venue.id,
        status,
      });
      toast.success(`Đã cập nhật trạng thái cơ sở thành công`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tCommon('error'));
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t('venues')}
        description="Kiểm tra thông tin địa chỉ, sân con và phê duyệt các cơ sở thể thao trên toàn hệ thống."
      />

      {/* Bộ lọc trạng thái */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Button
          variant={statusFilter === undefined ? 'primary' : 'outline'}
          size="sm"
          onClick={() => {
            setStatusFilter(undefined);
            setPage(1);
          }}
        >
          Tất cả
        </Button>
        <Button
          variant={statusFilter === 'pending' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => {
            setStatusFilter('pending');
            setPage(1);
          }}
        >
          Chờ duyệt
        </Button>
        <Button
          variant={statusFilter === 'approved' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => {
            setStatusFilter('approved');
            setPage(1);
          }}
        >
          Hoạt động
        </Button>
        <Button
          variant={statusFilter === 'rejected' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => {
            setStatusFilter('rejected');
            setPage(1);
          }}
        >
          Bị từ chối
        </Button>
        <Button
          variant={statusFilter === 'suspended' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => {
            setStatusFilter('suspended');
            setPage(1);
          }}
        >
          Tạm đình chỉ
        </Button>
      </div>

      {venuesQuery.isPending ? (
        <Card className="p-4">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        </Card>
      ) : venuesQuery.isError ? (
        <ErrorState
          error={venuesQuery.error}
          onRetry={() => void venuesQuery.refetch()}
        />
      ) : venues.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Không tìm thấy cơ sở nào"
          description="Hiện không có cơ sở thể thao nào khớp với bộ lọc đã chọn."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50/50 text-xs font-semibold uppercase text-neutral-500">
                    <th className="py-3 px-4">Cơ sở thể thao</th>
                    <th className="py-3 px-4">Chủ sở hữu</th>
                    <th className="py-3 px-4">Địa bàn</th>
                    <th className="py-3 px-4">Môn thể thao</th>
                    <th className="py-3 px-4 text-center">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {venues.map((venue) => (
                    <tr key={venue.id} className="hover:bg-neutral-50/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative size-10 shrink-0 overflow-hidden rounded bg-neutral-100">
                            {venue.coverUrl ? (
                              <Image
                                src={venue.coverUrl}
                                alt={venue.name}
                                fill
                                unoptimized={venue.coverUrl.startsWith('data:')}
                                sizes="40px"
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex size-full items-center justify-center text-neutral-400">
                                <Building2 className="size-5" />
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-neutral-900">{venue.name}</p>
                            <p className="text-xs text-neutral-500 line-clamp-1">{venue.address}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-neutral-800">{venue.ownerName}</p>
                      </td>
                      <td className="py-3 px-4 text-xs text-neutral-600">
                        {venue.district?.name ?? ''}
                        {venue.province ? `, ${venue.province.name}` : ''}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {venue.sports.map((s) => (
                            <span
                              key={s.id}
                              className="rounded-btn bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-neutral-700"
                            >
                              {s.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <StatusBadge kind="venue" status={venue.status} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setViewingVenue(venue)}
                            title="Xem chi tiết cơ sở"
                          >
                            <Eye className="size-4" />
                          </Button>

                          {venue.status === 'pending' ? (
                            <>
                              <Button
                                size="sm"
                                disabled={reviewMutation.isPending}
                                onClick={() => handleUpdateStatus(venue, 'approved', 'duyệt')}
                                className="bg-primary-600 hover:bg-primary-700"
                              >
                                <Check className="mr-1 size-3.5" />
                                Duyệt
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={reviewMutation.isPending}
                                onClick={() => setRejectingVenue(venue)}
                                className="text-danger hover:bg-danger/10 hover:text-danger"
                              >
                                <X className="mr-1 size-3.5" />
                                Từ chối
                              </Button>
                            </>
                          ) : venue.status === 'approved' ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={reviewMutation.isPending}
                              onClick={() => handleUpdateStatus(venue, 'suspended', 'tạm đình chỉ')}
                              className="text-amber-700 hover:bg-amber-100"
                              title="Tạm đình chỉ hoạt động cơ sở"
                            >
                              <AlertTriangle className="size-4" />
                            </Button>
                          ) : venue.status === 'suspended' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={reviewMutation.isPending}
                              onClick={() => handleUpdateStatus(venue, 'approved', 'mở lại hoạt động')}
                            >
                              Mở lại
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {meta && (
            <Pagination
              meta={meta}
              onPageChange={setPage}
            />
          )}
        </div>
      )}

      <VenueReviewDrawer
        venue={viewingVenue}
        open={viewingVenue !== null}
        onClose={() => setViewingVenue(null)}
      />

      <RejectVenueDialog
        venue={rejectingVenue}
        open={rejectingVenue !== null}
        onClose={() => setRejectingVenue(null)}
      />
    </div>
  );
}
