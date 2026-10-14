'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { CalendarCheck } from 'lucide-react';
import type { OwnerBookingItem } from '@/lib/api/endpoints/owner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatCurrency, formatDateTime, formatTimeRange } from '@/lib/utils/format';

export interface OwnerBookingDetailDrawerProps {
  booking: OwnerBookingItem | null;
  onClose: () => void;
}

export function OwnerBookingDetailDrawer({ booking, onClose }: OwnerBookingDetailDrawerProps) {
  const t = useTranslations('owner');
  const tCommon = useTranslations('common');

  if (!booking) return null;

  return (
    <Dialog open={booking !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="size-5 text-primary-600" aria-hidden="true" />
            {t('bookingDetailTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('colBookingCode')}: <strong className="text-neutral-900">{booking.id}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2 text-sm">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
            <span className="text-neutral-500">{t('status')}</span>
            <StatusBadge kind="booking" status={booking.status} />
          </div>

          <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
            <span className="text-neutral-500">Thanh toán</span>
            {booking.paymentStatus ? (
              <StatusBadge kind="payment" status={booking.paymentStatus} />
            ) : (
              <span className="text-neutral-400">—</span>
            )}
          </div>

          <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
            <span className="text-neutral-500">{t('colCustomer')}</span>
            <span className="font-medium text-neutral-900">
              {booking.customerName}
              {booking.customerPhone ? ` (${booking.customerPhone})` : ''}
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
            <span className="text-neutral-500">{t('colCourtVenue')}</span>
            <span className="font-medium text-neutral-900">{booking.courtName}</span>
          </div>

          <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
            <span className="text-neutral-500">{t('source')}</span>
            <span className="font-medium text-neutral-900">
              {booking.source === 'manual' ? t('sourceManual') : t('sourceOnline')}
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
            <span className="text-neutral-500">{t('time')}</span>
            <span className="font-medium text-neutral-900">
              {formatTimeRange(booking.during.start, booking.during.end)}
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
            <span className="text-neutral-500">Tiền cọc</span>
            <span className="font-medium text-neutral-900">
              {formatCurrency(booking.depositAmount)}
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
            <span className="text-neutral-500">{t('totalAmount')}</span>
            <span className="text-base font-bold text-neutral-900">
              {formatCurrency(booking.totalPrice)}
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
            <span className="text-neutral-500">Ngày tạo</span>
            <span className="text-xs text-neutral-600">
              {formatDateTime(booking.createdAt)}
            </span>
          </div>

          {booking.note && (
            <div className="mt-1 rounded-btn bg-neutral-50 p-3 text-xs text-neutral-700">
              <strong className="block text-neutral-900">Ghi chú:</strong>
              {booking.note}
            </div>
          )}

          {booking.cancelReason && (
            <div className="mt-1 rounded-btn bg-danger/10 p-3 text-xs text-danger">
              <strong className="block">Lý do huỷ:</strong>
              {booking.cancelReason}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {tCommon('close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
