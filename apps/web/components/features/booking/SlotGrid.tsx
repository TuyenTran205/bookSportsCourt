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
  'ring-2 ring-primary-600 ring-offset-1 ring-offset-bg-card font-semibold brightness-100';

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
  const dragModeRef = React.useRef<'add' | 'remove'>('add');
  const pointerClientXRef = React.useRef<number | null>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const anchorRef = React.useRef<{ courtId: string; index: number } | null>(null);
  const hoveredRef = React.useRef<{ courtId: string; index: number } | null>(null);

  const updateHoveredFromPointer = React.useCallback(
    (clientX: number) => {
      const currentAnchor = anchorRef.current;
      const container = scrollContainerRef.current;
      if (!currentAnchor || !container) return;

      const cells = Array.from(
        container.querySelectorAll<HTMLButtonElement>('[data-slot-court][data-slot-index]'),
      ).filter((cell) => cell.dataset.slotCourt === currentAnchor.courtId);
      if (cells.length === 0) return;

      let bestIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const cell of cells) {
        const rect = cell.getBoundingClientRect();
        const distance = clientX < rect.left
          ? rect.left - clientX
          : clientX > rect.right
            ? clientX - rect.right
            : 0;
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = Number(cell.dataset.slotIndex);
        }
      }
      const nextHovered = { courtId: currentAnchor.courtId, index: bestIndex };
      hoveredRef.current = nextHovered;
      setHovered(nextHovered);
    },
    [],
  );

  // Kéo ra ngoài lưới rồi nhả chuột vẫn phải kết thúc thao tác.
  React.useEffect(() => {
    const stop = () => {
      draggingRef.current = false;
      anchorRef.current = null;
      hoveredRef.current = null;
      pointerClientXRef.current = null;
      setAnchor(null);
      setHovered(null);
    };
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointercancel', stop);
    };
  }, []);

  React.useEffect(() => {
    if (!anchor) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (!draggingRef.current) return;
      pointerClientXRef.current = event.clientX;
      updateHoveredFromPointer(event.clientX);
    };

    window.addEventListener('pointermove', handlePointerMove);

    let rafId = 0;
    const EDGE_ZONE = 56;
    const tickAutoScroll = () => {
      const container = scrollContainerRef.current;
      const clientX = pointerClientXRef.current;
      if (container && clientX !== null && draggingRef.current) {
        const rect = container.getBoundingClientRect();
        const rightDistance = rect.right - clientX;
        const leftDistance = clientX - rect.left;
        let delta = 0;

        if (
          rightDistance >= 0 &&
          rightDistance < EDGE_ZONE &&
          container.scrollLeft + container.clientWidth < container.scrollWidth - 1
        ) {
          const intensity = Math.min(2.5, Math.max(0.2, (EDGE_ZONE - rightDistance) / EDGE_ZONE));
          delta = Math.ceil(intensity * 14);
        } else if (
          leftDistance >= 0 &&
          leftDistance < EDGE_ZONE &&
          container.scrollLeft > 0
        ) {
          const intensity = Math.min(2.5, Math.max(0.2, (EDGE_ZONE - leftDistance) / EDGE_ZONE));
          delta = -Math.ceil(intensity * 14);
        }

        if (delta !== 0) {
          container.scrollLeft += delta;
          updateHoveredFromPointer(clientX);
        }
      }
      if (draggingRef.current) rafId = window.requestAnimationFrame(tickAutoScroll);
    };
    rafId = window.requestAnimationFrame(tickAutoScroll);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.cancelAnimationFrame(rafId);
    };
  }, [anchor, updateHoveredFromPointer]);

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
    (keys: string[], mode: 'add' | 'remove' = 'add') => {
      if (keys.length === 0) return;
      if (mode === 'remove') {
        const removed = new Set(keys);
        const next = selected.filter((key) => !removed.has(key));
        if (next.length !== selected.length) onSelectedChange(next);
        return;
      }
      const { keys: next, truncated } = mergeSelection(selected, keys, MAX_SLOTS_PER_BOOKING);
      if (truncated) onLimitReached?.(MAX_SLOTS_PER_BOOKING);
      if (next.length !== selected.length) onSelectedChange(next);
    },
    [selected, onSelectedChange, onLimitReached],
  );

  React.useEffect(() => {
    const finishDrag = () => {
      if (!draggingRef.current) return;
      const currentAnchor = anchorRef.current;
      const currentHovered = hoveredRef.current;
      if (currentAnchor && currentHovered && currentAnchor.courtId === currentHovered.courtId) {
        const court = courts.find((c) => c.courtId === currentAnchor.courtId);
        if (court) {
          const selectable = court.slots.map((s) => isSelectable(s.status));
          const indexes = computeDragRange(currentAnchor.index, currentHovered.index, selectable);
          const keys = indexes.map((i) => court.slots[i]!.start);
          commit(keys, dragModeRef.current);
        }
      }
      draggingRef.current = false;
      anchorRef.current = null;
      hoveredRef.current = null;
      pointerClientXRef.current = null;
      setAnchor(null);
      setHovered(null);
    };

    window.addEventListener('pointerup', finishDrag);
    return () => window.removeEventListener('pointerup', finishDrag);
  }, [courts, commit]);

  /** Bàn phím: Enter/Space bật tắt một block — đường vào không cần chuột. */
  const handleKeyDown = (event: React.KeyboardEvent, slot: Slot) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (!isSelectable(slot.status)) return;
    event.preventDefault();
    const { keys, truncated } = toggleSelection(selected, slot.start, MAX_SLOTS_PER_BOOKING);
    if (truncated) onLimitReached?.(MAX_SLOTS_PER_BOOKING);
    else onSelectedChange(keys);
  };

  const renderSlotCell = (court: CourtSlots, slot: Slot, index: number) => (
    <SlotCell
      courtId={court.courtId}
      slot={slot}
      index={index}
      isSelected={selectedSet.has(slot.start)}
      isPreview={previewKeys.has(slot.start)}
      isPreviewRemoving={dragModeRef.current === 'remove'}
      onPointerDown={(i) => {
        if (!isSelectable(slot.status)) return;
        draggingRef.current = true;
        dragModeRef.current = selectedSet.has(slot.start) ? 'remove' : 'add';
        const nextAnchor = { courtId: court.courtId, index: i };
        anchorRef.current = nextAnchor;
        hoveredRef.current = nextAnchor;
        setAnchor(nextAnchor);
        setHovered(nextAnchor);
      }}
      onPointerEnter={(i) => {
        if (!draggingRef.current) return;
        const nextHovered = { courtId: court.courtId, index: i };
        hoveredRef.current = nextHovered;
        setHovered(nextHovered);
      }}
      onKeyDown={handleKeyDown}
      label={t(slot.status === 'held' && slot.mine ? 'myHold' : slot.status)}
    />
  );

  if (timeRows.length === 0) {
    return (
      <div className={cn('rounded-card border border-border bg-bg-card p-8 text-center', className)}>
        <p className="text-base font-medium text-text-primary">{t('noSlots')}</p>
        <p className="mt-1 text-sm text-text-secondary">{t('noSlotsDesc')}</p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Chú thích màu — không chỉ dựa vào màu để truyền đạt trạng thái. */}
      <SlotLegend />

      {courts.length === 1 ? (
        <div
          ref={scrollContainerRef}
          className="-mx-4 flex gap-2 overflow-x-auto overscroll-x-contain px-4 pb-2 sm:mx-0 sm:px-0"
          role="group"
          aria-label={t('selectHint')}
        >
          {courts[0]!.slots.map((slot, index) => (
            <div key={slot.start} className="w-24 shrink-0 sm:w-28">
              <p className="mb-1 text-center text-xs tabular-nums text-text-secondary">
                {formatTime(slot.start)}
              </p>
              {renderSlotCell(courts[0]!, slot, index)}
            </div>
          ))}
        </div>
      ) : (
      <div
        ref={scrollContainerRef}
        className="-mx-4 overflow-x-auto overscroll-x-contain px-4 sm:mx-0 sm:px-0"
      >
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
                      {renderSlotCell(court, slot, index)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}

interface SlotCellProps {
  courtId: string;
  slot: Slot;
  index: number;
  isSelected: boolean;
  isPreview: boolean;
  isPreviewRemoving: boolean;
  label: string;
  onPointerDown: (index: number) => void;
  onPointerEnter: (index: number) => void;
  onKeyDown: (event: React.KeyboardEvent, slot: Slot) => void;
}

function SlotCell({
  courtId,
  slot,
  index,
  isSelected,
  isPreview,
  isPreviewRemoving,
  label,
  onPointerDown,
  onPointerEnter,
  onKeyDown,
}: SlotCellProps) {
  const selectable = isSelectable(slot.status);

  return (
    <button
      type="button"
      data-slot-court={courtId}
      data-slot-index={index}
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
      onKeyDown={(e) => onKeyDown(e, slot)}
      className={cn(
        'flex h-11 w-full touch-none select-none flex-col items-center justify-center rounded-btn',
        'text-xs leading-tight transition-[filter,box-shadow] duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-1',
        SLOT_CLASSES[slot.status],
        isPreview
          ? isPreviewRemoving
            ? 'ring-2 ring-neutral-500 ring-offset-1 opacity-60'
            : SELECTED_CLASSES
          : isSelected && SELECTED_CLASSES,
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
        <li key={status} className="flex items-center gap-1.5 text-xs text-text-secondary">
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
