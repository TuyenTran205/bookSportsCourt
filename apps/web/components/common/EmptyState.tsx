import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils/cn';

/**
 * EmptyState – docs/07 mục "Trạng thái rỗng".
 *
 * Bắt buộc có đủ ba phần: icon Lucide, tiêu đề ngắn, hành động gợi ý.
 * Không bao giờ để trắng.
 */
export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Nút hành động — thường là một `<Button>` hoặc `<Link>`. */
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border bg-bg-card px-6 py-12 text-center',
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-bg-subtle">
        <Icon className="size-6 text-text-secondary" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-base font-medium text-text-primary">{title}</p>
        {description && <p className="max-w-md text-sm text-text-secondary">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
