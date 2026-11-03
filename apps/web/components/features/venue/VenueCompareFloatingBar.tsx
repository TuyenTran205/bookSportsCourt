'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeftRight, Building2, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { MAX_COMPARE_VENUES, useVenueComparison } from '@/lib/hooks/useVenueComparison';
import { cn } from '@/lib/utils/cn';

export function VenueCompareFloatingBar() {
  const t = useTranslations('compare');
  const pathname = usePathname();
  const { venues, count, canCompare, removeVenue, clearVenues } = useVenueComparison();

  // Không hiển thị khi chưa có cơ sở nào hoặc đang ở chính trang so sánh
  if (count === 0 || pathname === '/venues/compare') {
    return null;
  }

  const emptySlotsCount = Math.max(0, MAX_COMPARE_VENUES - count);

  return (
    <aside
      aria-label="Thanh công cụ so sánh cơ sở thể thao"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg-card/95 backdrop-blur-md shadow-[0_-4px_16px_rgba(0,0,0,0.2)] text-text-primary"
    >
      <div className="container flex flex-wrap items-center justify-between gap-3 py-2.5">
        {/* Khu vực bên trái: Tiêu đề, badge & thumbnails */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-neutral-900 sm:text-sm dark:text-white">
              {t('floatingBarTitle')}
            </span>
            <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-700 dark:bg-primary-950/50 dark:text-primary-300">
              {count}/{MAX_COMPARE_VENUES}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {venues.map((venue) => (
              <div
                key={venue.id}
                className="group relative flex items-center gap-1.5 rounded-btn border border-neutral-200 bg-neutral-50 py-1 pl-1 pr-2 dark:border-neutral-700 dark:bg-neutral-800"
              >
                <div className="relative size-8 shrink-0 overflow-hidden rounded-md bg-neutral-200 dark:bg-neutral-700">
                  {venue.coverUrl ? (
                    <Image
                      src={venue.coverUrl}
                      alt=""
                      fill
                      unoptimized={venue.coverUrl.startsWith('data:')}
                      className="object-cover"
                      sizes="32px"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-neutral-400">
                      <Building2 className="size-4" aria-hidden="true" />
                    </div>
                  )}
                </div>

                <span className="max-w-[70px] truncate text-xs font-medium text-neutral-800 sm:max-w-[120px] dark:text-neutral-200">
                  {venue.name}
                </span>

                <button
                  type="button"
                  onClick={() => removeVenue(venue.id)}
                  aria-label={t('removeVenueAria', { name: venue.name })}
                  className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-danger dark:hover:bg-neutral-700"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </div>
            ))}

            {/* Các ô trống còn lại */}
            {Array.from({ length: emptySlotsCount }).map((_, idx) => (
              <div
                key={idx}
                className="hidden size-9 items-center justify-center rounded-btn border border-dashed border-neutral-300 text-xs text-neutral-400 sm:flex dark:border-neutral-700"
                title={t('selectMoreVenues')}
              >
                +
              </div>
            ))}
          </div>
        </div>

        {/* Khu vực bên phải: Nút Xóa tất cả & So sánh ngay */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearVenues}
            className="text-xs text-neutral-500 hover:text-danger dark:text-neutral-400"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">{t('clearAll')}</span>
          </Button>

          <Button
            asChild={canCompare}
            disabled={!canCompare}
            variant="primary"
            size="sm"
            className={cn('text-xs font-semibold', !canCompare && 'cursor-not-allowed opacity-60')}
            title={!canCompare ? t('needMinVenues') : undefined}
          >
            {canCompare ? (
              <Link href="/venues/compare">
                <ArrowLeftRight className="size-3.5" aria-hidden="true" />
                <span>{t('compareNow', { count })}</span>
              </Link>
            ) : (
              <span>
                <ArrowLeftRight className="size-3.5 inline mr-1.5" aria-hidden="true" />
                {t('compareNow', { count })}
              </span>
            )}
          </Button>
        </div>
      </div>
    </aside>
  );
}
