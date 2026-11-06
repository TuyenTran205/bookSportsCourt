'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Calendar,
  Clock,
  CreditCard,
  MapPin,
  User,
} from 'lucide-react';
import type { AdminBookingRow } from '@/lib/api/endpoints/admin';

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
import { formatCurrency, formatDate, formatTimeRange } from '@/lib/utils/format';

export interface AdminBookingDetailDrawerProps {
  booking: AdminBookingRow | null;
  open: boolean;
  onClose: () => void;
}

export function AdminBookingDetailDrawer({
  booking,
  open,
  onClose,
}: AdminBookingDetailDrawerProps) {
  const tCommon = useTranslations('common');

  if (!booking) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="font-mono text-base">{booking.id}</DialogTitle>
            <StatusBadge kind="booking" status={booking.status} />
          </div>
          <DialogDescription>
            Được tạo lúc {formatDate(booking.createdAt)} • Nguồn:{' '}
            <span className="font-medium">
              {booking.source === 'online' ? 'Trực tuyến (Online)' : 'Tại quầy (Manual)'}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2 text-sm">
          {/* Thông tin cơ sở & sân */}
          <div className="rounded-card border border-neutral-200 bg-neutral-50/50 p-3">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary-600" />
              <div>
                <p className="font-semibold text-neutral-900">{booking.venueName}</p>
                <p className="text-xs text-neutral-600">Sân chơi: <strong>{booking.courtName}</strong></p>
              </div>
            </div>
          </div>

          {/* Thời gian */}
          <div className="rounded-card border border-neutral-200 bg-neutral-50/50 p-3">
            <div className="flex items-start gap-2">
              <Clock className="mt-0.5 size-4 shrink-0 text-primary-600" />
              <div>
                <p className="font-semibold text-neutral-900">
                  {formatTimeRange(booking.during.start, booking.during.end)}
                </p>
                <p className="text-xs text-neutral-600">
                  Ngày chơi: {formatDate(booking.during.start)}
                </p>
              </div>
            </div>
          </div>

          {/* Khách hàng */}
          <div className="rounded-card border border-neutral-200 bg-neutral-50/50 p-3">
            <div className="flex items-start gap-2">
              <User className="mt-0.5 size-4 shrink-0 text-primary-600" />
              <div>
                <p className="font-semibold text-neutral-900">{booking.customerName}</p>
                <p className="text-xs text-neutral-600">
                  SĐT: {booking.guestPhone ?? '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Tài chính */}
          <div className="rounded-card border border-neutral-200 bg-neutral-50/50 p-3">
            <div className="flex items-start gap-2">
              <CreditCard className="mt-0.5 size-4 shrink-0 text-primary-600" />
              <div className="w-full">
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-500">Tổng tiền đơn:</span>
                  <span className="font-bold tabular-nums text-neutral-900">
                    {formatCurrency(booking.totalPrice)}
                  </span>
                </div>
                <div className="mt-1 flex justify-between text-xs">
                  <span className="text-neutral-500">Tiền cọc yêu cầu:</span>
                  <span className="tabular-nums text-neutral-700">
                    {formatCurrency(booking.depositAmount)}
                  </span>
                </div>
                {booking.paymentStatus && (
                  <div className="mt-2 flex items-center justify-between border-t border-neutral-200 pt-2 text-xs">
                    <span className="text-neutral-500">Trạng thái thanh toán:</span>
                    <StatusBadge kind="payment" status={booking.paymentStatus} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Ghi chú hoặc lý do huỷ */}
          {booking.note && (
            <div className="rounded-card bg-neutral-100 p-3 text-xs text-neutral-700">
              <span className="font-semibold">Ghi chú:</span> {booking.note}
            </div>
          )}

          {booking.status === 'cancelled' && (
            <div className="rounded-card border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              <p className="font-semibold">Đơn đã bị huỷ</p>
              {booking.cancelledAt && (
                <p className="mt-0.5">Thời gian huỷ: {formatDate(booking.cancelledAt)}</p>
              )}
              {booking.cancelReason && (
                <p className="mt-0.5">Lý do: {booking.cancelReason}</p>
              )}
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
