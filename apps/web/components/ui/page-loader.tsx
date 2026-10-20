import * as React from 'react';

import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils/cn';

/**
 * PageLoader – khung tải trang hoàn chỉnh, dùng trong các file `loading.tsx`
 * của Next.js App Router.
 *
 * Nguồn: docs/specs/loading-states-spec.md (SPEC-FE-LOADING-01).
 *
 * Chỉ một live region duy nhất ở đây; spinner bên trong được đánh dấu trang trí
 * (`label=""`) để screen-reader không đọc thông báo hai lần.
 */
export interface PageLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Câu thông báo dưới vòng xoay. */
  label?: string;
  /** Mô tả chi tiết thêm, tuỳ chọn. */
  description?: string;
  spinnerSize?: 'md' | 'lg' | 'xl';
  /** `true`: chiếm trọn vùng nội dung (trừ header 4rem); `false`: khung gọn giữa trang. */
  fullscreen?: boolean;
}

export function PageLoader({
  label = 'Đang tải trang…',
  description,
  spinnerSize = 'xl',
  fullscreen = false,
  className,
  ...props
}: PageLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        'flex w-full flex-col items-center justify-center gap-4 px-6 text-center',
        fullscreen ? 'min-h-[calc(100vh-4rem)]' : 'min-h-[50vh] py-16',
        className,
      )}
      {...props}
    >
      <Spinner size={spinnerSize} label="" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-neutral-600">{label}</p>
        {description ? <p className="text-xs text-neutral-500">{description}</p> : null}
      </div>
    </div>
  );
}
