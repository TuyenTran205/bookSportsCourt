// @vitest-environment jsdom
import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { OpeningHour } from '@bsc/shared';
import { VenueOpeningHours } from './VenueOpeningHours';

const mockOpeningHours: OpeningHour[] = [
  {
    id: 'oh-1',
    venueId: 'v-1',
    courtId: null,
    weekday: 1, // Thứ Hai
    openTime: '06:00',
    closeTime: '22:00',
    isClosed: false,
  },
  {
    id: 'oh-2',
    venueId: 'v-1',
    courtId: null,
    weekday: 2, // Thứ Ba
    openTime: '06:00',
    closeTime: '22:00',
    isClosed: false,
  },
  {
    id: 'oh-3',
    venueId: 'v-1',
    courtId: null,
    weekday: 3, // Thứ Tư
    openTime: '06:00',
    closeTime: '22:00',
    isClosed: false,
  },
  {
    id: 'oh-4',
    venueId: 'v-1',
    courtId: null,
    weekday: 4, // Thứ Năm
    openTime: '06:00',
    closeTime: '22:00',
    isClosed: false,
  },
  {
    id: 'oh-5',
    venueId: 'v-1',
    courtId: null,
    weekday: 5, // Thứ Sáu
    openTime: '06:00',
    closeTime: '23:00',
    isClosed: false,
  },
  {
    id: 'oh-6',
    venueId: 'v-1',
    courtId: null,
    weekday: 6, // Thứ Bảy
    openTime: '07:00',
    closeTime: '23:00',
    isClosed: false,
  },
  {
    id: 'oh-0',
    venueId: 'v-1',
    courtId: null,
    weekday: 0, // Chủ Nhật
    openTime: '00:00',
    closeTime: '00:00',
    isClosed: true,
  },
];

describe('VenueOpeningHours Component (TC-OH)', () => {
  it('TC-OH-01: render đủ 7 ngày trong tuần từ Thứ Hai đến Chủ Nhật', () => {
    render(<VenueOpeningHours openingHours={mockOpeningHours} />);

    expect(screen.getByText('Thứ Hai')).toBeDefined();
    expect(screen.getByText('Thứ Ba')).toBeDefined();
    expect(screen.getByText('Thứ Tư')).toBeDefined();
    expect(screen.getByText('Thứ Năm')).toBeDefined();
    expect(screen.getByText('Thứ Sáu')).toBeDefined();
    expect(screen.getByText('Thứ Bảy')).toBeDefined();
    expect(screen.getByText('Chủ Nhật')).toBeDefined();

    expect(screen.getAllByText('06:00 – 22:00').length).toBeGreaterThan(0);
    expect(screen.getByText('07:00 – 23:00')).toBeDefined();
  });

  it('TC-OH-02: tự động highlight ngày hiện tại kèm badge "Hôm nay"', () => {
    render(<VenueOpeningHours openingHours={mockOpeningHours} />);

    const todayBadge = screen.getByText('Hôm nay');
    expect(todayBadge).toBeDefined();

    const currentWeekday = new Date().getDay();
    const todayRow = screen.getByTestId(`opening-hour-row-${currentWeekday}`);
    expect(todayRow.className).toContain('border-primary-300');
  });

  it('TC-OH-03: hiển thị badge "Đóng cửa" cho ngày nghỉ (isClosed = true)', () => {
    render(<VenueOpeningHours openingHours={mockOpeningHours} />);

    const closedBadge = screen.getByText('Đóng cửa');
    expect(closedBadge).toBeDefined();
  });

  it('TC-OH-04: hiển thị thông báo fallback khi openingHours rỗng hoặc null', () => {
    const { rerender } = render(<VenueOpeningHours openingHours={[]} />);
    expect(screen.getByText('Đang cập nhật giờ mở cửa')).toBeDefined();

    rerender(<VenueOpeningHours openingHours={null} />);
    expect(screen.getByText('Đang cập nhật giờ mở cửa')).toBeDefined();
  });
});
