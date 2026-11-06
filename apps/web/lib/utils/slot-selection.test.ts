import { describe, expect, it } from 'vitest';

import type { Slot } from '@bsc/shared';

import {
  MAX_SLOTS_PER_BOOKING,
  computeDragRange,
  deriveTimeRows,
  isSelectable,
  mergeSelection,
  toggleSelection,
  totalPrice,
} from './slot-selection';

/**
 * Test cho logic chọn block — docs/12 yêu cầu bắt buộc có unit test với
 * nghiệp vụ booking/giá.
 */

function slot(start: string, price = 80_000, status: Slot['status'] = 'available'): Slot {
  return { start, end: start, price, status };
}

const T = (h: number, m = 0) =>
  `2026-10-15T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+07:00`;

describe('isSelectable', () => {
  it('chỉ cho chọn block còn trống', () => {
    expect(isSelectable('available')).toBe(true);
  });

  it('không cho chọn mọi trạng thái đã bị chiếm', () => {
    // `held` kể cả khi là lượt giữ của chính mình cũng không chọn lại được —
    // nó đã được ghi nhận ở server.
    expect(isSelectable('held')).toBe(false);
    expect(isSelectable('booked')).toBe(false);
    expect(isSelectable('blocked')).toBe(false);
    expect(isSelectable('past')).toBe(false);
  });
});

describe('deriveTimeRows', () => {
  it('gộp mốc thời gian của mọi sân và sắp tăng dần', () => {
    const rows = deriveTimeRows([
      { courtId: 'a', slots: [slot(T(20)), slot(T(18))] },
      { courtId: 'b', slots: [slot(T(19))] },
    ]);
    expect(rows).toEqual([T(18), T(19), T(20)]);
  });

  it('khử trùng mốc xuất hiện ở nhiều sân', () => {
    const rows = deriveTimeRows([
      { courtId: 'a', slots: [slot(T(18))] },
      { courtId: 'b', slots: [slot(T(18))] },
    ]);
    expect(rows).toEqual([T(18)]);
  });

  it('trả mảng rỗng khi không có sân nào', () => {
    expect(deriveTimeRows([])).toEqual([]);
  });
});

describe('computeDragRange', () => {
  const all = [true, true, true, true];

  it('chọn dải xuôi từ neo tới đích', () => {
    expect(computeDragRange(0, 2, all)).toEqual([0, 1, 2]);
  });

  it('chọn dải ngược khi kéo lên trên', () => {
    expect(computeDragRange(3, 1, all)).toEqual([3, 2, 1]);
  });

  it('một block khi neo trùng đích', () => {
    expect(computeDragRange(1, 1, all)).toEqual([1]);
  });

  it('DỪNG ở block không chọn được thay vì nhảy qua', () => {
    // Kéo từ 0 sang 3 nhưng block 2 đã bị đặt: chỉ được lấy 0,1.
    // Nhảy qua sẽ tạo dải không liên tục và server trả 409.
    const selectable = [true, true, false, true];
    expect(computeDragRange(0, 3, selectable)).toEqual([0, 1]);
  });

  it('dải ngược cũng dừng ở block không chọn được', () => {
    const selectable = [true, false, true, true];
    expect(computeDragRange(3, 0, selectable)).toEqual([3, 2]);
  });

  it('trả rỗng khi neo nằm trên block không chọn được', () => {
    expect(computeDragRange(1, 3, [true, false, true, true])).toEqual([]);
  });

  it('trả rỗng khi neo ngoài phạm vi', () => {
    expect(computeDragRange(-1, 2, all)).toEqual([]);
    expect(computeDragRange(9, 2, all)).toEqual([]);
  });
});

describe('mergeSelection', () => {
  it('thêm block mới vào tập đang chọn', () => {
    const { keys, truncated } = mergeSelection([T(18)], [T(19), T(20)]);
    expect(keys).toEqual([T(18), T(19), T(20)]);
    expect(truncated).toBe(false);
  });

  it('không nhân đôi block đã có', () => {
    const { keys } = mergeSelection([T(18)], [T(18), T(19)]);
    expect(keys).toEqual([T(18), T(19)]);
  });

  it('cắt khi vượt giới hạn và báo đã cắt', () => {
    const existing = Array.from({ length: MAX_SLOTS_PER_BOOKING - 1 }, (_, i) => T(8 + i));
    const { keys, truncated } = mergeSelection(existing, [T(23), T(23, 30)]);
    expect(keys).toHaveLength(MAX_SLOTS_PER_BOOKING);
    expect(truncated).toBe(true);
  });

  it('không cắt khi vừa đúng giới hạn', () => {
    const existing = Array.from({ length: MAX_SLOTS_PER_BOOKING - 1 }, (_, i) => T(8 + i));
    const { keys, truncated } = mergeSelection(existing, [T(23)]);
    expect(keys).toHaveLength(MAX_SLOTS_PER_BOOKING);
    expect(truncated).toBe(false);
  });
});

describe('toggleSelection', () => {
  it('bật block chưa chọn', () => {
    expect(toggleSelection([T(18)], T(19))).toEqual({ keys: [T(18), T(19)], truncated: false });
  });

  it('tắt block đã chọn', () => {
    expect(toggleSelection([T(18), T(19)], T(18))).toEqual({
      keys: [T(19)],
      truncated: false,
    });
  });

  it('không thêm khi đã đủ giới hạn, và báo đã cắt', () => {
    // `full` phủ 08:00–23:00, nên phải chọn mốc NGOÀI dải đó — dùng 23:30.
    const full = Array.from({ length: MAX_SLOTS_PER_BOOKING }, (_, i) => T(8 + i));
    const result = toggleSelection(full, T(23, 30));
    expect(result.keys).toHaveLength(MAX_SLOTS_PER_BOOKING);
    expect(result.truncated).toBe(true);
  });

  it('vẫn tắt được khi đang đầy — bỏ chọn không bao giờ bị chặn', () => {
    const full = Array.from({ length: MAX_SLOTS_PER_BOOKING }, (_, i) => T(8 + i));
    const result = toggleSelection(full, full[0]!);
    expect(result.keys).toHaveLength(MAX_SLOTS_PER_BOOKING - 1);
    expect(result.truncated).toBe(false);
  });
});

describe('totalPrice', () => {
  it('cộng giá đúng các block đang chọn', () => {
    const slots = [slot(T(18), 80_000), slot(T(19), 120_000), slot(T(20), 100_000)];
    expect(totalPrice(slots, [T(18), T(20)])).toBe(180_000);
  });

  it('bỏ qua block không nằm trong lựa chọn', () => {
    const slots = [slot(T(18), 80_000), slot(T(19), 120_000)];
    expect(totalPrice(slots, [T(18)])).toBe(80_000);
  });

  it('trả 0 khi chưa chọn gì', () => {
    expect(totalPrice([slot(T(18))], [])).toBe(0);
  });

  it('trả 0 khi lựa chọn không khớp slot nào', () => {
    expect(totalPrice([slot(T(18))], [T(23)])).toBe(0);
  });
});
