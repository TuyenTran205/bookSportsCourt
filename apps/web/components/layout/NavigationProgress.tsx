'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { NAV_TIMING } from '@/lib/navigation/constants';
import {
  useNavigation,
  useNavigationCompletion,
  useNavigationListener,
} from '@/lib/navigation/navigate';
import { cn } from '@/lib/utils/cn';

/**
 * Thanh tiến trình toàn cục (Top Progress Bar) & Vùng thông báo trợ năng.
 * Đặc tả: docs/specs/instant-navigation-loading-spec.md §3.3, §5.3, §6.1.
 *
 * Chuẩn Anti-AI:
 * - Chiều cao 2px (h-0.5), bám đỉnh màn hình (fixed top-0 z-[60]).
 * - Không shadow, không gradient neon, màu thương hiệu bg-primary-600.
 * - Thanh tiến trình là aria-hidden="true" để không tạo tiếng ồn screen-reader;
 *   thông tin trợ năng được chuyển qua một live region chuyên dụng.
 */
export function NavigationProgress() {
  const t = useTranslations('shell');
  const { phase, progress, visible, fading } = useNavigation();

  // Bắt sự kiện click link nội bộ toàn tài liệu
  useNavigationListener(true);
  // Theo dõi đổi route để hoàn tất thanh
  useNavigationCompletion();

  const [slowHint, setSlowHint] = React.useState(false);
  const [announcement, setAnnouncement] = React.useState('');

  // Quản lý thông báo trợ năng: sau 800ms mới báo "kết nối chậm" để không làm phiền khi mạng nhanh.
  React.useEffect(() => {
    if (phase === 'pending' && visible) {
      const slowTimer = setTimeout(() => {
        setSlowHint(true);
        setAnnouncement(t('navigatingSlow'));
      }, NAV_TIMING.SLOW_HINT_MS);

      return () => {
        clearTimeout(slowTimer);
      };
    }

    if (phase === 'completing') {
      setAnnouncement(t('navigationComplete'));
      const clearTimer = setTimeout(() => {
        setAnnouncement('');
        setSlowHint(false);
      }, 1000);

      return () => {
        clearTimeout(clearTimer);
      };
    }

    setSlowHint(false);
    return undefined;
  }, [phase, visible, t]);

  if (!visible && phase === 'idle') {
    return (
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>
    );
  }

  return (
    <>
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none fixed left-0 right-0 top-0 z-[60] h-0.5 bg-transparent',
        )}
      >
        <div
          data-testid="navigation-progress-bar"
          style={{ width: `${progress}%` }}
          className={cn(
            'h-full bg-primary-600 transition-[width,opacity] duration-200 ease-out motion-reduce:transition-none',
            fading && 'opacity-0 duration-200',
          )}
        />
      </div>

      <div className="sr-only" role="status" aria-live="polite">
        {announcement || (slowHint ? t('navigatingSlow') : '')}
      </div>
    </>
  );
}
