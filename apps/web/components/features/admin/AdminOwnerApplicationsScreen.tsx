'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Check, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import type { OwnerApplication, OwnerApplicationStatus } from '@bsc/shared';

import { Pagination } from '@/components/common/Pagination';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { RejectApplicationDialog } from '@/components/features/admin/RejectApplicationDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { ApiError } from '@/lib/api/errors';
import {
  useOwnerApplications,
  useReviewOwnerApplication,
} from '@/lib/hooks/useAdminOwnerApplications';
import { formatDateTime } from '@/lib/utils/format';

export function AdminOwnerApplicationsScreen() {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');

  const [page, setPage] = React.useState(1);
  const [statusFilter, setStatusFilter] = React.useState<OwnerApplicationStatus | undefined>(undefined);
  const [rejectingApp, setRejectingApp] = React.useState<OwnerApplication | null>(null);

  const applicationsQuery = useOwnerApplications({
    page,
    limit: 10,
    status: statusFilter,
  });

  const reviewMutation = useReviewOwnerApplication();

  const applications = applicationsQuery.data?.data ?? [];
  const meta = applicationsQuery.data?.meta;

  const handleApprove = async (app: OwnerApplication) => {
    if (!window.confirm(`Xác nhận duyệt hồ sơ đối tác của ${app.user.fullName}?`)) return;
    try {
      await reviewMutation.mutateAsync({
        id: app.id,
        status: 'approved',
      });
      toast.success('Đã duyệt hồ sơ đối tác chủ sân');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tCommon('error'));
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t('ownerApplications')}
        description="Kiểm tra thông tin giấy phép kinh doanh, mã số thuế và xét duyệt đối tác chủ sân thể thao."
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
          Đã duyệt
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
      </div>

      {applicationsQuery.isPending ? (
        <Card className="p-4">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </Card>
      ) : applicationsQuery.isError ? (
        <ErrorState
          error={applicationsQuery.error}
          onRetry={() => void applicationsQuery.refetch()}
        />
      ) : applications.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Không có hồ sơ nào"
          description="Hiện không có đơn đăng ký chủ sân nào khớp với bộ lọc đã chọn."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50/50 text-xs font-semibold uppercase text-neutral-500">
                    <th className="py-3 px-4">Người nộp</th>
                    <th className="py-3 px-4">Cơ sở kinh doanh</th>
                    <th className="py-3 px-4">Mã số thuế</th>
                    <th className="py-3 px-4">Ngày nộp</th>
                    <th className="py-3 px-4 text-center">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {applications.map((app) => (
                    <tr key={app.id} className="hover:bg-neutral-50/50">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-neutral-900">{app.user.fullName}</p>
                        <p className="text-xs text-neutral-500">
                          {app.user.email} · {app.user.phone ?? 'Chưa có SĐT'}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-neutral-800">{app.businessName}</p>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-neutral-600">
                        {app.taxCode ?? <span className="text-neutral-400">Không có</span>}
                      </td>
                      <td className="py-3 px-4 text-xs text-neutral-600">
                        {formatDateTime(app.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <StatusBadge kind="application" status={app.status} />
                        {app.status === 'rejected' && app.rejectReason && (
                          <p className="mt-1 line-clamp-1 text-[11px] text-danger" title={app.rejectReason}>
                            Lý do: {app.rejectReason}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {app.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              disabled={reviewMutation.isPending}
                              onClick={() => handleApprove(app)}
                              className="bg-primary-600 hover:bg-primary-700"
                            >
                              <Check className="mr-1 size-3.5" />
                              Duyệt
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={reviewMutation.isPending}
                              onClick={() => setRejectingApp(app)}
                              className="text-danger hover:bg-danger/10 hover:text-danger"
                            >
                              <X className="mr-1 size-3.5" />
                              Từ chối
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-400">Đã xử lý</span>
                        )}
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

      <RejectApplicationDialog
        application={rejectingApp}
        open={rejectingApp !== null}
        onClose={() => setRejectingApp(null)}
      />
    </div>
  );
}
