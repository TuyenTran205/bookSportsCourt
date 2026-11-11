'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Timer } from 'lucide-react';

import { cn } from '@/lib/utils/cn';
import { formatCountdown } from '@/lib/utils/format';

/**
 * HoldCountdown – docs/07 mục 10 (BookingSummary).
 *
 * Đồng hồ đếm ngược thời gian giữ chỗ (mặc định 10 phút, `HOLD_MINUTES`).
 *
 * Vì sao đếm bằng `Date.now()` chứ không trừ dần mỗi giây: khi tab bị ẩn,
 * trình duyệt bóp nhịp `setInterval` và đồng hồ trừ dần sẽ chạy chậm hơn thực
 * tế. Tính theo mốc hết hạn tuyệt đối thì luôn đúng dù tab ngủ bao lâu.
 *
 * `onExpire` chỉ gọi MỘT lần, và không gọi nếu `expiresAt` đã qua ngay từ đầu —
 * trường hợp đó cha tự xử lý khi render.
 */

export interface HoldCountdownProps {
  /** Mốc hết hạn giữ chỗ (ISO). */
  expiresAt: string;
  onExpire?: () => void;
  className?: string;
}

export function HoldCountdown({ expiresAt, onExpire, className }: HoldCountdownProps) {
  const t = useTranslations('booking');

  const target = React.useMemo(() => new Date(expiresAt).getTime(), [expiresAt]);

  const [remaining, setRemaining] = React.useState(() => Math.max(0, target - Date.now()));
  // Chốt chặn để `onExpire` không bắn lặp mỗi giây sau khi đã hết giờ.
  const firedRef = React.useRef(false);

  React.useEffect(() => {
    firedRef.current = false;
    setRemaining(Math.max(0, target - Date.now()));
  }, [target]);

  React.useEffect(() => {
    const tick = () => {
      const left = Math.max(0, target - Date.now());
      setRemaining(left);
      if (left === 0 && !firedRef.current) {
        firedRef.current = true;
        onExpire?.();
      }
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [target, onExpire]);

  const expired = remaining <= 0;
  // Dưới 2 phút thì đổi sang màu cảnh báo — đủ sớm để người dùng kịp phản ứng.
  const urgent = !expired && remaining <= 2 * 60 * 1000;

  return (
    <div
      role="timer"
      // `aria-live` để trình đọc màn hình không đọc mãi; chỉ đọc khi đổi trạng thái.
      aria-live="off"
      className={cn(
        'flex items-center gap-2 rounded-input border px-3 py-2',
        expired
          ? 'border-danger/30 bg-danger/5 text-danger'
          : urgent
            ? 'border-amber-300 bg-amber-50 text-amber-800'
            : 'border-neutral-200 bg-neutral-50 text-neutral-700',
        className,
      )}
    >
      <Timer className="size-4 shrink-0" aria-hidden="true" />
      <span className="text-sm">
        {expired ? t('holdExpiredTitle') : t('holdCountdownLabel')}
      </span>
      <span className="ml-auto font-mono text-lg font-bold tabular-nums">
        {formatCountdown(remaining)}
      </span>
      {urgent && <span className="sr-only">{t('holdUrgent')}</span>}
    </div>
  );
}
