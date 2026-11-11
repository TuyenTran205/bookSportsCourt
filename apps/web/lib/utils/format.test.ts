import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  formatDateTimeInVietnam,
  formatDateTimeRangeInVietnam,
  formatShortDate,
  getVietnamDateRange,
} from './format';

afterEach(() => {
  vi.useRealTimers();
});

describe('Vietnam dashboard date formatting', () => {
  it('calculates report dates using the Vietnam calendar day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-16T18:00:00.000Z'));

    expect(getVietnamDateRange(7)).toEqual({ from: '2026-10-11', to: '2026-10-17' });
  });

  it('formats date-only report labels without shifting to the previous day', () => {
    expect(formatShortDate('2026-10-16')).toBe('16/10');
    expect(formatShortDate('not-a-date')).toBe('—');
  });

  it('renders booking ranges in Asia/Ho_Chi_Minh regardless of device timezone', () => {
    expect(
      formatDateTimeRangeInVietnam('2026-10-16T18:00:00.000Z', '2026-10-16T19:00:00.000Z'),
    ).toContain('17/10/2026');
  });

  it('renders booking creation timestamps in Asia/Ho_Chi_Minh', () => {
    expect(formatDateTimeInVietnam('2026-10-16T18:00:00.000Z')).toContain('17/10/2026');
    expect(formatDateTimeInVietnam('not-a-date')).toBe('—');
  });
});
