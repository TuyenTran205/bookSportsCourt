'use client';

import * as React from 'react';
import type { PaginationMeta } from '@bsc/shared';

import { Pagination as UIPagination } from '@/components/ui/pagination';
import { cn } from '@/lib/utils/cn';

export type PaginationProps = {
  onPageChange: (page: number) => void;
  disabled?: boolean;
  alwaysShow?: boolean;
  className?: string;
} & (
  | { meta: PaginationMeta }
  | {
      meta?: never;
      page: number;
      totalPages: number;
      total: number;
      limit: number;
    }
);

/** Pagination – dùng chung toàn hệ thống (hiển thị tóm tắt + số trang). */
export function Pagination(props: PaginationProps) {
  const { onPageChange, disabled = false, alwaysShow = true, className } = props;
  const resolvedMeta: PaginationMeta =
    'meta' in props && props.meta
      ? props.meta
      : {
          page: props.page,
          limit: props.limit,
          total: props.total,
          totalPages: props.totalPages,
        };
  const { page, limit, total, totalPages } = resolvedMeta;
  if (total === 0) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-between gap-3 pt-2 text-sm text-text-secondary sm:flex-row',
        className,
      )}
    >
      <p className="tabular-nums">
        Hiển thị <span className="font-semibold text-text-primary">{from}</span>–
        <span className="font-semibold text-text-primary">{to}</span> /{' '}
        <span className="font-semibold text-text-primary">{total}</span> mục
      </p>
      <UIPagination
        currentPage={page}
        totalPages={Math.max(1, totalPages)}
        onPageChange={onPageChange}
        disabled={disabled}
        alwaysShow={alwaysShow}
      />
    </div>
  );
}
