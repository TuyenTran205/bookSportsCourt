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
      <div className="border-b border-border pb-4">
        <h2 className="text-lg font-bold text-text-primary">
          {t('orderSummary')}
        </h2>
        <div className="mt-2 space-y-1">
          <p className="text-base font-semibold text-text-primary">
            {court.venue.name}
          </p>
          <p className="flex items-start gap-1.5 text-xs text-text-secondary">
            <MapPin className="mt-0.5 size-3.5 shrink-0 text-text-secondary" aria-hidden="true" />
            <span>{court.venue.address}</span>
          </p>
        </div>
      </div>

      <dl className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-text-secondary">{t('court')}</dt>
          <dd className="font-medium text-text-primary">{court.name}</dd>
        </div>

        <div className="flex items-center justify-between gap-3">
          <dt className="flex items-center gap-1.5 text-text-secondary">
            <Calendar className="size-4 shrink-0 text-text-disabled" aria-hidden="true" />
            <span>{t('matchDate')}</span>
          </dt>
          <dd className="font-medium text-text-primary">
            {formatDateWithWeekday(booking.during.start)}
          </dd>
        </div>

        <div className="flex items-center justify-between gap-3">
          <dt className="flex items-center gap-1.5 text-text-secondary">
            <Clock className="size-4 shrink-0 text-text-disabled" aria-hidden="true" />
            <span>{t('matchTime')}</span>
          </dt>
          <dd className="text-right font-medium text-text-primary">
            {formatTimeRange(booking.during.start, booking.during.end)}{' '}
            <span className="text-xs text-text-secondary">
              ({slotCount} khung 30p)
            </span>
          </dd>
        </div>

        <div className="border-t border-border pt-3">
          <div className="flex items-center justify-between gap-3 py-1">
            <dt className="text-text-secondary">{t('totalPrice')}</dt>
            <dd className="font-semibold text-text-primary">
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

          <div className="flex items-center justify-between gap-3 py-1.5 text-xs text-text-secondary">
            <dt>{t('remainingAtVenue')}</dt>
            <dd className="font-medium text-text-primary">
              {formatCurrency(remainingAtVenue)}{' '}
              <span className="text-[11px] text-text-secondary">
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
