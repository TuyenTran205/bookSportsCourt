// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CourtSlots } from '@bsc/shared';

import { SlotGrid } from './SlotGrid';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

const courtsFixture: CourtSlots[] = [
  {
    courtId: 'court-1',
    slots: [
      { start: '2035-06-01T08:00:00+07:00', end: '2035-06-01T08:30:00+07:00', price: 100000, status: 'available' },
      { start: '2035-06-01T08:30:00+07:00', end: '2035-06-01T09:00:00+07:00', price: 100000, status: 'available' },
      { start: '2035-06-01T09:00:00+07:00', end: '2035-06-01T09:30:00+07:00', price: 100000, status: 'booked' },
      { start: '2035-06-01T09:30:00+07:00', end: '2035-06-01T10:00:00+07:00', price: 100000, status: 'blocked' },
      { start: '2035-06-01T10:00:00+07:00', end: '2035-06-01T10:30:00+07:00', price: 100000, status: 'held', mine: false },
      { start: '2035-06-01T10:30:00+07:00', end: '2035-06-01T11:00:00+07:00', price: 100000, status: 'past' },
    ],
  },
];

describe('SlotGrid (CUS-07)', () => {
  afterEach(() => {
    cleanup();
  });

  it('hiển thị đúng các trạng thái slot và chỉ bật các ô available', () => {
    const onSelectedChange = vi.fn();
    render(
      <SlotGrid
        courts={[
          courtsFixture[0]!,
          { courtId: 'court-2', slots: courtsFixture[0]!.slots },
        ]}
        courtNames={{ 'court-1': 'Sân 1', 'court-2': 'Sân 2' }}
        selected={[]}
        onSelectedChange={onSelectedChange}
      />,
    );

    const enabled = document.querySelectorAll('button[data-slot-cell]:not([disabled])');
    const disabled = document.querySelectorAll('button[data-slot-cell][disabled]');
    expect(enabled.length).toBe(4);
    expect(disabled.length).toBe(8);
    expect(screen.getByText('Sân 1')).not.toBeNull();
    expect(screen.getByText('Sân 2')).not.toBeNull();
  });

  it('chọn và bỏ chọn block available bằng bàn phím/pointer, và gọi onLimitReached khi vượt tối đa', () => {
    const onSelectedChange = vi.fn();
    const onLimitReached = vi.fn();
    const manySlots = Array.from({ length: 18 }, (_, i) => {
      const h = String(6 + Math.floor(i / 2)).padStart(2, '0');
      const m = i % 2 === 0 ? '00' : '30';
      const nextH = String(6 + Math.floor((i + 1) / 2)).padStart(2, '0');
      const nextM = (i + 1) % 2 === 0 ? '00' : '30';
      return {
        start: `2035-06-01T${h}:${m}:00+07:00`,
        end: `2035-06-01T${nextH}:${nextM}:00+07:00`,
        price: 50000,
        status: 'available' as const,
      };
    });

    const preselected = manySlots.slice(0, 16).map((s) => s.start);

    render(
      <SlotGrid
        courts={[{ courtId: 'court-1', slots: manySlots }]}
        selected={preselected}
        onSelectedChange={onSelectedChange}
        onLimitReached={onLimitReached}
      />,
    );

    // Chọn block thứ 17 vượt MAX_SLOTS_PER_BOOKING (16)
    const cells = document.querySelectorAll('button[data-slot-cell]');
    fireEvent.keyDown(cells[16]!, { key: 'Enter' });
    expect(onLimitReached).toHaveBeenCalledWith(16);

    // Bấm lại block đang chọn để bỏ chọn
    fireEvent.keyDown(cells[0]!, { key: 'Enter' });
    expect(onSelectedChange).toHaveBeenCalledWith(preselected.slice(1));
  });
});
