import { cn } from '@/lib/utils/cn';

/**
 * Skeleton – trạng thái đang tải (docs/08, PHẦN B: loading state).
 * Dùng `animate-pulse` của Tailwind, tự tắt khi `prefers-reduced-motion`.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-neutral-200', className)}
      {...props}
    />
  );
}
