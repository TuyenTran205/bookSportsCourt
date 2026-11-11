'use client';

import * as React from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Building2, Check, Eye, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import type { AdminVenueRow } from '@/lib/api/endpoints/admin';
import { createOwnerVenue, updateOwnerVenue, uploadVenueImage } from '@/lib/api/endpoints/owner';

import { Pagination } from '@/components/common/Pagination';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { RejectVenueDialog } from '@/components/features/admin/RejectVenueDialog';
import { VenueReviewDrawer } from '@/components/features/admin/VenueReviewDrawer';
import { DeleteVenueDialog } from '@/components/features/admin/DeleteVenueDialog';
import { VenueFormDialog, type VenueFormInput } from '@/components/features/owner/venues/VenueFormDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { ApiError } from '@/lib/api/errors';
import { adminVenuesQueryKeys, useAdminVenues, useReviewVenue } from '@/lib/hooks/useAdminVenues';
import { useSportsList } from '@/lib/hooks/useAdminCatalogs';

export function AdminVenuesScreen() {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();

  const [page, setPage] = React.useState(1);
  const [statusFilter, setStatusFilter] = React.useState<string | undefined>(undefined);
  const [viewingVenue, setViewingVenue] = React.useState<AdminVenueRow | null>(null);
  const [rejectingVenue, setRejectingVenue] = React.useState<AdminVenueRow | null>(null);
  const [editingVenue, setEditingVenue] = React.useState<AdminVenueRow | null>(null);
  const [deletingVenue, setDeletingVenue] = React.useState<AdminVenueRow | null>(null);
  const [isVenueFormOpen, setIsVenueFormOpen] = React.useState(false);
  const [isSavingVenue, setIsSavingVenue] = React.useState(false);

  const venuesQuery = useAdminVenues({
    page,
    limit: 10,
    status: statusFilter,
  });

  const reviewMutation = useReviewVenue();
  const sportsQuery = useSportsList();

  const sportsMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const sport of sportsQuery.data ?? []) {
      map.set(sport.id, sport.name);
    }
    return map;
  }, [sportsQuery.data]);

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

  const handleSaveVenue = async (input: VenueFormInput) => {
    setIsSavingVenue(true);
    try {
      if (editingVenue) {
        await updateOwnerVenue(editingVenue.id, {
          name: input.name,
          address: input.address,
          provinceId: input.provinceId,
          provinceCode: input.provinceCode,
          wardId: input.wardId,
          wardCode: input.wardCode,
          districtId: input.districtId,
          sportIds: input.sportIds,
          amenityIds: input.amenityIds,
          lat: input.lat,
          lng: input.lng,
          description: input.description,
          ownerId: input.ownerId,
        });
        if (input.image) {
          try {
            await uploadVenueImage(editingVenue.id, input.image);
          } catch {
            toast.error('Lưu thông tin thành công nhưng tải ảnh thất bại');
          }
        }
        toast.success(`Đã cập nhật thông tin cơ sở "${input.name}" thành công`);
      } else {
        const created = await createOwnerVenue({
          name: input.name,
          address: input.address,
          provinceId: input.provinceId,
          provinceCode: input.provinceCode,
          wardId: input.wardId,
          wardCode: input.wardCode,
          districtId: input.districtId,
          sportIds: input.sportIds,
          amenityIds: input.amenityIds,
          lat: input.lat,
          lng: input.lng,
          description: input.description,
          ownerId: input.ownerId,
        });
        if (input.image) {
          try {
            await uploadVenueImage(created.id, input.image);
          } catch {
            toast.error('Tạo cơ sở thành công nhưng tải ảnh thất bại');
          }
        }
        toast.success(`Đã tạo cơ sở "${input.name}" hộ chủ sân thành công`);
      }
      setIsVenueFormOpen(false);
      setEditingVenue(null);
      void queryClient.invalidateQueries({ queryKey: adminVenuesQueryKeys.all });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tCommon('error'));
    } finally {
      setIsSavingVenue(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t('venues')}
        description="Kiểm tra thông tin địa chỉ, sân con và phê duyệt các cơ sở thể thao trên toàn hệ thống."
        actions={
          <Button
            onClick={() => {
              setEditingVenue(null);
              setIsVenueFormOpen(true);
            }}
          >
            <Plus className="mr-1.5 size-4" />
            Thêm cơ sở
          </Button>
        }
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
                    <th className="py-3 px-4 text-center">Sân con</th>
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
                        <p className="font-medium text-neutral-800">{venue.ownerName ?? 'Chủ sân'}</p>
                      </td>
                      <td className="py-3 px-4 text-xs text-neutral-600">
                        {venue.ward?.name ?? venue.district?.name ?? venue.address}
                        {venue.province ? `, ${venue.province.name}` : ''}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {(venue.sports ?? []).length > 0 ? (
                            venue.sports.map((s: { id: string; name: string }) => {
                              const resolvedName = sportsMap.get(s.id) || (s.name && s.name !== 'Sân thể thao' && !s.name.includes('-') ? s.name : sportsMap.get(s.id) || 'Môn thể thao');
                              return (
                                <span
                                  key={s.id}
                                  className="rounded-btn bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-neutral-700"
                                >
                                  {resolvedName}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-xs text-neutral-400">Chưa cập nhật</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {(venue.courts?.length ?? 0) > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-700">
                            {venue.courts?.length} sân
                          </span>
                        ) : (
                          <span className="text-xs text-neutral-400">0 sân</span>
                        )}
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

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingVenue(venue);
                              setIsVenueFormOpen(true);
                            }}
                            title="Chỉnh sửa thông tin cơ sở"
                          >
                            <Pencil className="size-4 text-neutral-600" />
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeletingVenue(venue)}
                            title="Xóa mềm cơ sở"
                            className="text-danger hover:bg-danger/10 hover:text-danger"
                          >
                            <Trash2 className="size-4" />
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
        onEdit={(v) => {
          setEditingVenue(v);
          setIsVenueFormOpen(true);
        }}
        onDelete={(v) => setDeletingVenue(v)}
      />

      <RejectVenueDialog
        venue={rejectingVenue}
        open={rejectingVenue !== null}
        onClose={() => setRejectingVenue(null)}
      />

      <DeleteVenueDialog
        venue={deletingVenue}
        open={deletingVenue !== null}
        onClose={() => setDeletingVenue(null)}
      />

      <VenueFormDialog
        open={isVenueFormOpen}
        venue={editingVenue}
        submitting={isSavingVenue}
        isAdmin={true}
        onOpenChange={(open) => {
          setIsVenueFormOpen(open);
          if (!open) setEditingVenue(null);
        }}
        onSubmit={handleSaveVenue}
      />
    </div>
  );
}
