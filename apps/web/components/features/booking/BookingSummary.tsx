'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { CalendarDays, Clock, MapPin } from 'lucide-react';

import type { BookingDetail, Slot } from '@bsc/shared';

import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils/cn';
import { formatCurrency, formatDateLong, formatTime } from '@/lib/utils/format';

/**
 * BookingSummary – docs/07 mục 10.
 *
 * Tóm tắt đơn đặt sân: cơ sở, sân, ngày, giờ bắt đầu – kết thúc, số block,
 * đơn giá từng block, tổng giá.
 *
 * Hai chế độ dùng chung một component:
 * - `mode="cart"`: đang chọn block, chưa giữ chỗ — nhận `slots` đã chọn.
 * - `mode="booking"`: đã có đơn thật — nhận `booking` từ server.
 *
 * Gộp làm một để bố cục và cách tính tiền không lệch nhau giữa hai màn.
 */

/** Phần dùng chung cho cả hai chế độ. */
type BookingSummaryBase = {
  className?: string;
  /** Nút CTA ở cuối — cha quyết định nội dung. */
  footer?: React.ReactNode;
};

/**
 * Hai chế độ là union phân biệt bằng `mode`, khai báo dạng `Base & (A | B)`
 * sẽ làm TS không narrow được `props.booking` / `props.slots` — nên phải
 * phân phối union ra từng nhánh.
 */
export type BookingSummaryProps =
  | (BookingSummaryBase & {
      mode: 'cart';
      /** Slot đang chọn, theo thứ tự thời gian. Rỗng = chưa chọn gì. */
      slots: readonly Slot[];
      venueName: string;
      courtName: string;
    })
  | (BookingSummaryBase & { mode: 'booking'; booking: BookingDetail });

/** Số phút mỗi block — dùng để suy số block từ khoảng thời gian. */
const BLOCK_MINUTES = 30;

export function BookingSummary(props: BookingSummaryProps) {
  const t = useTranslations('booking');
  const { className, footer } = props;

  // Chuẩn hoá hai chế độ về cùng một hình dạng để phần render bên dưới
  // không phải rẽ nhánh theo `mode` ở từng dòng.
  let venueName: string;
  let courtName: string;
  let start: string | null;
  let end: string | null;
  let total: number;
  let count: number;
  let status: BookingDetail['status'] | null = null;
  let depositAmount = 0;
  let slots: readonly Slot[] = [];

  if (props.mode === 'cart') {
    const { slots: selected } = props;
    venueName = props.venueName;
    courtName = props.courtName;
    start = selected[0]?.start ?? null;
    end = selected[selected.length - 1]?.end ?? null;
    total = selected.reduce((sum, s) => sum + s.price, 0);
    count = selected.length;
    slots = selected;
  } else {
    const { booking } = props;
    venueName = booking.court.venue.name;
    courtName = booking.court.name;
    start = booking.during.start;
    end = booking.during.end;
    total = booking.totalPrice;
    // Đơn thật không mang danh sách block, nên suy số block từ khoảng thời gian.
    count = Math.max(
      1,
      Math.round(
        (new Date(booking.during.end).getTime() - new Date(booking.during.start).getTime()) /
          (BLOCK_MINUTES * 60 * 1000),
      ),
    );
    status = booking.status;
    depositAmount = booking.depositAmount;
  }

  const isCart = props.mode === 'cart';

  return (
    <aside
      className={cn(
        'flex flex-col gap-4 rounded-card border border-neutral-200 bg-white p-4 sm:p-5',
        className,
      )}
      aria-label={t('summary')}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-lg font-medium text-neutral-900">{t('summary')}</h2>
        {status && <StatusBadge kind="booking" status={status} />}
      </div>

      <dl className="flex flex-col gap-3 text-sm">
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 size-4 shrink-0 text-neutral-400" aria-hidden="true" />
          <div>
            <dt className="sr-only">{t('venue')}</dt>
            <dd className="font-medium text-neutral-900">{venueName}</dd>
            <dd className="text-neutral-600">{courtName}</dd>
          </div>
        </div>

        {start && (
          <div className="flex items-start gap-2">
            <CalendarDays className="mt-0.5 size-4 shrink-0 text-neutral-400" aria-hidden="true" />
            <div>
              <dt className="sr-only">{t('selectDate')}</dt>
              <dd className="text-neutral-900">{formatDateLong(start)}</dd>
            </div>
          </div>
        )}

        {start && end && (
          <div className="flex items-start gap-2">
            <Clock className="mt-0.5 size-4 shrink-0 text-neutral-400" aria-hidden="true" />
            <div>
              <dt className="sr-only">{t('selectTime')}</dt>
              <dd className="tabular-nums text-neutral-900">
                {formatTime(start)} – {formatTime(end)}
              </dd>
            </div>
          </div>
        )}
      </dl>

      {/* Số block — ở chế độ cart bảng giá bên dưới đã cho thấy điều này. */}
      {!isCart && count > 0 && (
        <p className="-mt-1 pl-6 text-sm text-neutral-600">{t('stickySlots', { count })}</p>
      )}

      {/* Bảng giá từng block — chỉ ở chế độ cart vì đơn thật có thể đã đổi giá. */}
      {isCart && slots.length > 0 && (
        <div className="border-t border-neutral-200 pt-3">
          <table className="w-full text-sm">
            <caption className="sr-only">{t('selectedSlots')}</caption>
            <thead>
              <tr className="text-xs text-neutral-500">
                <th scope="col" className="text-left font-normal">
                  {t('selectTime')}
                </th>
                <th scope="col" className="text-right font-normal">
                  {t('pricePerSlot')}
                </th>
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => (
                <tr key={slot.start}>
                  <td className="py-1 tabular-nums text-neutral-700">{formatTime(slot.start)}</td>
                  <td className="py-1 text-right tabular-nums text-neutral-700">
                    {formatCurrency(slot.price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-baseline justify-between border-t border-neutral-200 pt-3">
        <span className="text-sm text-neutral-600">{t('stickyTotal')}</span>
        <span className="text-xl font-bold text-primary-700 tabular-nums">
          {formatCurrency(total)}
        </span>
      </div>

      {/* Tiền cọc — chỉ hiện khi server đã chốt con số. */}
      {depositAmount > 0 && (
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-neutral-600">{t('deposit')}</span>
          <span className="font-medium text-neutral-900 tabular-nums">
            {formatCurrency(depositAmount)}
          </span>
        </div>
      )}

      {footer && <div className="flex flex-col gap-2">{footer}</div>}
    </aside>
  );
}
