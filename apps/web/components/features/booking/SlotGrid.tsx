'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Minus, Plus } from 'lucide-react';

import type { CourtSlots, Slot, SlotStatus } from '@bsc/shared';

import { cn } from '@/lib/utils/cn';
import { formatCurrency, formatTime } from '@/lib/utils/format';
import {
  MAX_SLOTS_PER_BOOKING,
  computeDragRange,
  deriveTimeRows,
  isSelectable,
  mergeSelection,
  removeSelection,
  toggleSelection,
} from '@/lib/utils/slot-selection';

/**
 * SlotGrid – docs/07-design-system.md mục 10.
 *
 * - Mobile: cuộn dọc, giờ nằm ở cột trái.
 * - Desktop: cuộn ngang khi nhiều sân.
 * - Chọn nhiều block: kéo giữ từ ô chưa chọn để chọn các block LIÊN TIẾP.
 * - Bỏ chọn nhiều block: kéo giữ từ ô ĐÃ CHỌN để bỏ chọn (drag-to-deselect) các block đó.
 * - Tự động cuộn (Auto-scroll) khi kéo đến sát mép màn hình/container để chọn tiếp đến hết.
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

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const timeRows = React.useMemo(() => deriveTimeRows(courts), [courts]);
  const selectedSet = React.useMemo(() => new Set(selected), [selected]);

  /**
   * Neo kéo: `courtId` + chỉ số block. Kéo chỉ hợp lệ trong CÙNG một sân —
   * một booking thuộc đúng một court, nên kéo chéo sân là vô nghĩa.
   */
  const [anchor, setAnchor] = React.useState<{ courtId: string; index: number } | null>(null);
  const [hovered, setHovered] = React.useState<{ courtId: string; index: number } | null>(null);
  const [dragMode, setDragMode] = React.useState<'select' | 'deselect'>('select');
  const [zoomLevel, setZoomLevel] = React.useState<number>(100);

  const handleFitToScreen = React.useCallback(() => {
    const container = containerRef.current;
    if (!container || courts.length === 0) return;
    const totalSlots = courts[0]?.slots.length ?? 0;
    if (totalSlots === 0) return;
    const available = container.clientWidth - 16;
    const fitted = Math.max(25, Math.min(100, Math.floor((available / (totalSlots * 76)) * 100)));
    setZoomLevel(fitted);
  }, [courts]);

  const draggingRef = React.useRef(false);
  const dragModeRef = React.useRef<'select' | 'deselect'>('select');
  const anchorRef = React.useRef<{ courtId: string; index: number } | null>(null);
  const hoveredRef = React.useRef<{ courtId: string; index: number } | null>(null);
  const pointerPosRef = React.useRef<{ x: number; y: number } | null>(null);
  const hasDraggedRef = React.useRef(false);
  const animFrameRef = React.useRef<number | null>(null);

  const commit = React.useCallback(
    (keys: string[]) => {
      if (keys.length === 0) return;
      const { keys: next, truncated } = mergeSelection(selected, keys, MAX_SLOTS_PER_BOOKING);
      if (truncated) onLimitReached?.(MAX_SLOTS_PER_BOOKING);
      if (next.length !== selected.length) onSelectedChange(next);
    },
    [selected, onSelectedChange, onLimitReached],
  );

  /** Cập nhật hovered từ tọa độ con trỏ (hỗ trợ lấy ô ngay cả khi con trỏ vượt ra ngoài mép khung cuộn) */
  const updateHoveredFromPoint = React.useCallback(
    (clientX: number, clientY: number, curAnchor: { courtId: string; index: number }) => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      // Kẹp tọa độ mẫu trong phạm vi khung cuộn để document.elementFromPoint luôn tìm thấy ô biên
      const sampleX = Math.max(rect.left + 8, Math.min(rect.right - 8, clientX));
      const sampleY = Math.max(rect.top + 8, Math.min(rect.bottom - 8, clientY));

      const el = document.elementFromPoint(sampleX, sampleY);
      const cell = el?.closest<HTMLElement>('[data-slot-cell]');
      if (!cell) return;

      const cId = cell.dataset.slotCourtId;
      const idxStr = cell.dataset.slotIndex;
      if (cId === curAnchor.courtId && idxStr !== undefined) {
        const idx = Number(idxStr);
        if (!Number.isNaN(idx)) {
          setHovered((prev) => {
            if (prev?.courtId === cId && prev?.index === idx) return prev;
            hoveredRef.current = { courtId: cId, index: idx };
            return { courtId: cId, index: idx };
          });
        }
      }
    },
    [],
  );

  /** Vòng lặp tự động cuộn (Auto-scroll) khi con trỏ kéo vào vùng biên (edge zone) */
  const autoScroll = React.useCallback(() => {
    if (!draggingRef.current || !containerRef.current || !pointerPosRef.current || !anchorRef.current) {
      animFrameRef.current = null;
      return;
    }

    const { x, y } = pointerPosRef.current;
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const EDGE_ZONE = 64; // Khoảng cách từ biên bắt đầu kích hoạt cuộn tự động (px)

    let scrollSpeedX = 0;
    if (x > rect.right - EDGE_ZONE) {
      // Con trỏ ở sát hoặc tràn ra ngoài mép phải -> cuộn sang phải
      const overflow = x - (rect.right - EDGE_ZONE);
      const intensity = Math.min(1.5, Math.max(0.1, overflow / EDGE_ZONE));
      scrollSpeedX = Math.round(intensity * 18) + 4;
    } else if (x < rect.left + EDGE_ZONE) {
      // Con trỏ ở sát hoặc tràn ra ngoài mép trái -> cuộn sang trái
      const overflow = (rect.left + EDGE_ZONE) - x;
      const intensity = Math.min(1.5, Math.max(0.1, overflow / EDGE_ZONE));
      scrollSpeedX = -(Math.round(intensity * 18) + 4);
    }

    let scrollSpeedY = 0;
    if (typeof window !== 'undefined') {
      if (y > window.innerHeight - EDGE_ZONE) {
        const overflow = y - (window.innerHeight - EDGE_ZONE);
        const intensity = Math.min(1.5, Math.max(0.1, overflow / EDGE_ZONE));
        scrollSpeedY = Math.round(intensity * 16) + 3;
      } else if (y < EDGE_ZONE) {
        const overflow = EDGE_ZONE - y;
        const intensity = Math.min(1.5, Math.max(0.1, overflow / EDGE_ZONE));
        scrollSpeedY = -(Math.round(intensity * 16) + 3);
      }
    }

    let moved = false;
    if (scrollSpeedX !== 0) {
      const prevLeft = container.scrollLeft;
      container.scrollLeft += scrollSpeedX;
      if (container.scrollLeft !== prevLeft) {
        moved = true;
      }
    }

    if (scrollSpeedY !== 0 && typeof window !== 'undefined') {
      window.scrollBy(0, scrollSpeedY);
      moved = true;
    }

    if (moved) {
      updateHoveredFromPoint(x, y, anchorRef.current);
    }

    // Tiếp tục lặp nếu vẫn còn ở vùng biên
    if (scrollSpeedX !== 0 || scrollSpeedY !== 0) {
      animFrameRef.current = requestAnimationFrame(autoScroll);
    } else {
      animFrameRef.current = null;
    }
  }, [updateHoveredFromPoint]);

  // Lắng nghe pointermove & pointerup toàn màn hình
  React.useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!draggingRef.current || !anchorRef.current) return;
      pointerPosRef.current = { x: e.clientX, y: e.clientY };
      hasDraggedRef.current = true;

      updateHoveredFromPoint(e.clientX, e.clientY, anchorRef.current);

      if (!animFrameRef.current) {
        animFrameRef.current = requestAnimationFrame(autoScroll);
      }
    };

    const handlePointerUp = () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }

      if (draggingRef.current && anchorRef.current) {
        const curAnchor = anchorRef.current;
        const curHovered = hoveredRef.current ?? curAnchor;
        const curDragMode = dragModeRef.current;
        const court = courts.find((c) => c.courtId === curAnchor.courtId);
        if (court) {
          const selectable = court.slots.map((s) => isSelectable(s.status));
          const indexes = computeDragRange(curAnchor.index, curHovered.index, selectable);
          const keys = indexes.map((n) => court.slots[n]!.start);

          if (curDragMode === 'deselect') {
            // Kéo từ ô đã chọn: Bỏ chọn tất cả các block nằm trong dải kéo
            const next = removeSelection(selected, keys);
            if (next.length !== selected.length) {
              onSelectedChange(next);
            }
          } else {
            // Kéo từ ô chưa chọn: Thêm các block vào lựa chọn
            commit(keys);
          }
        }
      }

      draggingRef.current = false;
      anchorRef.current = null;
      hoveredRef.current = null;
      pointerPosRef.current = null;
      hasDraggedRef.current = false;
      setAnchor(null);
      setHovered(null);
      setDragMode('select');
      dragModeRef.current = 'select';
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [autoScroll, courts, selected, commit, onSelectedChange, updateHoveredFromPoint]);

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

  /** Dải block đang được kéo (để tô sáng hoặc báo trước khi nhả). */
  const previewKeys = React.useMemo(() => {
    if (!anchor || !hovered || anchor.courtId !== hovered.courtId) return new Set<string>();
    const court = courts.find((c) => c.courtId === anchor.courtId);
    if (!court) return new Set<string>();

    const selectable = court.slots.map((s) => isSelectable(s.status));
    const indexes = computeDragRange(anchor.index, hovered.index, selectable);
    return new Set(indexes.map((i) => court.slots[i]!.start));
  }, [anchor, hovered, courts]);

  /** Bàn phím: Enter/Space bật tắt một block — đường vào không cần chuột. */
  const handleKeyDown = (event: React.KeyboardEvent, slot: Slot) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (!isSelectable(slot.status)) return;
    event.preventDefault();
    const { keys, truncated } = toggleSelection(selected, slot.start, MAX_SLOTS_PER_BOOKING);
    if (truncated) onLimitReached?.(MAX_SLOTS_PER_BOOKING);
    else onSelectedChange(keys);
  };

  const renderSlotCell = (court: CourtSlots, slot: Slot, index: number) => {
    const isSelected = selectedSet.has(slot.start);
    const isSelectPreview = dragMode === 'select' && previewKeys.has(slot.start);
    const isDeselectPreview = dragMode === 'deselect' && previewKeys.has(slot.start) && isSelected;

    return (
      <SlotCell
        courtId={court.courtId}
        slot={slot}
        index={index}
        isSelected={isSelected}
        isSelectPreview={isSelectPreview}
        isDeselectPreview={isDeselectPreview}
        zoomLevel={zoomLevel}
        onPointerDown={(i) => {
          if (!isSelectable(slot.status)) return;
          const isAlreadySelected = selectedSet.has(slot.start);
          const mode = isAlreadySelected ? 'deselect' : 'select';
          dragModeRef.current = mode;
          setDragMode(mode);

          draggingRef.current = true;
          hasDraggedRef.current = false;
          const nextAnchor = { courtId: court.courtId, index: i };
          anchorRef.current = nextAnchor;
          hoveredRef.current = nextAnchor;
          setAnchor(nextAnchor);
          setHovered(nextAnchor);
        }}
        onPointerEnter={(i) => {
          if (!draggingRef.current || !anchorRef.current) return;
          if (anchorRef.current.courtId !== court.courtId) return;
          hasDraggedRef.current = true;
          const nextHovered = { courtId: court.courtId, index: i };
          hoveredRef.current = nextHovered;
          setHovered(nextHovered);
        }}
        onKeyDown={handleKeyDown}
        label={t(slot.status === 'held' && slot.mine ? 'myHold' : slot.status)}
      />
    );
  };

  if (timeRows.length === 0) {
    return (
      <div className={cn('rounded-card border border-border bg-bg-card p-8 text-center', className)}>
        <p className="text-base font-medium text-text-primary">{t('noSlots')}</p>
        <p className="mt-1 text-sm text-text-secondary">{t('noSlotsDesc')}</p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {/* Chú thích màu — không chỉ dựa vào màu để truyền đạt trạng thái. */}
        <SlotLegend />

        {/* Thanh thu phóng kích thước các block */}
        <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto rounded-md border border-neutral-200 bg-neutral-50 p-1 text-xs">
          <span className="text-[11px] font-medium text-neutral-500 hidden xs:inline">Thu phóng:</span>

          <button
            type="button"
            onClick={handleFitToScreen}
            className="rounded px-2 py-0.5 font-medium text-[11px] bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition-colors shadow-2xs"
            title="Thu nhỏ để nhìn thấy toàn bộ các block trên màn hình"
          >
            Vừa màn
          </button>

          <button
            type="button"
            onClick={() => setZoomLevel(100)}
            className="rounded px-2 py-0.5 font-medium text-[11px] bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition-colors shadow-2xs"
            title="Đặt lại 100%"
          >
            Chuẩn
          </button>

          <div className="flex items-center gap-0.5 ml-0.5">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(25, z - 10))}
              disabled={zoomLevel <= 25}
              className="rounded p-1 text-neutral-600 hover:bg-neutral-200/70 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Thu nhỏ block"
              title="Thu nhỏ block"
            >
              <Minus className="size-3" aria-hidden="true" />
            </button>
            <input
              type="range"
              min={25}
              max={140}
              step={5}
              value={zoomLevel}
              onChange={(e) => setZoomLevel(Number(e.target.value))}
              className="h-1.5 w-16 cursor-pointer appearance-none rounded-lg bg-neutral-200 accent-primary-600 sm:w-24"
              aria-label="Thanh thu phóng kích thước block"
            />
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(140, z + 10))}
              disabled={zoomLevel >= 140}
              className="rounded p-1 text-neutral-600 hover:bg-neutral-200/70 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Phóng to block"
              title="Phóng to block"
            >
              <Plus className="size-3" aria-hidden="true" />
            </button>
          </div>

          <span className="font-mono text-[10px] tabular-nums text-neutral-500 min-w-8 text-right">
            {zoomLevel}%
          </span>
        </div>
      </div>

      {courts.length === 1 ? (
        <div
          ref={containerRef}
          className="-mx-3 flex gap-1.5 overflow-x-auto overscroll-x-contain px-3 pb-2 scrollbar-thin sm:mx-0 sm:px-0"
          role="group"
          aria-label={t('selectHint')}
        >
          {courts[0]!.slots.map((slot, index) => {
            const slotWidth = Math.max(16, Math.round((72 * zoomLevel) / 100));
            const step = zoomLevel < 40 ? 4 : zoomLevel < 65 ? 2 : 1;
            const showTime = index % step === 0;
            return (
              <div key={slot.start} className="shrink-0" style={{ width: `${slotWidth}px` }}>
                <p className={cn("mb-1 text-center text-[10px] sm:text-[11px] tabular-nums text-text-secondary truncate", !showTime && "invisible")}>
                  {formatTime(slot.start)}
                </p>
                {renderSlotCell(courts[0]!, slot, index)}
              </div>
            );
          })}
        </div>
      ) : (
        <div
          ref={containerRef}
          className="-mx-4 overflow-x-auto overscroll-x-contain px-4 sm:mx-0 sm:px-0"
        >
          <table
            className="w-full border-separate border-spacing-1"
            style={{ minWidth: `${Math.max(340, Math.round((520 * zoomLevel) / 100))}px` }}
          >
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
  isSelectPreview: boolean;
  isDeselectPreview: boolean;
  label: string;
  zoomLevel?: number;
  onPointerDown: (index: number) => void;
  onPointerEnter: (index: number) => void;
  onKeyDown: (event: React.KeyboardEvent, slot: Slot) => void;
}

function SlotCell({
  courtId,
  slot,
  index,
  isSelected,
  isSelectPreview,
  isDeselectPreview,
  label,
  zoomLevel = 100,
  onPointerDown,
  onPointerEnter,
  onKeyDown,
}: SlotCellProps) {
  const selectable = isSelectable(slot.status);
  const isEffectiveSelected = (isSelected && !isDeselectPreview) || isSelectPreview;
  const cellHeight = Math.max(26, Math.round((44 * zoomLevel) / 100));

  return (
    <button
      type="button"
      data-slot-cell=""
      data-slot-court-id={courtId}
      data-slot-index={index}
      style={{ height: `${cellHeight}px` }}
      // `aria-pressed` để trình đọc màn hình biết block đã được chọn hay chưa.
      aria-pressed={isEffectiveSelected}
      aria-label={`${formatTime(slot.start)} ${label}${
        selectable ? ` ${formatCurrency(slot.price)}` : ''
      }`}
      disabled={!selectable}
      onPointerDown={(e) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        e.preventDefault();
        onPointerDown(index);
      }}
      onPointerEnter={() => onPointerEnter(index)}
      onKeyDown={(e) => onKeyDown(e, slot)}
      className={cn(
        'flex h-11 w-full touch-none select-none flex-col items-center justify-center rounded-btn px-1 sm:h-9',
        'text-[11px] leading-tight transition-[filter,box-shadow,opacity] duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-1',
        SLOT_CLASSES[slot.status],
        isEffectiveSelected && SELECTED_CLASSES,
        isDeselectPreview &&
          'ring-2 ring-danger-400 ring-offset-1 ring-offset-bg-card opacity-60 font-normal',
      )}
    >
      <span
        className={cn(
          'whitespace-nowrap font-medium tabular-nums',
          zoomLevel < 45 ? 'hidden' : zoomLevel < 70 ? 'text-[9px]' : '',
          isDeselectPreview && 'line-through text-danger-600',
        )}
      >
        {zoomLevel < 70 ? `${Math.round(slot.price / 1000)}k` : formatCurrency(slot.price)}
      </span>
      {/* Nhãn trạng thái bằng chữ cho ô không trống — màu một mình là chưa đủ. */}
      {slot.status !== 'available' && zoomLevel >= 55 && (
        <span className="text-[9px] leading-none opacity-80">{label}</span>
      )}
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
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:gap-x-4">
      {items.map(({ status, label }) => (
        <li key={status} className="flex items-center gap-1 text-[11px] text-text-secondary sm:gap-1.5 sm:text-xs">
          <span
            aria-hidden="true"
            className={cn('size-2.5 rounded-sm border border-black/5 sm:size-3', SLOT_CLASSES[status])}
          />
          {label}
        </li>
      ))}
    </ul>
  );
}
