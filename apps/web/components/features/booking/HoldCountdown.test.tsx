// @vitest-environment jsdom
import * as React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HoldCountdown } from './HoldCountdown';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('HoldCountdown (CUS-08)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-24T10:00:00.000Z'));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('hiển thị thời gian đếm ngược chuẩn MM:SS khi còn > 2 phút', () => {
    const expiresAt = new Date('2026-11-24T10:08:30.000Z').toISOString();
    render(<HoldCountdown expiresAt={expiresAt} />);

    const timer = screen.getByRole('timer');
    expect(timer.textContent).toContain('08:30');
    expect(timer.textContent).toContain('holdCountdownLabel');
    expect(screen.queryByText('holdUrgent')).toBeNull();
  });

  it('bật cảnh báo urgent khi còn <= 2 phút', () => {
    const expiresAt = new Date('2026-11-24T10:01:45.000Z').toISOString();
    render(<HoldCountdown expiresAt={expiresAt} />);

    const timer = screen.getByRole('timer');
    expect(timer.textContent).toContain('01:45');
    expect(screen.getByText('holdUrgent')).not.toBeNull();
  });

  it('gọi onExpire đúng 1 lần khi đồng hồ về 00:00', () => {
    const onExpire = vi.fn();
    const expiresAt = new Date('2026-11-24T10:00:03.000Z').toISOString();
    render(<HoldCountdown expiresAt={expiresAt} onExpire={onExpire} />);

    expect(onExpire).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(onExpire).toHaveBeenCalledTimes(1);
    const timer = screen.getByRole('timer');
    expect(timer.textContent).toContain('00:00');
    expect(timer.textContent).toContain('holdExpiredTitle');
  });
});
