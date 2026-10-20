import type { CourtSlots, Slot, SlotStatus } from '@bsc/shared';

/**
 * Logic chọn block cho SlotGrid — thuần, không phụ thuộc React, để test được
 * bằng vitest mà không cần render.
 *
 * Quy tắc nghiệp vụ (docs/05-booking-and-realtime.md):
 * - Đơn vị nhỏ nhất 30 phút, các block phải LIÊN TIẾP.
 * - Tối đa 16 block mỗi lượt (khớp `schemas.ts`).
 */

/** Khớp `.max(16, ...)` trong packages/shared/src/schemas.ts. */
export const MAX_SLOTS_PER_BOOKING = 16;

/**
 * Chỉ block `available` mới chọn được.
 *
 * `held` + `mine` là lượt giữ chỗ ĐANG tồn tại của chính người dùng — nó đã
 * được ghi nhận ở server, nên hiển thị riêng (tím) chứ không phải để chọn lại.
 */
export function isSelectable(status: SlotStatus): boolean {
  return status === 'available';
}

/** Mọi mốc thời gian xuất hiện trong lưới, sắp tăng dần. */
export function deriveTimeRows(courts: readonly CourtSlots[]): string[] {
  const starts = new Set<string>();
  for (const court of courts) {
    for (const slot of court.slots) starts.add(slot.start);
  }
  return [...starts].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
}

/**
 * Dải block khi kéo từ `anchor` tới `current`.
 *
 * Dừng ngay khi gặp block không chọn được — kéo ngang qua một block đã đặt
 * KHÔNG được nhảy qua nó để chọn phần bên kia, vì như vậy sẽ tạo ra một dải
 * không liên tục và server sẽ trả 409.
 *
 * Trả về mảng chỉ số (index trong `court.slots`), luôn liên tục.
 */
export function computeDragRange(
  anchor: number,
  current: number,
  selectable: readonly boolean[],
): number[] {
  if (anchor < 0 || anchor >= selectable.length) return [];
  if (!selectable[anchor]) return [];

  const step = current >= anchor ? 1 : -1;
  const range: number[] = [];

  for (let i = anchor; i >= 0 && i < selectable.length; i += step) {
    if (!selectable[i]) break;
    range.push(i);
    if (i === current) break;
  }

  return range;
}

/**
 * Gộp dải vừa kéo vào tập đang chọn, cắt bớt nếu vượt `max`.
 *
 * Trả về `keys` mới. `keys` là `start` ISO của từng block — ổn định hơn index
 * khi lưới cập nhật qua realtime.
 */
export function mergeSelection(
  selected: readonly string[],
  incoming: readonly string[],
  max: number = MAX_SLOTS_PER_BOOKING,
): { keys: string[]; truncated: boolean } {
  const next = new Set(selected);
  let truncated = false;

  for (const key of incoming) {
    if (next.has(key)) continue;
    if (next.size >= max) {
      truncated = true;
      break;
    }
    next.add(key);
  }

  return { keys: [...next], truncated };
}

/** Bật/tắt một block (dùng cho click và bàn phím). */
export function toggleSelection(
  selected: readonly string[],
  key: string,
  max: number = MAX_SLOTS_PER_BOOKING,
): { keys: string[]; truncated: boolean } {
  if (selected.includes(key)) {
    return { keys: selected.filter((k) => k !== key), truncated: false };
  }
  if (selected.length >= max) {
    return { keys: [...selected], truncated: true };
  }
  return { keys: [...selected, key], truncated: false };
}

/** Tổng tiền các block đang chọn. */
export function totalPrice(slots: readonly Slot[], selected: readonly string[]): number {
  const wanted = new Set(selected);
  return slots.reduce((sum, slot) => (wanted.has(slot.start) ? sum + slot.price : sum), 0);
}

/**
 * Chọn theo dải phải cùng một sân — kéo từ sân này sang sân khác là vô nghĩa
 * vì mỗi booking chỉ thuộc một court.
 */
export function isSameCourt(a: string, b: string): boolean {
  return a === b;
}
