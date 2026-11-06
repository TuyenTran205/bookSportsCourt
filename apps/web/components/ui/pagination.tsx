'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface PaginationProps {
  /** Trang hiện tại (1-based index) */
  currentPage: number;
  /** Tổng số trang */
  totalPages: number;
  /** Callback khi người dùng chuyển trang */
  onPageChange: (page: number) => void;
  /** Vô hiệu hoá tương tác khi đang nạp dữ liệu ngầm */
  disabled?: boolean;
  /** Bán kính hiển thị trang xung quanh trang hiện tại (mặc định: 1) */
  siblingCount?: number;
  /** Class CSS bổ sung */
  className?: string;
}

/**
 * Sinh danh sách các số trang và dấu ba chấm cần hiển thị.
 */
function generatePaginationRange(
  currentPage: number,
  totalPages: number,
  siblingCount: number,
): Array<number | 'dots-start' | 'dots-end'> {
  // Tổng các slot hiển thị: first + last + current + 2*siblings + 2*dots = 2*siblings + 5
  const totalSlots = siblingCount * 2 + 5;

  if (totalPages <= totalSlots) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const leftSibling = Math.max(currentPage - siblingCount, 1);
  const rightSibling = Math.min(currentPage + siblingCount, totalPages);

  const showLeftDots = leftSibling > 2;
  const showRightDots = rightSibling < totalPages - 1;

  if (!showLeftDots && showRightDots) {
    const leftItemCount = 3 + 2 * siblingCount;
    const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
    return [...leftRange, 'dots-end', totalPages];
  }

  if (showLeftDots && !showRightDots) {
    const rightItemCount = 3 + 2 * siblingCount;
    const rightRange = Array.from(
      { length: rightItemCount },
      (_, i) => totalPages - rightItemCount + 1 + i,
    );
    return [1, 'dots-start', ...rightRange];
  }

  const middleRange = Array.from(
    { length: rightSibling - leftSibling + 1 },
    (_, i) => leftSibling + i,
  );
  return [1, 'dots-start', ...middleRange, 'dots-end', totalPages];
}

/**
 * Component Phân trang dùng chung (Linear / Stripe Standard).
 * Đáp ứng touch-target >= 44px, hỗ trợ phím chuyển trang, aria chuẩn.
 */
export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  disabled = false,
  siblingCount = 1,
  className,
}: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const range = generatePaginationRange(currentPage, totalPages, siblingCount);

  const handlePageClick = (page: number) => {
    if (disabled || page === currentPage || page < 1 || page > totalPages) return;
    onPageChange(page);
  };

  const isFirstPage = currentPage <= 1;
  const isLastPage = currentPage >= totalPages;

  return (
    <nav
      role="navigation"
      aria-label="Phân trang"
      className={cn('flex flex-wrap items-center justify-center gap-1.5', className)}
    >
      {/* Nút Trang trước */}
      <button
        type="button"
        aria-label="Trang trước"
        disabled={disabled || isFirstPage}
        onClick={() => handlePageClick(currentPage - 1)}
        className={cn(
          'inline-flex min-h-11 min-w-11 items-center justify-center rounded-btn border border-border bg-bg-card px-3 text-sm font-medium text-text-primary transition-colors',
          'hover:bg-bg-subtle active:bg-neutral-200 dark:active:bg-neutral-700',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-bg-card',
        )}
      >
        <ChevronLeft className="size-4 shrink-0 text-text-secondary" aria-hidden="true" />
        <span className="hidden sm:inline sm:ml-1">Trước</span>
      </button>

      {/* Danh sách các trang */}
      {range.map((item, idx) => {
        if (item === 'dots-start' || item === 'dots-end') {
          return (
            <span
              key={`${item}-${idx}`}
              aria-hidden="true"
              className="inline-flex min-h-11 min-w-11 items-center justify-center text-text-disabled"
            >
              <MoreHorizontal className="size-4" />
            </span>
          );
        }

        const isCurrent = item === currentPage;
        return (
          <button
            key={item}
            type="button"
            aria-label={`Trang ${item}`}
            aria-current={isCurrent ? 'page' : undefined}
            disabled={disabled}
            onClick={() => handlePageClick(item)}
            className={cn(
              'inline-flex min-h-11 min-w-11 items-center justify-center rounded-btn px-3 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              isCurrent
                ? 'bg-primary-700 text-white font-semibold shadow-xs hover:bg-primary-600'
                : 'border border-border bg-bg-card text-text-primary hover:bg-bg-subtle active:bg-neutral-200 dark:active:bg-neutral-700',
            )}
          >
            {item}
          </button>
        );
      })}

      {/* Nút Trang sau */}
      <button
        type="button"
        aria-label="Trang sau"
        disabled={disabled || isLastPage}
        onClick={() => handlePageClick(currentPage + 1)}
        className={cn(
          'inline-flex min-h-11 min-w-11 items-center justify-center rounded-btn border border-border bg-bg-card px-3 text-sm font-medium text-text-primary transition-colors',
          'hover:bg-bg-subtle active:bg-neutral-200 dark:active:bg-neutral-700',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-bg-card',
        )}
      >
        <span className="hidden sm:inline sm:mr-1">Sau</span>
        <ChevronRight className="size-4 shrink-0 text-text-secondary" aria-hidden="true" />
      </button>
    </nav>
  );
}
