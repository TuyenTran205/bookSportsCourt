'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import type { CourtSlots, Slot, SlotStatus } from '@bsc/shared';

import { cn } from '@/lib/utils/cn';
import { formatCurrency, formatTime } from '@/lib/utils/format';
import {
  MAX_SLOTS_PER_BOOKING,
  computeDragRange,
  deriveTimeRows,
  isSelectable,
  mergeSelection,
  toggleSelection,
} from '@/lib/utils/slot-selection';

/**
 * SlotGrid – docs/07-design-system.md mục 10.
 *
 * - Mobile: cuộn dọc, giờ nằm ở cột trái.
 * - Desktop: cuộn ngang khi nhiều sân.
 * - Chọn nhiều block: kéo để chọn các block LIÊN TIẾP.
 * - Bấm một block chưa chọn → chọn; bấm lại block đã chọn → bỏ chọn.
 * - Mỗi block `available` hiển thị giá.
 * - Cập nhật realtime: cha truyền `courts` mới, component tự vẽ lại và loại
 *   bỏ block đã chọn mà không còn trống.
 */

/** Màu nền/chữ theo trạng thái — dùng token `slot-*` trong tailwind.config. */
const SLOT_CLASSES: Record<SlotStatus, string> = {
  available: 'bg-slot-available text-slot-available-text hover:brightness-95 cursor-pointer',
  held: 'bg-slot-held text-slot-held-text cursor-not-allowed',
  booked: 'bg-slot-booked text-slot-booked-text cursor-not-allowed',
  blocked: 'bg-slot-blocked text-slot-blocked-text cursor-not-allowed',
  past: 'bg-slot-past text-slot-past-text cursor-not-allowed',
};

/** Ô đang được chọn: viền đậm + quầng, giữ nguyên nền để vẫn đọc được giá. */
const SELECTED_CLASSES =
  'ring-2 ring-primary-600 ring-offset-1 ring-offset-white font-semibold brightness-100';

export interface SlotGridProps {
  courts: readonly CourtSlots[];
  /**
   * Tên hiển thị theo `courtId`. `CourtSlots` chỉ có id, còn tên nằm ở
   * `Venue.courts` — truyền vào đây để không phải gọi thêm API.
   * Thiếu tên thì rơi về "Sân 1", "Sân 2"...
   */
  courtNames?: Record<string, string>;
  /** `start` ISO của các block đang chọn. */
  selected: readonly string[];
  onSelectedChange: (next: string[]) => void;
  /** Gọi khi người dùng chọn quá giới hạn — để cha hiện toast. */
  onLimitReached?: (max: number) => void;
  className?: string;
}

export function SlotGrid({
  courts,
  courtNames,
  selected,
  onSelectedChange,
  onLimitReached,
  className,
}: SlotGridProps) {
  const t = useTranslations('slot');

  const timeRows = React.useMemo(() => deriveTimeRows(courts), [courts]);
  const selectedSet = React.useMemo(() => new Set(selected), [selected]);

  /**
   * Neo kéo: `courtId` + chỉ số block. Kéo chỉ hợp lệ trong CÙNG một sân —
   * một booking thuộc đúng một court, nên kéo chéo sân là vô nghĩa.
   */
  const [anchor, setAnchor] = React.useState<{ courtId: string; index: number } | null>(null);
  const [hovered, setHovered] = React.useState<{ courtId: string; index: number } | null>(null);
  const draggingRef = React.useRef(false);

  // Kéo ra ngoài lưới rồi nhả chuột vẫn phải kết thúc thao tác.
  React.useEffect(() => {
    const stop = () => {
      draggingRef.current = false;
      setAnchor(null);
      setHovered(null);
    };
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, []);

  /**
   * Realtime: block đang chọn bị người khác đặt mất thì tự bỏ khỏi lựa chọn,
   * tránh để người dùng bấm "Đặt sân" rồi mới nhận lỗi 409.
   */
  React.useEffect(() => {
    if (selected.length === 0) return;
    const stillAvailable = new Set<string>();
    for (const court of courts) {
      for (const slot of court.slots) {
        if (isSelectable(slot.status)) stillAvailable.add(slot.start);
      }
    }
    const kept = selected.filter((key) => stillAvailable.has(key));
    if (kept.length !== selected.length) onSelectedChange(kept);
  }, [courts, selected, onSelectedChange]);

  /** Dải block đang được kéo (chỉ để tô sáng trước khi nhả). */
  const previewKeys = React.useMemo(() => {
    if (!anchor || !hovered || anchor.courtId !== hovered.courtId) return new Set<string>();
    const court = courts.find((c) => c.courtId === anchor.courtId);
    if (!court) return new Set<string>();

    const selectable = court.slots.map((s) => isSelectable(s.status));
    const indexes = computeDragRange(anchor.index, hovered.index, selectable);
    return new Set(indexes.map((i) => court.slots[i]!.start));
  }, [anchor, hovered, courts]);

  const commit = React.useCallback(
    (keys: string[]) => {
      if (keys.length === 0) return;
      const { keys: next, truncated } = mergeSelection(selected, keys, MAX_SLOTS_PER_BOOKING);
      if (truncated) onLimitReached?.(MAX_SLOTS_PER_BOOKING);
      if (next.length !== selected.length) onSelectedChange(next);
    },
    [selected, onSelectedChange, onLimitReached],
  );

  /** Bàn phím: Enter/Space bật tắt một block — đường vào không cần chuột. */
  const handleKeyDown = (event: React.KeyboardEvent, slot: Slot) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (!isSelectable(slot.status)) return;
    event.preventDefault();
    const { keys, truncated } = toggleSelection(selected, slot.start, MAX_SLOTS_PER_BOOKING);
    if (truncated) onLimitReached?.(MAX_SLOTS_PER_BOOKING);
    else onSelectedChange(keys);
  };

  if (timeRows.length === 0) {
    return (
      <div className={cn('rounded-card border border-neutral-200 bg-white p-8 text-center', className)}>
        <p className="text-base font-medium text-neutral-900">{t('noSlots')}</p>
        <p className="mt-1 text-sm text-neutral-600">{t('noSlotsDesc')}</p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Chú thích màu — không chỉ dựa vào màu để truyền đạt trạng thái. */}
      <SlotLegend />

      {/*
        Bọc cuộn ngang cho desktop nhiều sân. `overscroll-x-contain` giữ thao
        tác kéo chọn không đẩy trang sang ngang.
      */}
      <div className="-mx-4 overflow-x-auto overscroll-x-contain px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[520px] border-separate border-spacing-1">
          <caption className="sr-only">{t('selectHint')}</caption>
          <thead>
            <tr>
              <th scope="col" className="w-16 text-left text-xs font-medium text-neutral-500">
                {/* Góc: nhãn cho cột giờ */}
                <span className="sr-only">{t('legend')}</span>
              </th>
              {courts.map((court, i) => (
                <th
                  key={court.courtId}
                  scope="col"
                  className="pb-1 text-center text-sm font-medium text-neutral-700"
                >
                  {courtNames?.[court.courtId] ?? `${t('court')} ${i + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeRows.map((time) => (
              <tr key={time}>
                <th
                  scope="row"
                  className="pr-2 text-right align-middle text-xs font-normal tabular-nums text-neutral-500"
                >
                  {formatTime(time)}
                </th>
                {courts.map((court) => {
                  const slot = court.slots.find((s) => s.start === time);
                  if (!slot) {
                    // Sân không mở cửa ở khung này — ô trống, không phải nút.
                    return <td key={court.courtId} className="p-0" aria-hidden="true" />;
                  }
                  const index = court.slots.indexOf(slot);
                  return (
                    <td key={court.courtId} className="p-0">
                      <SlotCell
                        slot={slot}
                        index={index}
                        isSelected={selectedSet.has(slot.start)}
                        isPreview={previewKeys.has(slot.start)}
                        onPointerDown={(i) => {
                          if (!isSelectable(slot.status)) return;
                          draggingRef.current = true;
                          setAnchor({ courtId: court.courtId, index: i });
                          setHovered({ courtId: court.courtId, index: i });
                        }}
                        onPointerEnter={(i) => {
                          if (!draggingRef.current) return;
                          setHovered({ courtId: court.courtId, index: i });
                        }}
                        onPointerUp={(i) => {
                          if (!draggingRef.current) return;
                          if (!anchor || anchor.courtId !== court.courtId) return;
                          const selectable = court.slots.map((s) => isSelectable(s.status));
                          const indexes = computeDragRange(anchor.index, i, selectable);
                          const keys = indexes.map((n) => court.slots[n]!.start);
                          // Bấm đơn (không kéo) vào block đã chọn → bỏ chọn block đó.
                          if (keys.length === 1 && selectedSet.has(keys[0]!)) {
                            onSelectedChange(selected.filter((k) => k !== keys[0]));
                          } else {
                            commit(keys);
                          }
                          draggingRef.current = false;
                          setAnchor(null);
                          setHovered(null);
                        }}
                        onKeyDown={handleKeyDown}
                        label={t(slot.status === 'held' && slot.mine ? 'myHold' : slot.status)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface SlotCellProps {
  slot: Slot;
  index: number;
  isSelected: boolean;
  isPreview: boolean;
  label: string;
  onPointerDown: (index: number) => void;
  onPointerEnter: (index: number) => void;
  onPointerUp: (index: number) => void;
  onKeyDown: (event: React.KeyboardEvent, slot: Slot) => void;
}

function SlotCell({
  slot,
  index,
  isSelected,
  isPreview,
  label,
  onPointerDown,
  onPointerEnter,
  onPointerUp,
  onKeyDown,
}: SlotCellProps) {
  const selectable = isSelectable(slot.status);

  return (
    <button
      type="button"
      // `aria-pressed` để trình đọc màn hình biết block đã được chọn hay chưa.
      aria-pressed={isSelected}
      aria-label={`${formatTime(slot.start)} ${label}${
        selectable ? ` ${formatCurrency(slot.price)}` : ''
      }`}
      disabled={!selectable}
      onPointerDown={(e) => {
        e.preventDefault();
        onPointerDown(index);
      }}
      onPointerEnter={() => onPointerEnter(index)}
      onPointerUp={() => onPointerUp(index)}
      onKeyDown={(e) => onKeyDown(e, slot)}
      className={cn(
        'flex h-11 w-full touch-none select-none flex-col items-center justify-center rounded-btn',
        'text-xs leading-tight transition-[filter,box-shadow] duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-1',
        SLOT_CLASSES[slot.status],
        (isSelected || isPreview) && SELECTED_CLASSES,
      )}
    >
      <span className="font-medium">{formatCurrency(slot.price)}</span>
      {/* Nhãn trạng thái bằng chữ cho ô không trống — màu một mình là chưa đủ. */}
      {slot.status !== 'available' && <span className="text-[10px] opacity-80">{label}</span>}
    </button>
  );
}

/** Chú thích 5 trạng thái — docs/08: không truyền đạt chỉ bằng màu. */
function SlotLegend() {
  const t = useTranslations('slot');
  const items: Array<{ status: SlotStatus; label: string }> = [
    { status: 'available', label: t('available') },
    { status: 'held', label: t('held') },
    { status: 'booked', label: t('booked') },
    { status: 'blocked', label: t('blocked') },
    { status: 'past', label: t('past') },
  ];

  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {items.map(({ status, label }) => (
        <li key={status} className="flex items-center gap-1.5 text-xs text-neutral-600">
          <span
            aria-hidden="true"
            className={cn('size-3 rounded-sm border border-black/5', SLOT_CLASSES[status])}
          />
          {label}
        </li>
      ))}
    </ul>
  );
}
