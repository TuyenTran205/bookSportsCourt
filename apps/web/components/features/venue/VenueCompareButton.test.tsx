// @vitest-environment jsdom
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import {
  COMPARE_STORAGE_KEY,
  type CompareVenueItem,
} from '@/lib/hooks/useVenueComparison';
import { VenueCompareButton } from './VenueCompareButton';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    if (key === 'btnCompare') return 'So sánh';
    if (key === 'btnComparing') return 'Đang so sánh';
    return key;
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

const mockVenue: CompareVenueItem = {
  id: 'venue-btn-1',
  name: 'Sân Cầu Lông Đống Đa',
  slug: 'san-cau-long-dong-da',
  address: '10 Hào Nam, Hà Nội',
  lat: 21.02,
  lng: 105.83,
  coverUrl: null,
  ratingAvg: 4.7,
  reviewCount: 22,
  fromPrice: 130000,
  sports: [{ id: 'sp-1', name: 'Cầu lông', slug: 'cau-long' }],
};

describe('VenueCompareButton Component', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('render trạng thái ban đầu chưa chọn (icon variant)', () => {
    render(<VenueCompareButton venue={mockVenue} />);

    const btn = screen.getByRole('button', { name: /So sánh: Sân Cầu Lông Đống Đa/i });
    expect(btn).toBeDefined();
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });

  it('bấm nút để thêm vào danh sách so sánh', () => {
    render(<VenueCompareButton venue={mockVenue} />);

    const btn = screen.getByRole('button', { name: /So sánh: Sân Cầu Lông Đống Đa/i });
    fireEvent.click(btn);

    const saved = JSON.parse(window.localStorage.getItem(COMPARE_STORAGE_KEY) || '[]');
    expect(saved.length).toBe(1);
    expect(saved[0].id).toBe('venue-btn-1');
  });

  it('bấm nút lần 2 để loại khỏi danh sách so sánh', () => {
    window.localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify([mockVenue]));

    render(<VenueCompareButton venue={mockVenue} />);

    const btn = screen.getByRole('button', { name: /Đang so sánh: Sân Cầu Lông Đống Đa/i });
    expect(btn.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(btn);

    const saved = JSON.parse(window.localStorage.getItem(COMPARE_STORAGE_KEY) || '[]');
    expect(saved.length).toBe(0);
  });

  it('render button variant hiển thị text nhãn', () => {
    render(<VenueCompareButton venue={mockVenue} variant="button" showText />);

    expect(screen.getByText('So sánh')).toBeDefined();
  });
});
