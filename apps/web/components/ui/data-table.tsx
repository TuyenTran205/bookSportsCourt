'use client';

import * as React from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';

import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils/cn';

/**
 * DataTable – docs/07-design-system.md mục 9.
 *
 * Quy tắc từ tài liệu:
 * - Dùng `<table>` HTML thực (không phải grid div) để giữ ngữ nghĩa và a11y.
 * - Filter và bulk action nằm ở toolbar phía TRÊN bảng.
 * - Pagination ở DƯỚI.
 * - Cột số căn phải + `tabular-nums` để các chữ số thẳng hàng.
 * - Mobile: cuộn ngang, KHÔNG ẩn cột (ẩn cột làm mất dữ liệu quan trọng).
 *
 * Component giữ state sắp xếp tại chỗ nhưng KHÔNG tự cắt trang dữ liệu: cha
 * truyền vào đúng trang hiện tại kèm `meta`, để server vẫn là nguồn sự thật.
 */

export interface Column<T> {
  /** Khoá duy nhất của cột — cũng là tên trường khi bật `sortable`. */
  key: string;
  header: string;
  /** Nội dung ô. Trả `null` để hiện dấu "—". */
  cell: (row: T) => React.ReactNode;
  /** Căn phải cho cột số. */
  align?: 'left' | 'right' | 'center';
  /** Bật sắp xếp — cha xử lý qua `onSortChange`. */
  sortable?: boolean;
  /** Class thêm cho ô (ví dụ bề rộng). */
  className?: string;
}

export interface DataTableProps<T> {
  columns: Array<Column<T>>;
  rows: T[];
  /** Khoá duy nhất của mỗi dòng. */
  getRowId: (row: T) => string;
  loading?: boolean;
  /**
   * Đang tải lại dữ liệu nhưng vẫn còn dữ liệu cũ để hiển thị (đổi filter/phân trang).
   * Giữ nguyên các dòng cũ, chỉ làm mờ thân bảng — không quay về skeleton.
   */
  isFetching?: boolean;
  /** Trạng thái rỗng tuỳ biến; mặc định dùng `EmptyState` chuẩn. */
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  /** Sắp xếp hiện tại do cha quản lý. */
  sort?: { key: string; direction: 'asc' | 'desc' };
  onSortChange?: (sort: { key: string; direction: 'asc' | 'desc' }) => void;
  /** Thanh toolbar phía trên: filter, bulk action. */
  toolbar?: React.ReactNode;
  /** Phân trang phía dưới. */
  pagination?: React.ReactNode;
  /** Chọn nhiều dòng — bật cột checkbox đầu tiên. */
  selectable?: boolean;
  selectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
  /** Nhấn vào dòng (không tính cột chọn). */
  onRowClick?: (row: T) => void;
  /** Số dòng skeleton khi đang tải. */
  skeletonRows?: number;
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  loading = false,
  isFetching = false,
  emptyTitle = 'Không có dữ liệu',
  emptyDescription,
  emptyAction,
  sort,
  onSortChange,
  toolbar,
  pagination,
  selectable = false,
  selectedIds = [],
  onSelectedIdsChange,
  onRowClick,
  skeletonRows = 5,
  className,
}: DataTableProps<T>) {
  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected = rows.length > 0 && rows.every((r) => selectedSet.has(getRowId(r)));
  const someSelected = rows.some((r) => selectedSet.has(getRowId(r))) && !allSelected;

  const toggleAll = () => {
    if (!onSelectedIdsChange) return;
    if (allSelected) {
      // Bỏ chọn những dòng ĐANG hiển thị, giữ nguyên lựa chọn ở trang khác.
      const visible = new Set(rows.map(getRowId));
      onSelectedIdsChange(selectedIds.filter((id) => !visible.has(id)));
    } else {
      onSelectedIdsChange([...new Set([...selectedIds, ...rows.map(getRowId)])]);
    }
  };

  const toggleOne = (id: string) => {
    if (!onSelectedIdsChange) return;
    onSelectedIdsChange(
      selectedSet.has(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id],
    );
  };

  const handleSort = (key: string) => {
    if (!onSortChange) return;
    const direction = sort?.key === key && sort.direction === 'asc' ? 'desc' : 'asc';
    onSortChange({ key, direction });
  };

  const colSpan = columns.length + (selectable ? 1 : 0);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}

      {/* Cuộn ngang trên mobile — bảng rộng không được phá vỡ layout trang. */}
      <div className="overflow-x-auto rounded-card border border-neutral-200 bg-white">
        <table
          className={cn(
            'w-full border-collapse text-sm transition-opacity duration-150',
            // Đang tải lại trang/filter mới: giữ dữ liệu cũ, chỉ giảm độ đậm (spec §2.2).
            isFetching && !loading && 'opacity-60',
          )}
          aria-busy={isFetching || loading || undefined}
        >
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50">
              {selectable && (
                <th scope="col" className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-neutral-300 accent-primary-700"
                    checked={allSelected}
                    ref={(el) => {
                      // Trạng thái "chọn một phần" chỉ đặt được qua DOM.
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={toggleAll}
                    aria-label="Chọn tất cả dòng"
                  />
                </th>
              )}
              {columns.map((col) => {
                const active = sort?.key === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={
                      active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined
                    }
                    className={cn(
                      'px-3 py-2 font-medium text-neutral-600',
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center',
                      !col.align && 'text-left',
                      col.className,
                    )}
                  >
                    {col.sortable && onSortChange ? (
                      <button
                        type="button"
                        onClick={() => handleSort(col.key)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded transition-colors hover:text-neutral-900',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600',
                          active && 'text-neutral-900',
                        )}
                      >
                        {col.header}
                        {active &&
                          (sort.direction === 'asc' ? (
                            <ArrowUp className="size-3.5" aria-hidden="true" />
                          ) : (
                            <ArrowDown className="size-3.5" aria-hidden="true" />
                          ))}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={i} className="border-b border-neutral-100 last:border-0">
                  {Array.from({ length: colSpan }).map((__, j) => (
                    <td key={j} className="px-3 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 && !isFetching ? (
              <tr>
                <td colSpan={colSpan} className="p-0">
                  <EmptyState
                    icon={Inbox}
                    title={emptyTitle}
                    description={emptyDescription}
                    action={emptyAction}
                    className="rounded-none border-0"
                  />
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const id = getRowId(row);
                const isSelected = selectedSet.has(id);
                return (
                  <tr
                    key={id}
                    // Dòng có thể nhấn thì phải là vùng bấm được cho bàn phím.
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      'border-b border-neutral-100 last:border-0',
                      onRowClick && 'cursor-pointer hover:bg-neutral-50',
                      isSelected && 'bg-primary-50',
                    )}
                  >
                    {selectable && (
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="size-4 rounded border-neutral-300 accent-primary-700"
                          checked={isSelected}
                          onChange={() => toggleOne(id)}
                          aria-label="Chọn dòng"
                        />
                      </td>
                    )}
                    {columns.map((col) => {
                      const content = col.cell(row);
                      return (
                        <td
                          key={col.key}
                          className={cn(
                            'px-3 py-2 text-neutral-800',
                            // Số căn phải + chữ số đều nhau để so sánh theo cột.
                            col.align === 'right' && 'text-right tabular-nums',
                            col.align === 'center' && 'text-center',
                            col.className,
                          )}
                        >
                          {content ?? <span className="text-neutral-400">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="flex items-center justify-center gap-2 sm:justify-end">
          {isFetching && !loading && (
            <Spinner size="xs" variant="neutral" label="Đang tải dữ liệu" />
          )}
          {pagination}
        </div>
      )}
    </div>
  );
}

/**
 * Phân trang chuẩn — đặt dưới bảng.
 *
 * Nút bị vô hiệu ở đầu/cuối thay vì ẩn đi, để vị trí không nhảy khi bấm.
 */
export function DataTablePagination({
  page,
  totalPages,
  onPageChange,
  disabled = false,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav className="flex items-center gap-2" aria-label="Phân trang">
      <Button
        variant="outline"
        size="sm"
        disabled={disabled || page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="Trang trước"
      >
        <ChevronLeft aria-hidden="true" />
        <span className="hidden sm:inline">Trang trước</span>
      </Button>
      <span className="text-sm text-neutral-600" aria-live="polite">
        Trang {page}/{totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled || page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        aria-label="Trang sau"
      >
        <span className="hidden sm:inline">Trang sau</span>
        <ChevronRight aria-hidden="true" />
      </Button>
    </nav>
  );
}
