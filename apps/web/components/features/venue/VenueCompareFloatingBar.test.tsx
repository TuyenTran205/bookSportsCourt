// @vitest-environment jsdom
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import {
  COMPARE_STORAGE_KEY,
  type CompareVenueItem,
} from '@/lib/hooks/useVenueComparison';
import { VenueCompareFloatingBar } from './VenueCompareFloatingBar';

let mockPathname = '/venues';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    if (key === 'compareNow' && params) {
      return `So sánh ngay (${params.count}/3)`;
    }
    if (key === 'floatingBarTitle') return 'So sánh cơ sở';
    if (key === 'clearAll') return 'Xóa tất cả';
    if (key === 'removeVenueAria' && params) {
      return `Xóa ${params.name} khỏi danh sách so sánh`;
    }
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

const mockVenue1: CompareVenueItem = {
  id: 'venue-1',
  name: 'Sân Cầu Lông Thăng Long',
  slug: 'san-cau-long-thang-long',
  address: '123 Đường Láng, Hà Nội',
  lat: 21.01,
  lng: 105.82,
  coverUrl: null,
  ratingAvg: 4.8,
  reviewCount: 35,
  fromPrice: 120000,
  sports: [{ id: 'sp-1', name: 'Cầu lông', slug: 'cau-long' }],
};

const mockVenue2: CompareVenueItem = {
  id: 'venue-2',
  name: 'CLB Bóng Đá Phú Nhuận',
  slug: 'clb-bong-da-phu-nhuan',
  address: '456 Hoàng Văn Thụ, TP.HCM',
  lat: 10.80,
  lng: 106.67,
  coverUrl: null,
  ratingAvg: 4.5,
  reviewCount: 20,
  fromPrice: 180000,
  sports: [{ id: 'sp-2', name: 'Bóng đá', slug: 'bong-da' }],
};

describe('VenueCompareFloatingBar (TC-BAR)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockPathname = '/venues';
    vi.clearAllMocks();
  });

  it('TC-BAR-01: Không render khi danh sách so sánh rỗng', () => {
    const { container } = render(<VenueCompareFloatingBar />);
    expect(container.firstChild).toBeNull();
  });

  it('TC-BAR-02: Render khi có 1 sân nhưng nút so sánh bị disabled', () => {
    window.localStorage.setItem(
      COMPARE_STORAGE_KEY,
      JSON.stringify([mockVenue1]),
    );

    render(<VenueCompareFloatingBar />);

    expect(screen.getByText('So sánh cơ sở')).toBeDefined();
    expect(screen.getByText('Sân Cầu Lông Thăng Long')).toBeDefined();
    expect(screen.getByText('So sánh ngay (1/3)')).toBeDefined();

    // Nút so sánh bị disabled khi chỉ có 1 sân
    const compareBtn = screen.getByRole('button', { name: /So sánh ngay \(1\/3\)/i });
    expect(compareBtn.hasAttribute('disabled')).toBe(true);
  });

  it('TC-BAR-03: Kích hoạt nút khi đủ >= 2 sân', () => {
    window.localStorage.setItem(
      COMPARE_STORAGE_KEY,
      JSON.stringify([mockVenue1, mockVenue2]),
    );

    render(<VenueCompareFloatingBar />);

    const link = screen.getByRole('link', { name: /So sánh ngay \(2\/3\)/i });
    expect(link).toBeDefined();
    expect(link.getAttribute('href')).toBe('/venues/compare');
  });

  it('TC-BAR-04: Nút xóa từng sân khỏi thanh nổi', () => {
    window.localStorage.setItem(
      COMPARE_STORAGE_KEY,
      JSON.stringify([mockVenue1, mockVenue2]),
    );

    render(<VenueCompareFloatingBar />);

    const removeBtn = screen.getByRole('button', {
      name: `Xóa ${mockVenue1.name} khỏi danh sách so sánh`,
    });
    fireEvent.click(removeBtn);

    expect(screen.queryByText('Sân Cầu Lông Thăng Long')).toBeNull();
    expect(screen.getByText('CLB Bóng Đá Phú Nhuận')).toBeDefined();
  });

  it('TC-BAR-05: Nút xóa tất cả sẽ xóa toàn bộ và ẩn thanh nổi', () => {
    window.localStorage.setItem(
      COMPARE_STORAGE_KEY,
      JSON.stringify([mockVenue1, mockVenue2]),
    );

    const { container } = render(<VenueCompareFloatingBar />);

    const clearBtn = screen.getByRole('button', { name: /Xóa tất cả/i });
    fireEvent.click(clearBtn);

    expect(container.firstChild).toBeNull();
  });
});
