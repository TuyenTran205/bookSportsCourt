'use client';

import * as React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/errors';
import { cn } from '@/lib/utils/cn';

/**
 * ErrorState – docs/08 PHẦN B: trạng thái lỗi.
 *
 * Thông báo phải HỮU ÍCH với người dùng, không phải mã lỗi trần:
 *   ❌ "Error 409"   ✅ "Slot này vừa được người khác đặt. Vui lòng chọn slot khác."
 *
 * `ApiError` đã mang sẵn `message` tiếng Việt từ server, nên ưu tiên dùng nó;
 * chỉ khi lỗi không rõ nguồn (mất mạng, exception) mới rơi về câu chung.
 */
export interface ErrorStateProps {
  error: unknown;
  /** Gọi lại thao tác — thường là `refetch` của React Query. */
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ error, onRetry, className }: ErrorStateProps) {
  const t = useTranslations('common');

  const message = React.useMemo(() => {
    if (error instanceof ApiError) {
      // Lỗi mạng/máy chủ: câu của server thường chung chung, thay bằng câu
      // hướng dẫn cụ thể hơn.
      if (error.status >= 500) return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau ít phút.';
      if (error.status === 0) return 'Không kết nối được máy chủ. Kiểm tra lại kết nối mạng.';
      return error.message;
    }
    if (error instanceof Error) return error.message;
    return t('error');
  }, [error, t]);

  // 401/403 không phải sự cố tạm thời — "Thử lại" sẽ lặp lại đúng lỗi đó, nên
  // chỉ hiện nút khi lỗi có khả năng qua đi.
  const retryable =
    onRetry !== undefined &&
    !(error instanceof ApiError && (error.status === 401 || error.status === 403));

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-card border border-danger/30 bg-danger/5 px-6 py-10 text-center',
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-danger/10">
        <AlertTriangle className="size-6 text-danger" aria-hidden="true" />
      </div>
      <p className="max-w-md text-sm text-neutral-800">{message}</p>
      {retryable && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw aria-hidden="true" />
          {t('retry')}
        </Button>
      )}
    </div>
  );
}
