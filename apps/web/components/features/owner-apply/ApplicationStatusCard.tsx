'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, CheckCircle2, Clock, RotateCcw } from 'lucide-react';
import type { OwnerApplication } from '@bsc/shared';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDateTime } from '@/lib/utils/format';

export interface ApplicationStatusCardProps {
  application: OwnerApplication;
  onResubmit?: () => void;
}

export function ApplicationStatusCard({
  application,
  onResubmit,
}: ApplicationStatusCardProps) {
  if (application.status === 'approved') {
    return (
      <Card className="flex flex-col gap-6 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700">
            <CheckCircle2 className="size-6" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-neutral-900">
                Chúc mừng! Tài khoản của bạn đã được phê duyệt làm Chủ sân
              </h3>
              <StatusBadge kind="owner_application" status={application.status} />
            </div>
            <p className="text-sm text-neutral-600">
              Hồ sơ đăng ký cơ sở kinh doanh{' '}
              <strong className="text-neutral-900">{application.businessName}</strong> đã được
              ban quản trị chấp thuận vào{' '}
              {application.reviewedAt ? formatDateTime(application.reviewedAt) : 'gần đây'}.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-4">
          <Button asChild variant="primary">
            <Link href="/owner/dashboard" className="gap-2">
              <span>Truy cập trang Quản lý Chủ sân</span>
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/owner/venues">Thêm cơ sở thể thao đầu tiên</Link>
          </Button>
        </div>
      </Card>
    );
  }

  if (application.status === 'rejected') {
    return (
      <Card className="flex flex-col gap-6 border-danger/30 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-red-100 text-danger">
            <AlertCircle className="size-6" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-neutral-900">
                Hồ sơ đăng ký chủ sân chưa được duyệt
              </h3>
              <StatusBadge kind="owner_application" status={application.status} />
            </div>
            <p className="text-sm text-neutral-600">
              Rất tiếc, hồ sơ đăng ký kinh doanh cho{' '}
              <strong className="text-neutral-900">{application.businessName}</strong> chưa đáp
              ứng tiêu chuẩn xét duyệt của nền tảng.
            </p>

            {application.rejectReason && (
              <div className="mt-2 rounded-lg border border-red-200 bg-red-50/50 p-4 text-sm text-neutral-800">
                <p className="font-semibold text-danger">Lý do từ chối từ Ban quản trị:</p>
                <p className="mt-1">{application.rejectReason}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-4">
          {onResubmit && (
            <Button type="button" variant="primary" onClick={onResubmit} className="gap-2">
              <RotateCcw className="size-4" aria-hidden="true" />
              <span>Cập nhật và nộp lại hồ sơ</span>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href="/">Quay về trang chủ</Link>
          </Button>
        </div>
      </Card>
    );
  }

  // Trạng thái pending
  return (
    <Card className="flex flex-col gap-6 border-amber-200/70 p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <Clock className="size-6" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-neutral-900">
              Hồ sơ của bạn đang được xét duyệt
            </h3>
            <StatusBadge kind="owner_application" status={application.status} />
          </div>
          <p className="text-sm text-neutral-600">
            Ban quản trị BookSportsCourt đang thẩm định thông tin cơ sở và đối soát giấy tờ. Thời
            gian phản hồi tiêu chuẩn là từ 24 đến 48 giờ làm việc. Bạn sẽ nhận được thông báo
            ngay khi hồ sơ được phê duyệt.
          </p>
        </div>
      </div>

      {/* Thông tin tóm tắt hồ sơ đã nộp */}
      <div className="rounded-card border border-neutral-200 bg-neutral-50/50 p-4 sm:p-5">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Thông tin hồ sơ đã gửi
        </h4>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs text-neutral-500">Tên cơ sở / Hộ kinh doanh</dt>
            <dd className="mt-0.5 text-sm font-semibold text-neutral-900">
              {application.businessName}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Mã số thuế / CCCD</dt>
            <dd className="mt-0.5 text-sm font-semibold text-neutral-900">
              {application.taxCode || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Người nộp</dt>
            <dd className="mt-0.5 text-sm font-semibold text-neutral-900">
              {application.user.fullName}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Số điện thoại liên hệ</dt>
            <dd className="mt-0.5 text-sm font-semibold text-neutral-900">
              {application.user.phone || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Thời điểm gửi hồ sơ</dt>
            <dd className="mt-0.5 text-sm font-semibold text-neutral-900">
              {formatDateTime(application.createdAt)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="flex items-center justify-between border-t border-neutral-100 pt-4">
        <p className="text-xs text-neutral-500">
          Cần hỗ trợ gấp? Liên hệ hotline:{' '}
          <span className="font-semibold text-primary-700">1900 xxxx</span>
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/">Về trang chủ</Link>
        </Button>
      </div>
    </Card>
  );
}
