'use client';

/**
 * Thanh điều khiển trạng thái nguồn tile bản đồ (SPEC-MAP-002).
 *
 * Chỉ chiếm một dải mỏng ở góc dưới bên trái, không che khuất thao tác bản đồ.
 * - Loading kéo dài > 600ms: hiện chỉ báo "Đang tối ưu nguồn bản đồ…".
 * - Đang chuyển provider: hiện thông báo chuyển nguồn dự phòng.
 * - Đã ổn định lại sau sự cố: hiện trạng thái thành công 2 giây rồi tự ẩn.
 * - Toàn bộ provider thất bại: hiện nút "Thử lại" thao tác được bằng bàn phím.
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Check, Loader2, RefreshCw } from 'lucide-react';

import type { TileProviderConfig, MapResilienceStatus } from '@/lib/map/types';
import { cn } from '@/lib/utils/cn';
import { useOptionalTileResilience } from './TileResilienceContext';

export interface MapResilienceControlProps {
  /** Ghi đè trạng thái (mặc định đọc từ TileResilienceProvider) */
  status?: MapResilienceStatus;
  /** Ghi đè provider đang hoạt động */
  activeProvider?: TileProviderConfig;
  /** Ghi đè hành động thử lại */
  onRetry?: () => void;
  /** Class tuỳ biến bổ sung */
  className?: string;
}

const LOADING_DELAY_MS = 600;
const SUCCESS_VISIBLE_MS = 2000;

export function MapResilienceControl({
  status: statusProp,
  activeProvider: providerProp,
  onRetry: onRetryProp,
  className,
}: MapResilienceControlProps) {
  const t = useTranslations('map');
  const shared = useOptionalTileResilience();

  const status: MapResilienceStatus = statusProp ?? shared?.status ?? 'ready';
  const activeProvider = providerProp ?? shared?.activeProvider;
  const onRetry = onRetryProp ?? shared?.retry;

  const [showLoading, setShowLoading] = React.useState(false);
  const [showRecovered, setShowRecovered] = React.useState(false);
  const previousStatusRef = React.useRef<MapResilienceStatus>(status);

  // Trì hoãn chỉ báo loading 600ms để tránh nhấp nháy khi mạng nhanh
  React.useEffect(() => {
    if (status !== 'loading') {
      setShowLoading(false);
      return undefined;
    }
    const timer = setTimeout(() => setShowLoading(true), LOADING_DELAY_MS);
    return () => clearTimeout(timer);
  }, [status]);

  // Khi vừa phục hồi từ trạng thái suy giảm: hiện thông báo thành công rồi tự ẩn
  React.useEffect(() => {
    const previous = previousStatusRef.current;
    previousStatusRef.current = status;

    if (status === 'ready' && previous === 'degraded') {
      setShowRecovered(true);
      const timer = setTimeout(() => setShowRecovered(false), SUCCESS_VISIBLE_MS);
      return () => clearTimeout(timer);
    }
    if (status !== 'ready') {
      setShowRecovered(false);
    }
    return undefined;
  }, [status]);

  const variant: MapResilienceStatus | 'recovered' | null = (() => {
    if (status === 'failed') return 'failed';
    if (status === 'degraded') return 'degraded';
    if (status === 'loading') return showLoading ? 'loading' : null;
    return showRecovered ? 'recovered' : null;
  })();

  if (variant === null) return null;

  const providerLabel = activeProvider ? t('mapProviderLabel', { name: activeProvider.name }) : null;

  return (
    <div
      className={cn(
        'pointer-events-none absolute bottom-3 left-3 z-[1000] max-w-[calc(100%-24px)] select-none',
        className,
      )}
    >
      {variant === 'loading' && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-auto inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 shadow-sm"
        >
          <Loader2 className="size-3.5 shrink-0 animate-spin text-neutral-500" aria-hidden="true" />
          <span>{t('mapLoading')}</span>
        </div>
      )}

      {variant === 'degraded' && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-auto inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs text-neutral-700 shadow-sm"
        >
          <Loader2 className="size-3.5 shrink-0 animate-spin text-neutral-500" aria-hidden="true" />
          <span>{t('providerSwitched')}</span>
        </div>
      )}

      {variant === 'recovered' && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-auto inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 shadow-sm"
        >
          <Check className="size-3.5 shrink-0 text-primary-600" aria-hidden="true" />
          <span>{providerLabel ?? t('providerSwitched')}</span>
        </div>
      )}

      {variant === 'failed' && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-auto flex items-center gap-2 rounded-md border border-neutral-200 bg-white p-1.5 pl-3 text-xs text-neutral-900 shadow-sm"
        >
          <span className="font-medium">{t('allProvidersFailed')}</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-900 transition-colors duration-150 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2 active:bg-neutral-200"
            >
              <RefreshCw className="size-3.5 shrink-0 text-neutral-600" aria-hidden="true" />
              <span>{t('retryAction')}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default MapResilienceControl;
