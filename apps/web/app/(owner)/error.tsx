'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, LayoutDashboard, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';

export default function OwnerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[OwnerError]', error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div
        role="alert"
        className="flex w-full max-w-md flex-col items-center gap-3 rounded-card border border-neutral-200 bg-white p-8 text-center shadow-sm"
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-danger/10 text-danger">
          <AlertTriangle className="size-6" aria-hidden="true" />
        </div>

        <h2 className="text-base font-semibold text-neutral-900">
          Không thể tải dữ liệu kênh chủ sân
        </h2>

        <p className="text-sm text-neutral-600">
          {error.message || 'Đã xảy ra lỗi trong quá trình xử lý yêu cầu của bạn.'}
        </p>

        {error.digest && (
          <p className="text-xs text-neutral-400">Mã lỗi: {error.digest}</p>
        )}

        <div className="mt-4 flex flex-col sm:flex-row items-center gap-3 w-full">
          <Button variant="primary" size="sm" onClick={() => reset()} className="w-full">
            <RefreshCw className="size-4" aria-hidden="true" />
            <span>Thử lại</span>
          </Button>
          <Button variant="outline" size="sm" asChild className="w-full">
            <Link href="/owner/dashboard">
              <LayoutDashboard className="size-4" aria-hidden="true" />
              <span>Về tổng quan chủ sân</span>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
