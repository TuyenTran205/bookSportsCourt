'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Ban, CalendarX2, Unlock } from 'lucide-react';

import type { Blackout, Court, OpeningHour, OwnerTimelineBooking } from '@bsc/shared';

import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils/cn';
import { formatCurrency, formatTime } from '@/lib/utils/format';
import {
  buildTimelineAxis,
  cellState,
  courtWindow,
  hhmmFromMinutes,
  isoFromMinutes,
  pastCutoffMinute,
  type CellInfo,
} from '@/lib/utils/timeline';

/**
 * OwnerTimeline – docs/07-design-system.md mục 10 (Resource View).
 *
 * - Trục X suy từ `opening_hours` TỪNG court (xem `lib/utils/timeline.ts`),
 *   KHÔNG hard-code 8:00–22:00.
 * - Trục Y: danh sách court.
 * - Màu block theo trạng thái booking.
 * - Click block → mở detail panel bên phải (KHÔNG mở modal riêng).
 * - Kéo trên vùng trống → tạo booking thủ công.
 * - Desktop-first (≥1024px); hẹp hơn thì cuộn ngang.
 */

/** Màu theo trạng thái — khớp bảng màu trong docs/07. */
const CELL_CLASSES: Record<CellInfo['state'], string> = {
  free: 'bg-white hover:bg-primary-50 cursor-crosshair',
  booked: 'bg-primary-600 text-white cursor-pointer hover:bg-primary-700',
  blocked:
    'bg-neutral-200 text-neutral-600 cursor-pointer hover:bg-neutral-300 bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgb(0_0_0/0.06)_4px,rgb(0_0_0/0.06)_8px)]',
  // Ngoài giờ mở cửa: nền xám rất nhạt, không phải blackout (khái niệm khác).
  closed: 'bg-neutral-50 cursor-not-allowed',
  // Đã qua giờ: API không nhận đặt quá khứ nên mờ đi và không kéo được.
  past: 'bg-neutral-100 cursor-not-allowed',
};

export type TimelineSelection =
  | { kind: 'booking'; data: OwnerTimelineBooking }
  | { kind: 'blackout'; data: Blackout; courtName: string }
  | null;

export interface OwnerTimelineProps {
  date: string;
  courts: readonly Court[];
  openingHours: readonly OpeningHour[];
  bookings: readonly OwnerTimelineBooking[];
  blackouts: readonly Blackout[];
  /** Kéo tạo đặt sân thủ công trên vùng trống. */
  onCreateBooking?: (input: { courtId: string; start: string; end: string }) => void;
  /** Mở khoá sân bảo trì. */
  onDeleteBlackout?: (courtId: string, blackoutId: string) => Promise<void> | void;
  className?: string;
}

export function OwnerTimeline({
  date,
  courts,
  openingHours,
  bookings,
  blackouts,
  onCreateBooking,
  onDeleteBlackout,
  className,
}: OwnerTimelineProps) {
  const t = useTranslations('owner');

  // `weekday` của ngày đang xem: 0 = Chủ nhật. Tính từ chuỗi `date` để không
  // phụ thuộc múi giờ của máy chạy.
  const weekday = React.useMemo(() => new Date(`${date}T12:00:00+07:00`).getDay(), [date]);

  const axis = React.useMemo(
    () => buildTimelineAxis(courts, weekday, openingHours),
    [courts, weekday, openingHours],
  );

  const [selected, setSelected] = React.useState<TimelineSelection>(null);
  const [drag, setDrag] = React.useState<{
    courtId: string;
    from: number;
    to: number;
  } | null>(null);

  // Kéo ra ngoài lưới rồi nhả chuột vẫn phải kết thúc thao tác.
  React.useEffect(() => {
    const stop = () => setDrag(null);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, []);

  // Đổi ngày thì bỏ block đang chọn — nó thuộc ngày cũ.
  React.useEffect(() => setSelected(null), [date]);

  if (courts.length === 0) {
    return (
      <EmptyState
        icon={CalendarX2}
        title={t('timelineNoCourts')}
        description={t('timelineNoCourtsDesc')}
        className={className}
      />
    );
  }

  if (!axis) {
    return (
      <EmptyState
        icon={CalendarX2}
        title={t('timelineClosed')}
        description={t('timelineClosedHint')}
        className={className}
      />
    );
  }

  const pastCutoff = pastCutoffMinute(date);

  const commitDrag = (courtId: string, from: number, to: number) => {
    if (!onCreateBooking) return;
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    // Kéo ngược vẫn tạo được: luôn lấy khoảng [nhỏ, lớn] rồi cộng một block.
    onCreateBooking({
      courtId,
      start: isoFromMinutes(date, lo),
      end: isoFromMinutes(date, hi + 30),
    });
  };

  return (
    <div className={cn('flex flex-col gap-4 lg:flex-row', className)}>
      {/* Cuộn ngang: trục giờ có thể dài hơn màn hình. */}
      <div className="min-w-0 flex-1 overflow-x-auto rounded-card border border-neutral-200 bg-white">
        <table className="border-collapse text-xs">
          <caption className="sr-only">{t('timelineTitle')}</caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 min-w-32 border-b border-r border-neutral-200 bg-neutral-50 px-3 py-2 text-left font-medium text-neutral-600"
              >
                {t('timelineTitle')}
              </th>
              {axis.slots.map((minute) => (
                <th
                  key={minute}
                  scope="col"
                  className="w-14 min-w-14 border-b border-neutral-200 bg-neutral-50 px-1 py-2 text-center font-normal tabular-nums text-neutral-500"
                >
                  {/* Chỉ ghi nhãn ở mốc chẵn giờ để hàng không rối. */}
                  {minute % 60 === 0 ? hhmmFromMinutes(minute) : ''}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {courts.map((court) => {
              const window = courtWindow(court.id, weekday, openingHours);
              return (
                <tr key={court.id}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 min-w-32 border-b border-r border-neutral-200 bg-white px-3 py-2 text-left font-medium text-neutral-800"
                  >
                    {court.name}
                  </th>

                  {axis.slots.map((minute) => {
                    const info = cellState(court.id, minute, window, bookings, blackouts, pastCutoff, date);
                    const isDragging =
                      drag?.courtId === court.id &&
                      minute >= Math.min(drag.from, drag.to) &&
                      minute <= Math.max(drag.from, drag.to);

                    return (
                      <td key={minute} className="border-b border-neutral-100 p-0">
                        <button
                          type="button"
                          disabled={
                            info.state === 'closed' ||
                            info.state === 'past'
                          }
                          aria-label={cellLabel(court.name, minute, info, t)}
                          onClick={() => {
                            if (info.state === 'booked' && info.booking) {
                              setSelected({ kind: 'booking', data: info.booking });
                            } else if (info.state === 'blocked' && info.blackout) {
                              setSelected({ kind: 'blackout', data: info.blackout, courtName: court.name });
                            }
                          }}
                          onPointerDown={() => {
                            if (info.state !== 'free') return;
                            setDrag({ courtId: court.id, from: minute, to: minute });
                          }}
                          onPointerEnter={() => {
                            if (drag?.courtId !== court.id || info.state === 'past') return;
                            setDrag({ ...drag, to: minute });
                          }}
                          onPointerUp={() => {
                            if (drag?.courtId !== court.id) return;
                            commitDrag(court.id, drag.from, drag.to);
                            setDrag(null);
                          }}
                          className={cn(
                            'h-9 w-14 border-r border-neutral-100 text-[10px] leading-tight transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500',
                            CELL_CLASSES[info.state],
                            isDragging && 'bg-primary-100 ring-1 ring-inset ring-primary-600',
                          )}
                        >
                          {/* Giá hiện trên block đã đặt để chủ sân đối chiếu nhanh. */}
                          {info.state === 'booked' && info.booking && (
                            <span className="block truncate px-0.5">
                              {formatCurrency(info.booking.totalPrice)}
                            </span>
                          )}
                          {info.state === 'blocked' && (
                            <span className="block truncate px-0.5 font-medium text-neutral-600">
                              {t('blackoutBadge')}
                            </span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/*
        Detail panel — theo docs/07 thì click block mở panel, KHÔNG mở modal.
        Panel nằm cùng chỗ trên desktop; trên mobile đẩy xuống dưới lưới.
      */}
      <TimelineDetailPanel
        selection={selected}
        onClose={() => setSelected(null)}
        onDeleteBlackout={onDeleteBlackout}
      />
    </div>
  );
}

/** Nhãn đọc được cho trình đọc màn hình — màu một mình không đủ. */
function cellLabel(
  courtName: string,
  minute: number,
  info: CellInfo,
  t: ReturnType<typeof useTranslations>,
): string {
  const time = hhmmFromMinutes(minute);
  switch (info.state) {
    case 'booked':
      return `${courtName} ${time} — ${info.booking?.customerName ?? info.booking?.guestName ?? ''} ${formatCurrency(info.booking?.totalPrice ?? 0)}`;
    case 'blocked':
      return `${courtName} ${time} — ${t('blackout')}`;
    case 'closed':
      return `${courtName} ${time} — ${t('timelineClosed')}`;
    case 'past':
      return `${courtName} ${time} — ${t('timelinePast')}`;
    default:
      return `${courtName} ${time} — ${t('timelineHint')}`;
  }
}

function TimelineDetailPanel({
  selection,
  onClose,
  onDeleteBlackout,
}: {
  selection: TimelineSelection;
  onClose: () => void;
  onDeleteBlackout?: (courtId: string, blackoutId: string) => Promise<void> | void;
}) {
  const t = useTranslations('owner');
  const tCommon = useTranslations('common');
  const [isDeleting, setIsDeleting] = React.useState(false);

  if (!selection) {
    return (
      <aside className="hidden w-72 shrink-0 rounded-card border border-dashed border-neutral-300 p-4 lg:block">
        <p className="text-sm text-neutral-500">{t('clickBlockHint')}</p>
        <p className="mt-1.5 text-xs text-neutral-400">{t('clickBlackoutHint')}</p>
      </aside>
    );
  }

  if (selection.kind === 'blackout') {
    const blackout = selection.data;
    return (
      <aside className="w-full shrink-0 rounded-card border border-neutral-200 bg-white p-4 lg:w-72">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Ban className="size-4 text-warning-600" aria-hidden="true" />
            <h3 className="text-sm font-medium text-neutral-900">{t('blackoutDetail')}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded text-xs text-neutral-500 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
          >
            {tCommon('close')}
          </button>
        </div>

        <dl className="mt-3 flex flex-col gap-2 text-sm">
          <Row label={t('blackoutCourt')} value={selection.courtName} />
          <Row
            label={t('time')}
            value={`${formatTime(blackout.start)} – ${formatTime(blackout.end)}`}
          />
          <Row
            label={t('blackoutReasonLabel')}
            value={blackout.reason || 'Bảo trì sân'}
          />
        </dl>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-neutral-200 pt-3">
          <span className="text-sm text-neutral-500">{t('status')}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
            {t('blackoutBadge')}
          </span>
        </div>

        {onDeleteBlackout && (
          <div className="mt-4 border-t border-neutral-200 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isDeleting}
              className="w-full border-danger/30 text-danger hover:bg-danger/10 hover:text-danger"
              onClick={async () => {
                if (!window.confirm(t('unlockConfirm'))) return;
                setIsDeleting(true);
                try {
                  await onDeleteBlackout(blackout.courtId, blackout.id);
                  onClose();
                } finally {
                  setIsDeleting(false);
                }
              }}
            >
              <Unlock className="mr-1.5 size-4" aria-hidden="true" />
              {t('unlockCourt')}
            </Button>
          </div>
        )}
      </aside>
    );
  }

  const booking = selection.data;
  return (
    <aside className="w-full shrink-0 rounded-card border border-neutral-200 bg-white p-4 lg:w-72">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-neutral-900">{t('bookings')}</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded text-xs text-neutral-500 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
        >
          {tCommon('close')}
        </button>
      </div>

      <dl className="mt-3 flex flex-col gap-2 text-sm">
        <Row label={t('guestName')} value={booking.customerName ?? booking.guestName ?? '—'} />
        <Row
          label={t('time')}
          value={`${formatTime(booking.during.start)} – ${formatTime(booking.during.end)}`}
        />
        <Row
          label={t('source')}
          value={booking.source === 'manual' ? t('sourceManual') : t('sourceOnline')}
        />
        <Row label={t('totalAmount')} value={formatCurrency(booking.totalPrice)} />
      </dl>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-neutral-200 pt-3">
        <span className="text-sm text-neutral-500">{t('status')}</span>
        <StatusBadge kind="booking" status={booking.status} />
      </div>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-right font-medium text-neutral-900">{value}</dd>
    </div>
  );
}
