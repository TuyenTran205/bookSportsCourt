import * as React from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils/cn';

export type PageSkeletonVariant = 'dashboard' | 'list' | 'detail' | 'form';

export interface PageSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant: PageSkeletonVariant;
  className?: string;
}

/** Khối xám dùng chung — đồng bộ màu `bg-neutral-100` theo spec §6.3. */
function Bar({ className, ...props }: React.ComponentProps<typeof Skeleton>) {
  return <Skeleton className={cn('bg-neutral-100', className)} {...props} />;
}

/**
 * Khung tải trang có hình dạng khớp với layout thật (Anti-AI Design).
 * Thay thế cho PageLoader toàn khối trong các file `loading.tsx`.
 *
 * Đặc tả: docs/specs/instant-navigation-loading-spec.md §6.1, §6.3, §7.
 * - Tái sử dụng `Skeleton` có sẵn (`animate-pulse`).
 * - Không có chữ/nội dung giả, không gradient tím/hồng, không shimmer màu.
 * - Khối dùng `rounded-md`, card dùng `rounded-card`, nút dùng `rounded-btn`.
 */
export function PageSkeleton({ variant, className, ...props }: PageSkeletonProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Đang tải dữ liệu"
      aria-busy="true"
      className={cn('w-full min-w-0', className)}
      {...props}
    >
      <span className="sr-only">Đang tải dữ liệu…</span>

      {variant === 'dashboard' && <DashboardSkeleton />}
      {variant === 'list' && <ListSkeleton />}
      {variant === 'detail' && <DetailSkeleton />}
      {variant === 'form' && <FormSkeleton />}
    </div>
  );
}

/** Variant: dashboard — dùng cho /owner/dashboard, /owner/*, /admin/* */
function DashboardSkeleton() {
  return (
    <div className="w-full space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Tiêu đề trang */}
      <div className="space-y-2">
        <Bar className="h-8 w-48" />
        <Bar className="h-4 w-72" />
      </div>

      {/* 4 thẻ chỉ số (KPIs) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-card border border-neutral-200 bg-white p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <Bar className="h-4 w-28" />
              <Bar className="size-8 rounded-lg" />
            </div>
            <Bar className="h-7 w-32" />
          </div>
        ))}
      </div>

      {/* 2 khối lớn: biểu đồ/timeline & danh sách gần đây */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-card border border-neutral-200 bg-white p-6 space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <Bar className="h-5 w-40" />
            <Bar className="h-8 w-28 rounded-btn" />
          </div>
          <Bar className="h-64 w-full rounded-md" />
        </div>

        <div className="rounded-card border border-neutral-200 bg-white p-6 space-y-3 lg:col-span-1">
          <Bar className="h-5 w-32 mb-4" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-neutral-100 last:border-0">
              <Bar className="size-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Bar className="h-4 w-3/4" />
                <Bar className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Variant: list — dùng cho /venues, /bookings, /favorites */
function ListSkeleton() {
  return (
    <div className="container py-8 space-y-6">
      {/* Tiêu đề & thanh tìm kiếm */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <Bar className="h-8 w-48" />
          <Bar className="h-4 w-80" />
        </div>
        <div className="flex items-center gap-2">
          <Bar className="h-10 w-64 rounded-md" />
          <Bar className="h-10 w-24 rounded-btn" />
        </div>
      </div>

      {/* Bộ lọc tabs/chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Bar key={i} className="h-9 w-24 rounded-full shrink-0" />
        ))}
      </div>

      {/* Lưới thẻ kết quả */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-card border border-neutral-200 bg-white overflow-hidden space-y-3"
          >
            <Bar className="h-44 w-full rounded-none" />
            <div className="p-4 pt-1 space-y-3">
              <Bar className="h-5 w-4/5" />
              <Bar className="h-4 w-3/5" />
              <div className="pt-2 flex items-center justify-between border-t border-neutral-100">
                <Bar className="h-5 w-24" />
                <Bar className="h-8 w-20 rounded-btn" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Variant: detail — dùng cho /venues/[slug], /bookings/[id] */
function DetailSkeleton() {
  return (
    <div className="container py-8 space-y-6">
      {/* Breadcrumb */}
      <Bar className="h-4 w-56" />

      {/* Ảnh bìa / Hero banner */}
      <Bar className="h-64 sm:h-80 w-full rounded-card" />

      {/* Bố cục 2 cột: Nội dung chính & Thẻ đặt sân cố định */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Cột trái */}
        <div className="space-y-6 lg:col-span-2">
          <div className="space-y-2">
            <Bar className="h-8 w-3/4" />
            <Bar className="h-4 w-1/2" />
          </div>

          <div className="rounded-card border border-neutral-200 bg-white p-6 space-y-4">
            <Bar className="h-5 w-36" />
            <div className="space-y-2">
              <Bar className="h-4 w-full" />
              <Bar className="h-4 w-5/6" />
              <Bar className="h-4 w-4/6" />
            </div>
          </div>

          <div className="rounded-card border border-neutral-200 bg-white p-6 space-y-4">
            <Bar className="h-5 w-44" />
            {/* Lưới ô block lịch sân */}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <Bar key={i} className="h-10 rounded-md" />
              ))}
            </div>
          </div>
        </div>

        {/* Cột phải: Thẻ tóm tắt / Đặt chỗ */}
        <div className="lg:col-span-1">
          <div className="rounded-card border border-neutral-200 bg-white p-6 space-y-4">
            <Bar className="h-6 w-32" />
            <Bar className="h-10 w-full rounded-md" />
            <div className="space-y-2 py-3 border-y border-neutral-100">
              <div className="flex justify-between">
                <Bar className="h-4 w-20" />
                <Bar className="h-4 w-24" />
              </div>
              <div className="flex justify-between">
                <Bar className="h-4 w-16" />
                <Bar className="h-4 w-20" />
              </div>
            </div>
            <Bar className="h-11 w-full rounded-btn" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Variant: form — dùng cho /profile, auth pages */
function FormSkeleton() {
  return (
    <div className="container flex min-h-[50vh] items-center justify-center py-10">
      <div className="w-full max-w-lg rounded-card border border-neutral-200 bg-white p-6 sm:p-8 space-y-6">
        <div className="space-y-2 text-center sm:text-left">
          <Bar className="h-7 w-48 mx-auto sm:mx-0" />
          <Bar className="h-4 w-64 mx-auto sm:mx-0" />
        </div>

        <div className="space-y-4 pt-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Bar className="h-4 w-24" />
              <Bar className="h-10 w-full rounded-md" />
            </div>
          ))}
        </div>

        <div className="pt-2 flex justify-end gap-3">
          <Bar className="h-10 w-24 rounded-btn" />
          <Bar className="h-10 w-32 rounded-btn" />
        </div>
      </div>
    </div>
  );
}
