'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { FileText, ShieldAlert } from 'lucide-react';

import { Pagination } from '@/components/common/Pagination';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminAuditLogs } from '@/lib/hooks/useAdminAuditLogs';
import { formatDate, formatTime } from '@/lib/utils/format';

function formatAuditAction(action: string): { label: string; tone: string } {
  if (action.includes('approve')) {
    return { label: 'Phê duyệt', tone: 'bg-primary-50 text-primary-800 border-primary-200' };
  }
  if (action.includes('reject')) {
    return { label: 'Từ chối', tone: 'bg-red-50 text-red-800 border-red-200' };
  }
  if (action.includes('suspend') || action.includes('cancel')) {
    return { label: 'Khoá / Huỷ bỏ', tone: 'bg-amber-50 text-amber-800 border-amber-200' };
  }
  if (action.includes('create')) {
    return { label: 'Thêm mới', tone: 'bg-blue-50 text-blue-800 border-blue-200' };
  }
  if (action.includes('delete')) {
    return { label: 'Xoá bỏ', tone: 'bg-neutral-100 text-neutral-800 border-neutral-300' };
  }
  return { label: action, tone: 'bg-neutral-50 text-neutral-700 border-neutral-200' };
}

function formatEntityType(type: string): string {
  switch (type) {
    case 'owner_application':
      return 'Hồ sơ chủ sân';
    case 'venue':
      return 'Cơ sở thể thao';
    case 'user':
      return 'Người dùng';
    case 'booking':
      return 'Đơn đặt sân';
    case 'sport':
      return 'Môn thể thao';
    case 'area':
      return 'Khu vực';
    default:
      return type;
  }
}

export function AdminAuditLogsScreen() {
  const t = useTranslations('admin');
  const [page, setPage] = React.useState(1);
  const [entityFilter, setEntityFilter] = React.useState<string | undefined>(undefined);

  const logsQuery = useAdminAuditLogs({
    page,
    limit: 10,
  });

  const rawLogs = logsQuery.data?.data ?? [];
  const meta = logsQuery.data?.meta;

  const logs = entityFilter
    ? rawLogs.filter((log) => log.entityType === entityFilter)
    : rawLogs;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t('auditLogs')}
        description="Ghi nhận nhật ký toàn bộ thao tác quan trọng của quản trị viên (bất biến, không thể sửa hoặc xoá)."
      />

      {/* Lọc theo loại đối tượng */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Button
          variant={entityFilter === undefined ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setEntityFilter(undefined)}
        >
          Tất cả
        </Button>
        <Button
          variant={entityFilter === 'owner_application' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setEntityFilter('owner_application')}
        >
          Hồ sơ chủ sân
        </Button>
        <Button
          variant={entityFilter === 'venue' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setEntityFilter('venue')}
        >
          Cơ sở thể thao
        </Button>
        <Button
          variant={entityFilter === 'user' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setEntityFilter('user')}
        >
          Người dùng
        </Button>
        <Button
          variant={entityFilter === 'booking' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setEntityFilter('booking')}
        >
          Đơn đặt sân
        </Button>
        <Button
          variant={entityFilter === 'sport' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setEntityFilter('sport')}
        >
          Danh mục
        </Button>
      </div>

      {logsQuery.isPending ? (
        <Card className="p-4">
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </Card>
      ) : logsQuery.isError ? (
        <ErrorState
          error={logsQuery.error}
          onRetry={() => void logsQuery.refetch()}
        />
      ) : logs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Chưa có nhật ký kiểm toán"
          description="Hệ thống chưa ghi nhận thao tác quản trị nào trong phạm vi bộ lọc."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50/50 text-xs font-semibold uppercase text-neutral-500">
                    <th className="py-3 px-4">Thời gian</th>
                    <th className="py-3 px-4">Người thực hiện</th>
                    <th className="py-3 px-4">Hành động</th>
                    <th className="py-3 px-4">Đối tượng</th>
                    <th className="py-3 px-4">Chi tiết thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {logs.map((log) => {
                    const { label, tone } = formatAuditAction(log.action);
                    return (
                      <tr key={log.id} className="hover:bg-neutral-50/50">
                        <td className="py-3 px-4 text-xs text-neutral-600 whitespace-nowrap">
                          <p className="font-medium text-neutral-800">{formatDate(log.createdAt)}</p>
                          <p className="text-neutral-400 font-mono">{formatTime(log.createdAt)}</p>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 font-medium text-neutral-900">
                            <ShieldAlert className="size-3.5 text-purple-600" />
                            {log.actorName ?? 'Hệ thống'}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone}`}
                          >
                            {label}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium text-neutral-800">
                            {formatEntityType(log.entityType)}
                          </p>
                          <p className="text-xs text-neutral-500 font-mono truncate max-w-[200px]" title={log.entityId}>
                            {log.entityId}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-xs text-neutral-600">
                          {log.metadata ? (
                            <div className="space-y-0.5">
                              {log.metadata.reviewNote ? (
                                <p>
                                  <strong className="text-neutral-700">Lý do:</strong>{' '}
                                  {String(log.metadata.reviewNote)}
                                </p>
                              ) : null}
                              {log.metadata.reason ? (
                                <p>
                                  <strong className="text-neutral-700">Lý do:</strong>{' '}
                                  {String(log.metadata.reason)}
                                </p>
                              ) : null}
                              {log.metadata.label && !log.metadata.reviewNote && !log.metadata.reason ? (
                                <p>{String(log.metadata.label)}</p>
                              ) : null}
                              {log.metadata.applicant ? (
                                <p className="text-neutral-500">
                                  Người nộp: {String(log.metadata.applicant)}
                                </p>
                              ) : null}
                              {log.metadata.venueName ? (
                                <p className="text-neutral-500">
                                  Cơ sở: {String(log.metadata.venueName)}
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-neutral-400">—</span>
                          )}
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
    </div>
  );
}
