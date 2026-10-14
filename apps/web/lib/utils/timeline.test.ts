import { describe, expect, it } from 'vitest';

import type { Blackout, Court, OpeningHour, OwnerTimelineBooking } from '@bsc/shared';

import {
  buildTimelineAxis,
  cellState,
  courtWindow,
  hhmmFromMinutes,
  isoFromMinutes,
  minuteOfDay,
  minutesFromHHmm,
} from './timeline';

/**
 * Test cho logic trục thời gian OwnerTimeline.
 *
 * Trọng tâm: docs/07 mục 10 nói rõ trục KHÔNG được hard-code 8:00–22:00 mà
 * phải suy từ `opening_hours` của từng court.
 */

const court = (id: string, name = id): Court => ({
  id,
  name,
  sportId: null,
  status: 'active',
});

const hour = (
  weekday: number,
  openTime: string,
  closeTime: string,
  courtId: string | null = null,
  isClosed = false,
): OpeningHour => ({
  id: `${courtId ?? 'venue'}-${weekday}`,
  venueId: 'v1',
  courtId,
  weekday,
  openTime,
  closeTime,
  isClosed,
});

describe('minutesFromHHmm / hhmmFromMinutes', () => {
  it('đổi qua lại đúng', () => {
    expect(minutesFromHHmm('06:30')).toBe(390);
    expect(minutesFromHHmm('23:00')).toBe(1380);
    expect(minutesFromHHmm('00:00')).toBe(0);
    expect(hhmmFromMinutes(390)).toBe('06:30');
    expect(hhmmFromMinutes(0)).toBe('00:00');
  });

  it('chấp nhận giờ không có số 0 đứng đầu', () => {
    expect(minutesFromHHmm('6:30')).toBe(390);
  });

  it('trả null với chuỗi không hợp lệ', () => {
    expect(minutesFromHHmm('')).toBeNull();
    expect(minutesFromHHmm('abc')).toBeNull();
    expect(minutesFromHHmm('25:00')).toBeNull();
    expect(minutesFromHHmm('10:75')).toBeNull();
  });
});

describe('isoFromMinutes', () => {
  it('ghép ngày + phút kèm offset +07:00', () => {
    expect(isoFromMinutes('2026-10-15', 390)).toBe('2026-10-15T06:30:00+07:00');
  });
});

describe('minuteOfDay', () => {
  it('đọc phút trong ngày từ mốc ISO', () => {
    expect(minuteOfDay('2026-10-15T19:30:00+07:00')).toBe(1170);
  });

  it('trả null khi chuỗi sai định dạng', () => {
    expect(minuteOfDay('không phải iso')).toBeNull();
  });
});

describe('courtWindow', () => {
  it('dùng cấu hình riêng của court khi có', () => {
    const hours = [hour(3, '06:00', '23:00', 'c1'), hour(3, '08:00', '22:00', null)];
    expect(courtWindow('c1', 3, hours)).toEqual({ openMinute: 360, closeMinute: 1380 });
  });

  it('rơi về cấu hình chung của venue khi court không có riêng', () => {
    const hours = [hour(3, '08:00', '22:00', null)];
    expect(courtWindow('c9', 3, hours)).toEqual({ openMinute: 480, closeMinute: 1320 });
  });

  it('trả null khi sân đóng cửa cả ngày', () => {
    const hours = [hour(0, '08:00', '22:00', null, true)];
    expect(courtWindow('c1', 0, hours)).toBeNull();
  });

  it('trả null khi không có cấu hình cho thứ đó', () => {
    expect(courtWindow('c1', 5, [hour(3, '08:00', '22:00')])).toBeNull();
  });

  it('trả null khi giờ mở cửa không hợp lệ thay vì vẽ trục sai', () => {
    const hours = [hour(3, '22:00', '08:00', null)];
    expect(courtWindow('c1', 3, hours)).toBeNull();
  });

  it('trả null khi giờ mở bằng giờ đóng', () => {
    expect(courtWindow('c1', 3, [hour(3, '08:00', '08:00')])).toBeNull();
  });
});

describe('buildTimelineAxis', () => {
  it('KHÔNG hard-code 8:00–22:00 — lấy min(open) và max(close)', () => {
    // Sân cầu lông 6:00–23:00 và sân bóng đá 8:00–22:00 trong cùng venue:
    // trục phải trải 6:00–23:00, đúng ví dụ trong docs/07.
    const courts = [court('c1'), court('c2')];
    const hours = [hour(3, '06:00', '23:00', 'c1'), hour(3, '08:00', '22:00', 'c2')];

    const axis = buildTimelineAxis(courts, 3, hours);
    expect(axis?.startMinute).toBe(360);
    expect(axis?.endMinute).toBe(1380);
  });

  it('sinh mốc block cách nhau 30 phút', () => {
    const axis = buildTimelineAxis([court('c1')], 3, [hour(3, '06:00', '08:00', 'c1')]);
    expect(axis?.slots).toEqual([360, 390, 420, 450]);
  });

  it('mốc cuối không vượt giờ đóng', () => {
    const axis = buildTimelineAxis([court('c1')], 3, [hour(3, '06:00', '07:30', 'c1')]);
    // 07:30 là giờ đóng nên block cuối bắt đầu lúc 07:00.
    expect(axis?.slots).toEqual([360, 390, 420]);
  });

  it('bỏ qua court đóng cửa khi tính min/max', () => {
    const courts = [court('c1'), court('c2')];
    const hours = [hour(3, '06:00', '23:00', 'c1'), hour(3, '08:00', '22:00', 'c2', true)];
    const axis = buildTimelineAxis(courts, 3, hours);
    expect(axis?.startMinute).toBe(360);
    expect(axis?.endMinute).toBe(1380);
  });

  it('trả null khi venue không có court nào', () => {
    expect(buildTimelineAxis([], 3, [hour(3, '06:00', '23:00')])).toBeNull();
  });

  it('trả null khi mọi court đều đóng', () => {
    const courts = [court('c1')];
    expect(buildTimelineAxis(courts, 3, [hour(3, '06:00', '23:00', 'c1', true)])).toBeNull();
  });
});

describe('cellState', () => {
  const window = { openMinute: 360, closeMinute: 1380 }; // 06:00–23:00

  const booking = (courtId: string, start: string, end: string): OwnerTimelineBooking => ({
    id: `b-${start}`,
    courtId,
    during: { start, end },
    status: 'confirmed',
    source: 'online',
    guestName: null,
    customerName: 'Nguyễn Văn A',
    totalPrice: 160_000,
  });

  it('ô trước giờ mở cửa là closed', () => {
    const info = cellState('c1', 330, window, [], []); // 05:30
    expect(info.state).toBe('closed');
  });

  it('ô kết thúc sau giờ đóng là closed', () => {
    // 22:30 + 30p = 23:00 vừa khít → vẫn hợp lệ; 23:00 là quá giờ đóng.
    expect(cellState('c1', 1380, window, [], []).state).toBe('closed');
  });

  it('ô vừa khít giờ đóng vẫn hợp lệ', () => {
    // Block 22:30–23:00 nằm trọn trong giờ mở cửa.
    expect(cellState('c1', 1350, window, [], []).state).toBe('free');
  });

  it('ô ngoài giờ mở cửa KHÔNG bị coi là blocked', () => {
    const info = cellState('c1', 300, window, [], []);
    expect(info.state).not.toBe('blocked');
  });

  it('ô trống trong giờ là free', () => {
    const info = cellState('c1', 600, window, [], []);
    expect(info.state).toBe('free');
  });

  it('ô có booking là booked và kèm dữ liệu booking', () => {
    const b = booking('c1', '2026-10-15T10:00:00+07:00', '2026-10-15T11:00:00+07:00');
    const info = cellState('c1', 1080 - 480, window, [b], []);
    expect(info.state).toBe('booked');
    expect(info.booking?.id).toBe(b.id);
  });

  it('chỉ tính booking của ĐÚNG court đó', () => {
    const b = booking('c2', '2026-10-15T10:00:00+07:00', '2026-10-15T11:00:00+07:00');
    const info = cellState('c1', 600, window, [b], []);
    expect(info.state).toBe('free');
  });

  it('booking phủ trọn block 30 phút', () => {
    const b = booking('c1', '2026-10-15T10:00:00+07:00', '2026-10-15T10:30:00+07:00');
    expect(cellState('c1', 600, window, [b], []).state).toBe('booked');
  });

  it('booking chồng lấn một phần vẫn tính là booked', () => {
    // Booking 10:15–10:45 chồng lên cả block 10:00 và 10:30.
    const b = booking('c1', '2026-10-15T10:15:00+07:00', '2026-10-15T10:45:00+07:00');
    expect(cellState('c1', 600, window, [b], []).state).toBe('booked');
    expect(cellState('c1', 630, window, [b], []).state).toBe('booked');
  });

  it('blackout cho ra blocked', () => {
    const blackout: Blackout = {
      id: 'bl1',
      courtId: 'c1',
      start: '2026-10-15T10:00:00+07:00',
      end: '2026-10-15T11:00:00+07:00',
      reason: 'Bảo trì',
      createdAt: '2026-10-01T09:00:00+07:00',
    };
    expect(cellState('c1', 600, window, [], [blackout]).state).toBe('blocked');
  });

  it('booking được ưu tiên hơn blackout', () => {
    const b = booking('c1', '2026-10-15T10:00:00+07:00', '2026-10-15T10:30:00+07:00');
    const blackout: Blackout = {
      id: 'bl1',
      courtId: 'c1',
      start: '2026-10-15T10:00:00+07:00',
      end: '2026-10-15T10:30:00+07:00',
      reason: 'Bảo trì',
      createdAt: '2026-10-01T09:00:00+07:00',
    };
    expect(cellState('c1', 600, window, [b], [blackout]).state).toBe('booked');
  });

  it('sân không mở cửa thì mọi ô đều closed', () => {
    expect(cellState('c1', 600, null, [], []).state).toBe('closed');
  });

  it('blackout của court khác không ảnh hưởng', () => {
    const blackout: Blackout = {
      id: 'bl1',
      courtId: 'c2',
      start: '2026-10-15T10:00:00+07:00',
      end: '2026-10-15T11:00:00+07:00',
      reason: 'Bảo trì',
      createdAt: '2026-10-01T09:00:00+07:00',
    };
    expect(cellState('c1', 600, window, [], [blackout]).state).toBe('free');
  });

  it('blackout kèm date chỉ khoá đúng ngày chỉ định, KHÔNG khoá ngày khác', () => {
    const blackout: Blackout = {
      id: 'bl1',
      courtId: 'c1',
      start: '2026-10-15T10:00:00+07:00',
      end: '2026-10-15T11:00:00+07:00',
      reason: 'Bảo trì ngày 15',
      createdAt: '2026-10-01T09:00:00+07:00',
    };

    // Đúng ngày 2026-10-15: ô 10:00 (phút 600) bị blocked và trả về blackout
    const infoMatch = cellState('c1', 600, window, [], [blackout], null, '2026-10-15');
    expect(infoMatch.state).toBe('blocked');
    expect(infoMatch.blackout?.id).toBe('bl1');

    // Ngày hôm trước 2026-10-14: ô 10:00 phải là free, KHÔNG được blocked!
    const infoPrev = cellState('c1', 600, window, [], [blackout], null, '2026-10-14');
    expect(infoPrev.state).toBe('free');

    // Ngày hôm sau 2026-10-16: ô 10:00 phải là free!
    const infoNext = cellState('c1', 600, window, [], [blackout], null, '2026-10-16');
    expect(infoNext.state).toBe('free');
  });

  it('blackout cũ từ năm 2000 không khoá sân của ngày hiện tại khi có date', () => {
    const ancientBlackout: Blackout = {
      id: 'bl-old',
      courtId: 'c1',
      start: '2000-01-01T11:00:00+07:00',
      end: '2000-01-01T14:00:00+07:00',
      reason: 'Bảo trì cổ xưa',
      createdAt: '2026-09-01T00:00:00.000Z',
    };
    const info = cellState('c1', 660, window, [], [ancientBlackout], null, '2026-10-15');
    expect(info.state).toBe('free');
  });
});
