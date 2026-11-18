'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Check, ExternalLink, Eye, MapPin, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import type { OwnerApplication, OwnerApplicationStatus } from '@bsc/shared';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { RejectApplicationDialog } from '@/components/features/admin/RejectApplicationDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  const [detailApp, setDetailApp] = React.useState<OwnerApplication | null>(null);
  const [approvingApp, setApprovingApp] = React.useState<OwnerApplication | null>(null);
  const [rejectingApp, setRejectingApp] = React.useState<OwnerApplication | null>(null);

  const applicationsQuery = useOwnerApplications({
    page,
    limit: 10,
    status: statusFilter,
  });

  const reviewMutation = useReviewOwnerApplication();

  const applications = applicationsQuery.data?.data ?? [];
  const meta = applicationsQuery.data?.meta;

  const handleApprove = (app: OwnerApplication) => {
    setApprovingApp(app);
  };

  const confirmApprove = async () => {
    if (!approvingApp) return;
    try {
      await reviewMutation.mutateAsync({
        id: approvingApp.id,
        status: 'approved',
      });
      toast.success('Đã duyệt hồ sơ đối tác chủ sân');
      setApprovingApp(null);
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
                  <tr className="border-b border-border bg-bg-subtle text-xs font-semibold uppercase text-text-secondary">
                    <th className="py-3 px-4">Người nộp</th>
                    <th className="py-3 px-4">Cơ sở kinh doanh</th>
                    <th className="py-3 px-4">Mã số thuế</th>
                    <th className="py-3 px-4">Ngày nộp</th>
                    <th className="py-3 px-4 text-center">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {applications.map((app) => {
                    const submitterName = app.applicantName || app.user?.fullName || app.businessName;
                    return (
                    <tr key={app.id} className="hover:bg-bg-subtle/60">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-text-primary">
                          {submitterName}
                        </p>
                        <p className="text-xs text-text-secondary">
                          {app.user?.email
                            ? `${app.user.email} · ${app.user.phone ?? app.phone ?? 'Chưa có SĐT'}`
                            : (app.phone ?? 'Chưa có SĐT')}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-text-primary">{app.businessName}</p>
                        {app.address && (
                          <p className="line-clamp-2 text-xs text-text-secondary" title={app.address}>
                            {app.address}
                          </p>
                        )}
                        {app.lat != null && app.lng != null && (
                          <div className="mt-1 flex items-center gap-1.5">
                            <a
                              href={`https://www.google.com/maps?q=${app.lat},${app.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-600 hover:underline dark:text-primary-400"
                              title="Mở vị trí trên Google Maps"
                            >
                              <MapPin className="size-3 text-primary-600 dark:text-primary-400" aria-hidden="true" />
                              <span>
                                {Number(app.lat).toFixed(4)}, {Number(app.lng).toFixed(4)}
                              </span>
                              <ExternalLink className="size-2.5 opacity-70" aria-hidden="true" />
                            </a>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="font-mono text-text-secondary">
                          {app.taxCode ? `MST: ${app.taxCode}` : <span className="text-text-disabled">Không có MST</span>}
                        </div>
                        {app.accountNo && (
                          <div className="mt-1 text-[11px] text-text-secondary">
                            <span className="font-medium text-text-primary">{app.bankName || app.bankBin}</span>: {app.accountNo}
                            {app.accountName && <span className="block text-[10px] text-text-disabled">{app.accountName}</span>}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-text-secondary">
                        {formatDateTime(app.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <StatusBadge kind="application" status={app.status} />
                        {app.status === 'rejected' && (app.rejectReason || app.reviewNote) && (
                          <p className="mt-1 line-clamp-1 text-[11px] text-danger" title={app.rejectReason ?? app.reviewNote ?? undefined}>
                            Lý do: {app.rejectReason || app.reviewNote}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDetailApp(app)}
                            aria-label={`Xem chi tiết hồ sơ ${app.businessName}`}
                          >
                            <Eye className="mr-1 size-3.5" aria-hidden="true" />
                            Chi tiết
                          </Button>
                          {app.status === 'pending' && (
                            <>
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
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                  })}
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

      <ConfirmDialog
        open={approvingApp !== null}
        onOpenChange={(open) => {
          if (!open) setApprovingApp(null);
        }}
        variant="primary"
        title="Xác nhận duyệt hồ sơ đối tác"
        subtitle="Tài khoản sẽ được kích hoạt quyền chủ sân"
        description={
          approvingApp && (
            <>
              Xác nhận duyệt hồ sơ đối tác của{' '}
              <span className="font-semibold text-text-primary">
                {approvingApp.applicantName || approvingApp.user?.fullName || approvingApp.businessName}
              </span>
              ?
            </>
          )
        }
        confirmLabel="Xác nhận duyệt"
        isPending={reviewMutation.isPending}
        onConfirm={confirmApprove}
      />

      {/* Modal xem toàn bộ thông tin hồ sơ đăng ký chủ sân */}
      <Dialog
        open={detailApp !== null}
        onOpenChange={(open) => {
          if (!open) setDetailApp(null);
        }}
      >
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <span>Chi tiết hồ sơ đăng ký chủ sân</span>
              {detailApp && <StatusBadge kind="application" status={detailApp.status} />}
            </DialogTitle>
            <DialogDescription>
              Toàn bộ thông tin do khách hàng cung cấp khi gửi yêu cầu trở thành đối tác chủ sân.
            </DialogDescription>
          </DialogHeader>

          {detailApp && (
            <div className="space-y-4 text-sm">
              <div className="rounded-lg border border-border bg-bg-subtle/60 p-4">
                <h4 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  1. Thông tin người nộp hồ sơ
                </h4>
                <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-text-secondary">Họ và tên</dt>
                    <dd className="font-medium text-text-primary">
                      {detailApp.applicantName || detailApp.user?.fullName || 'Chưa cập nhật'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-text-secondary">Số điện thoại liên hệ</dt>
                    <dd className="font-medium text-text-primary">
                      {detailApp.phone || detailApp.user?.phone || 'Chưa cập nhật'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-text-secondary">Email / Liên hệ tài khoản</dt>
                    <dd className="text-text-primary">{detailApp.user?.email || 'Chưa cập nhật'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-text-secondary">Mã người dùng (User ID)</dt>
                    <dd className="font-mono text-xs text-text-secondary break-all">
                      {detailApp.userId || detailApp.user?.id || '—'}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-lg border border-border bg-bg-subtle/60 p-4">
                <h4 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  2. Thông tin cơ sở kinh doanh
                </h4>
                <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-text-secondary">Tên cơ sở / Doanh nghiệp</dt>
                    <dd className="font-semibold text-text-primary">{detailApp.businessName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-text-secondary">Mã số thuế (MST)</dt>
                    <dd className="font-mono text-text-primary">
                      {detailApp.taxCode || 'Không có'}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-text-secondary">Địa chỉ cơ sở</dt>
                    <dd className="text-text-primary">{detailApp.address || 'Chưa cập nhật'}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-text-secondary">Tọa độ bản đồ (Lat / Lng)</dt>
                    <dd className="text-text-primary">
                      {detailApp.lat != null && detailApp.lng != null ? (
                        <a
                          href={`https://www.google.com/maps?q=${detailApp.lat},${detailApp.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 font-medium text-primary-600 hover:underline dark:text-primary-400"
                        >
                          <MapPin className="size-3.5" aria-hidden="true" />
                          <span>
                            {Number(detailApp.lat).toFixed(6)}, {Number(detailApp.lng).toFixed(6)} (Mở Google Maps)
                          </span>
                          <ExternalLink className="size-3" aria-hidden="true" />
                        </a>
                      ) : (
                        'Chưa định vị tọa độ'
                      )}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-lg border border-border bg-bg-subtle/60 p-4">
                <h4 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  3. Tài khoản ngân hàng nhận tiền chuyển khoản
                </h4>
                <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-text-secondary">Ngân hàng</dt>
                    <dd className="font-medium text-text-primary">
                      {detailApp.bankName || 'Chưa cập nhật'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-text-secondary">Mã BIN ngân hàng</dt>
                    <dd className="font-mono text-text-primary">
                      {detailApp.bankBin || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-text-secondary">Số tài khoản</dt>
                    <dd className="font-mono font-medium text-text-primary">
                      {detailApp.accountNo || 'Chưa cập nhật'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-text-secondary">Tên chủ tài khoản</dt>
                    <dd className="font-medium text-text-primary">
                      {detailApp.accountName || 'Chưa cập nhật'}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-lg border border-border bg-bg-subtle/60 p-4">
                <h4 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  4. Ghi chú &amp; Lịch sử xét duyệt
                </h4>
                <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-text-secondary">Ghi chú từ người nộp đơn</dt>
                    <dd className="whitespace-pre-wrap text-text-primary">
                      {detailApp.note || 'Không có ghi chú'}
                    </dd>
                  </div>
                  {detailApp.idCardUrl && (
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-text-secondary">Giấy tờ / Ảnh đính kèm</dt>
                      <dd className="mt-1">
                        <a
                          href={detailApp.idCardUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
                        >
                          <ExternalLink className="size-3.5" aria-hidden="true" />
                          <span>Mở tệp đính kèm</span>
                        </a>
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs text-text-secondary">Thời gian nộp hồ sơ</dt>
                    <dd className="text-text-primary">{formatDateTime(detailApp.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-text-secondary">Thời gian xét duyệt</dt>
                    <dd className="text-text-primary">
                      {detailApp.reviewedAt ? formatDateTime(detailApp.reviewedAt) : 'Chưa xử lý'}
                    </dd>
                  </div>
                  {(detailApp.rejectReason || detailApp.reviewNote) && (
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-text-secondary">Ghi chú / Lý do xét duyệt</dt>
                      <dd className="whitespace-pre-wrap text-danger">
                        {detailApp.rejectReason || detailApp.reviewNote}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          )}

          <DialogFooter className="mt-2 gap-2">
            <Button variant="outline" onClick={() => setDetailApp(null)}>
              Đóng
            </Button>
            {detailApp?.status === 'pending' && (
              <>
                <Button
                  variant="outline"
                  disabled={reviewMutation.isPending}
                  onClick={() => {
                    const target = detailApp;
                    setDetailApp(null);
                    setRejectingApp(target);
                  }}
                  className="text-danger hover:bg-danger/10 hover:text-danger"
                >
                  <X className="mr-1 size-4" />
                  Từ chối
                </Button>
                <Button
                  disabled={reviewMutation.isPending}
                  onClick={() => {
                    const target = detailApp;
                    setDetailApp(null);
                    handleApprove(target);
                  }}
                  className="bg-primary-600 hover:bg-primary-700"
                >
                  <Check className="mr-1 size-4" />
                  Duyệt hồ sơ
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
