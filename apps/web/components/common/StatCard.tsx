import * as React from 'react';
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils/cn';

export interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  /** % thay đổi so với kỳ trước; dương là tăng, âm là giảm. */
  delta?: number;
  deltaLabel?: string;
  loading?: boolean;
  className?: string;
}

/** StatCard – ô KPI cho dashboard; số dùng `tabular-nums` để thẳng hàng. */
export function StatCard({
  label,
  value,
  icon: Icon,
  delta,
  deltaLabel,
  loading,
  className,
}: StatCardProps) {
  const up = (delta ?? 0) >= 0;
  return (
    <Card className={cn('p-4 sm:p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-neutral-600">{label}</p>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-btn bg-primary-50 text-primary-700">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-28" />
      ) : (
        <p className="mt-2 text-2xl font-bold tabular-nums text-neutral-900">
          {value}
        </p>
      )}
      {delta !== undefined && !loading && (
        <p
          className={cn(
            'mt-1 inline-flex items-center gap-1 text-xs font-medium',
            up ? 'text-success' : 'text-danger',
          )}
        >
          {up ? (
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          ) : (
            <ArrowDownRight className="size-3.5" aria-hidden="true" />
          )}
          {up ? '+' : ''}
          {delta.toFixed(1)}%
          {deltaLabel && <span className="font-normal text-neutral-500">{deltaLabel}</span>}
        </p>
      )}
    </Card>
  );
}
