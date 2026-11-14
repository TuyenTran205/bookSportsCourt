'use client';

import * as React from 'react';
import { CalendarCheck, Clock, Info, MapPin, ShieldCheck } from 'lucide-react';
import type { CancellationPolicy, Slot } from '@bsc/shared';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatCurrency, formatDateWithWeekday, formatTimeRange } from '@/lib/utils/format';

export interface BookingConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venueName: string;
  venueAddress?: string | null;
  courtName: string;
  sportName?: string | null;
  date: string;
  timeRange: string | null;
  slots: Slot[];
  totalPrice: number;
  cancellationPolicy?: CancellationPolicy | null;
  pending?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function BookingConfirmDialog({
  open,
  onOpenChange,
  venueName,
  venueAddress,
  courtName,
  sportName,
  date,
  timeRange,
  slots,
  totalPrice,
  cancellationPolicy,
  pending = false,
  onConfirm,
}: BookingConfirmDialogProps) {
  const durationMinutes = slots.length * 30;
  const durationHours = durationMinutes / 60;
  const durationLabel =
    durationMinutes >= 60
      ? `${Number.isInteger(durationHours) ? durationHours : durationHours.toFixed(1)} giờ`
      : `${durationMinutes} phút`;

  const depositPercent = cancellationPolicy?.depositPercent ?? null;
  const depositEstimate =
    depositPercent !== null ? Math.round((totalPrice * depositPercent) / 100) : null;

  const formattedDate = React.useMemo(() => {
    if (!date) return '—';
    try {
      return formatDateWithWeekday(`${date}T00:00:00+07:00`);
    } catch {
      return date;
    }
  }, [date]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!pending) onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-text-primary">
            <CalendarCheck className="size-5 text-primary-600" aria-hidden="true" />
            <span>Xác nhận đặt sân</span>
          </DialogTitle>
          <DialogDescription>
            Kiểm tra lại thông tin cơ sở, sân con, khung giờ và chi phí trước khi tạo đơn giữ chỗ.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="space-y-2.5 rounded-lg border border-border bg-bg-subtle/60 p-4">
            <div>
              <p className="text-xs text-text-secondary">Cơ sở thể thao</p>
              <p className="font-semibold text-text-primary">{venueName}</p>
              {venueAddress && (
                <p className="mt-0.5 flex items-start gap-1 text-xs text-text-secondary">
                  <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  <span>{venueAddress}</span>
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2.5 border-t border-border pt-2.5 sm:grid-cols-2">
              <div>
                <p className="text-xs text-text-secondary">Sân đã chọn</p>
                <p className="font-medium text-text-primary">
                  {courtName}
                  {sportName ? ` (${sportName})` : ''}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-secondary">Ngày chơi</p>
                <p className="font-medium text-text-primary">{formattedDate}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 border-t border-border pt-2.5 sm:grid-cols-2">
              <div>
                <p className="text-xs text-text-secondary">Khung giờ</p>
                <p className="flex items-center gap-1 font-semibold text-text-primary">
                  <Clock className="size-3.5 text-primary-600" aria-hidden="true" />
                  <span>{timeRange ?? '—'}</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-text-secondary">Thời lượng</p>
                <p className="font-medium text-text-primary">
                  {durationLabel} ({slots.length} block 30 phút)
                </p>
              </div>
            </div>

            {slots.length > 0 && (
              <div className="border-t border-border pt-2.5">
                <p className="mb-1.5 text-xs text-text-secondary">Chi tiết các block giờ</p>
                <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                  {slots.map((slot) => (
                    <span
                      key={slot.start}
                      className="inline-flex items-center gap-1 rounded border border-border bg-bg-card px-2 py-0.5 text-xs text-text-primary"
                    >
                      <span>{formatTimeRange(slot.start, slot.end)}</span>
                      <span className="font-semibold text-primary-600">
                        · {formatCurrency(slot.price)}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5 rounded-lg border border-primary-200 bg-primary-50/60 p-4 dark:border-primary-900/50 dark:bg-primary-950/30">
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">Tổng tiền sân dự kiến</span>
              <span className="text-lg font-bold tabular-nums text-primary-700 dark:text-primary-400">
                {formatCurrency(totalPrice)}
              </span>
            </div>
            {depositPercent !== null && depositEstimate !== null && (
              <div className="flex items-center justify-between text-xs text-text-secondary">
                <span>Tiền đặt cọc cần thanh toán ({depositPercent}%)</span>
                <span className="font-semibold tabular-nums text-text-primary">
                  {formatCurrency(depositEstimate)}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-border bg-bg-card p-3 text-xs text-text-secondary">
            {cancellationPolicy ? (
              <>
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary-600" aria-hidden="true" />
                <div>
                  <span className="font-semibold text-text-primary">Chính sách huỷ đơn: </span>
                  {cancellationPolicy.cancelBeforeHours > 0
                    ? `Cần huỷ trước giờ bắt đầu tối thiểu ${cancellationPolicy.cancelBeforeHours} giờ để được hoàn ${cancellationPolicy.refundPercent}% tiền cọc.`
                    : `Có thể huỷ trước giờ bắt đầu và được hoàn ${cancellationPolicy.refundPercent}% tiền cọc.`}
                </div>
              </>
            ) : (
              <>
                <Info className="mt-0.5 size-4 shrink-0 text-text-secondary" aria-hidden="true" />
                <span>
                  Sau khi xác nhận, hệ thống sẽ giữ chỗ tạm thời để bạn chuyển khoản đặt cọc.
                </span>
              </>
            )}
          </div>
        </div>

        <DialogFooter className="mt-2 gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Quay lại
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={pending}
            onClick={() => void onConfirm()}
          >
            Xác nhận &amp; Giữ chỗ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
