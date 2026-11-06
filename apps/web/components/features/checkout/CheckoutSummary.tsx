'use client';

import * as React from 'react';
import { Calendar, Clock, Info, MapPin, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { BookingDetail } from '@bsc/shared';

import { Card } from '@/components/ui/card';
import { formatCurrency, formatDateWithWeekday, formatTimeRange } from '@/lib/utils/format';

export interface CheckoutSummaryProps {
  booking: BookingDetail;
  className?: string;
}

export function CheckoutSummary({ booking, className }: CheckoutSummaryProps) {
  const t = useTranslations('checkout');
  const { court } = booking;
  const remainingAtVenue = Math.max(0, booking.totalPrice - booking.depositAmount);

  // Tính số lượng block 30 phút
  const startTime = new Date(booking.during.start).getTime();
  const endTime = new Date(booking.during.end).getTime();
  const slotCount = Math.max(1, Math.round((endTime - startTime) / (30 * 60 * 1000)));

  return (
    <Card className={className ? `space-y-5 p-5 ${className}` : 'space-y-5 p-5'}>
      <div className="border-b border-neutral-200 pb-4 dark:border-neutral-800">
        <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
          {t('orderSummary')}
        </h2>
        <div className="mt-2 space-y-1">
          <p className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {court.venue.name}
          </p>
          <p className="flex items-start gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
            <MapPin className="mt-0.5 size-3.5 shrink-0 text-neutral-500" aria-hidden="true" />
            <span>{court.venue.address}</span>
          </p>
        </div>
      </div>

      <dl className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-neutral-600 dark:text-neutral-400">{t('court')}</dt>
          <dd className="font-medium text-neutral-900 dark:text-neutral-100">{court.name}</dd>
        </div>

        <div className="flex items-center justify-between gap-3">
          <dt className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
            <Calendar className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />
            <span>{t('matchDate')}</span>
          </dt>
          <dd className="font-medium text-neutral-900 dark:text-neutral-100">
            {formatDateWithWeekday(booking.during.start)}
          </dd>
        </div>

        <div className="flex items-center justify-between gap-3">
          <dt className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
            <Clock className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />
            <span>{t('matchTime')}</span>
          </dt>
          <dd className="text-right font-medium text-neutral-900 dark:text-neutral-100">
            {formatTimeRange(booking.during.start, booking.during.end)}{' '}
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              ({slotCount} khung 30p)
            </span>
          </dd>
        </div>

        <div className="border-t border-neutral-100 pt-3 dark:border-neutral-800">
          <div className="flex items-center justify-between gap-3 py-1">
            <dt className="text-neutral-600 dark:text-neutral-400">{t('totalPrice')}</dt>
            <dd className="font-semibold text-neutral-900 dark:text-neutral-100">
              {formatCurrency(booking.totalPrice)}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-md bg-primary-50/70 px-3 py-2.5 dark:bg-primary-950/40">
            <dt className="font-medium text-primary-900 dark:text-primary-200">
              {t('depositRequired')}
            </dt>
            <dd className="text-lg font-bold text-primary-700 dark:text-primary-300">
              {formatCurrency(booking.depositAmount)}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-3 py-1.5 text-xs text-neutral-500 dark:text-neutral-400">
            <dt>{t('remainingAtVenue')}</dt>
            <dd className="font-medium text-neutral-700 dark:text-neutral-300">
              {formatCurrency(remainingAtVenue)}{' '}
              <span className="text-[11px] text-neutral-500">
                ({t('remainingAtVenueHint')})
              </span>
            </dd>
          </div>
        </div>
      </dl>

      <div className="rounded-btn border border-border bg-bg-subtle p-3 text-xs text-text-secondary">
        <div className="mb-1 flex items-center gap-1.5 font-semibold text-text-primary">
          <ShieldCheck className="size-4 text-primary-600 dark:text-primary-400" aria-hidden="true" />
          <span>{t('cancellationPolicyTitle')}</span>
        </div>
        <p className="leading-relaxed">{t('cancellationPolicyNote')}</p>
      </div>
    </Card>
  );
}
