import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cancelNavigation,
  completeNavigation,
  getSnapshot,
  startNavigation,
  subscribe,
} from './navigation-store';
import { NAV_TIMING } from './constants';

describe('navigation-store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    cancelNavigation();
  });

  afterEach(() => {
    cancelNavigation();
    vi.useRealTimers();
  });

  it('UT-NAV-01: startNavigation từ idle đặt pending đúng target và progress khởi điểm', () => {
    startNavigation('/owner/timeline');

    const state = getSnapshot();
    expect(state.phase).toBe('pending');
    expect(state.target).toBe('/owner/timeline');
    expect(state.progress).toBe(8);
    expect(state.startedAt).toBeGreaterThan(0);
  });

  it('UT-NAV-02: gọi lại cùng target không đổi state', () => {
    startNavigation('/owner/timeline');
    const first = getSnapshot();

    startNavigation('/owner/timeline');

    expect(getSnapshot()).toBe(first);
  });

  it('UT-NAV-03: đổi target khi pending giữ nguyên progress', () => {
    startNavigation('/owner/timeline');
    vi.advanceTimersByTime(NAV_TIMING.TRICKLE_INTERVAL_MS * 3);
    const before = getSnapshot().progress;

    startNavigation('/owner/bookings');

    expect(getSnapshot().target).toBe('/owner/bookings');
    expect(getSnapshot().progress).toBe(before);
  });

  it('UT-NAV-04: completeNavigation đưa progress về 100', () => {
    startNavigation('/owner/timeline');
    vi.advanceTimersByTime(NAV_TIMING.SHOW_DELAY_MS + 10);

    completeNavigation();

    expect(getSnapshot().phase).toBe('completing');
    expect(getSnapshot().progress).toBe(100);
  });

  it('UT-NAV-05: sau khi complete và hết FADE_MS thì về idle', () => {
    startNavigation('/owner/timeline');
    vi.advanceTimersByTime(NAV_TIMING.SHOW_DELAY_MS + 10);
    completeNavigation();

    vi.advanceTimersByTime(
      NAV_TIMING.MIN_VISIBLE_MS + NAV_TIMING.FADE_MS + 50,
    );

    const state = getSnapshot();
    expect(state.phase).toBe('idle');
    expect(state.target).toBeNull();
    expect(state.progress).toBe(0);
  });

  it('UT-NAV-06: cancelNavigation dọn mọi timer đang chạy', () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    startNavigation('/owner/timeline');
    vi.advanceTimersByTime(NAV_TIMING.SHOW_DELAY_MS + 10);
    cancelNavigation();

    expect(getSnapshot().phase).toBe('idle');
    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(clearTimeoutSpy).toHaveBeenCalled();

    clearIntervalSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });

  it('UT-NAV-07: không complete thì HARD_TIMEOUT_MS tự đưa về idle', () => {
    startNavigation('/owner/timeline');
    vi.advanceTimersByTime(NAV_TIMING.HARD_TIMEOUT_MS + 10);

    expect(getSnapshot().phase).toBe('idle');
    expect(getSnapshot().visible).toBe(false);
  });

  it('UT-NAV-08: progress tăng đơn điệu và không vượt 90 khi pending', () => {
    startNavigation('/owner/timeline');
    let previous = getSnapshot().progress;

    for (let i = 0; i < 10; i += 1) {
      vi.advanceTimersByTime(NAV_TIMING.TRICKLE_INTERVAL_MS);
      const current = getSnapshot().progress;
      expect(current).toBeGreaterThanOrEqual(previous);
      expect(current).toBeLessThanOrEqual(90);
      previous = current;
    }
  });

  it('UT-NAV-09: subscribe nhận thông báo và unsubscribe dừng nhận', () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);

    startNavigation('/owner/timeline');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    startNavigation('/owner/bookings');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('UT-NAV-10: startNavigation khi đang completing khởi động lại an toàn', () => {
    startNavigation('/owner/timeline');
    vi.advanceTimersByTime(NAV_TIMING.SHOW_DELAY_MS + 10);
    completeNavigation();
    expect(getSnapshot().phase).toBe('completing');

    startNavigation('/owner/bookings');

    expect(getSnapshot().phase).toBe('pending');
    expect(getSnapshot().target).toBe('/owner/bookings');
    expect(getSnapshot().progress).toBe(8);
  });

  it('UT-NAV-11: điều hướng xong trước SHOW_DELAY_MS không hiện thanh', () => {
    startNavigation('/owner/timeline');
    completeNavigation();

    expect(getSnapshot().phase).toBe('idle');
    expect(getSnapshot().visible).toBe(false);
  });
});
