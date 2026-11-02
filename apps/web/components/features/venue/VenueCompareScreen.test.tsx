// @vitest-environment jsdom
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import {
  COMPARE_STORAGE_KEY,
  type CompareVenueItem,
} from '@/lib/hooks/useVenueComparison';
import { VenueCompareScreen } from './VenueCompareScreen';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    const translations: Record<string, string> = {
      title: 'So sánh cơ sở thể thao',
      subtitle: 'Đối chiếu các thông số quan trọng giữa các cơ sở',
      emptyTitle: 'Chưa có cơ sở nào trong danh sách so sánh',
      emptyDesc: 'Hãy duyệt danh sách sân thể thao và bấm nút So sánh',
      exploreVenues: 'Khám phá danh sách sân',
      oneVenueWarning: 'Bạn đã chọn 1 cơ sở. Vui lòng chọn thêm ít nhất 1 cơ sở nữa.',
      addMore: '+ Thêm cơ sở',
      criteriaHeader: 'Thông số đối chiếu',
      sports: 'Môn thể thao',
      fromPrice: 'Giá thuê từ',
      bestPriceBadge: 'Giá tốt nhất',
      rating: 'Đánh giá & Uy tín',
      location: 'Khu vực & Địa chỉ',
      actions: 'Thao tác',
      bookNow: 'Đặt sân ngay',
      viewDetail: 'Xem chi tiết',
      clearAll: 'Xóa tất cả',
    };
    if (key === 'removeVenueAria' && params) {
      return `Xóa ${params.name} khỏi danh sách so sánh`;
    }
    return translations[key] ?? key;
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

const mockVenueA: CompareVenueItem = {
  id: 'venue-a',
  name: 'Sân Cầu Lông Ba Đình',
  slug: 'san-cau-long-ba-dinh',
  address: '10 Kim Mã, Hà Nội',
  provinceName: 'Hà Nội',
  districtName: 'Ba Đình',
  lat: 21.03,
  lng: 105.82,
  coverUrl: null,
  ratingAvg: 4.8,
  reviewCount: 30,
  fromPrice: 100000,
  sports: [{ id: 'sp-1', name: 'Cầu lông', slug: 'cau-long' }],
};

const mockVenueB: CompareVenueItem = {
  id: 'venue-b',
  name: 'Sân Tennis Cầu Giấy',
  slug: 'san-tennis-cau-giay',
  address: '20 Cầu Giấy, Hà Nội',
  provinceName: 'Hà Nội',
  districtName: 'Cầu Giấy',
  lat: 21.03,
  lng: 105.79,
  coverUrl: null,
  ratingAvg: 4.5,
  reviewCount: 15,
  fromPrice: 150000,
  sports: [{ id: 'sp-2', name: 'Tennis', slug: 'tennis' }],
};

describe('VenueCompareScreen (TC-SCR)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('TC-SCR-01: Hiển thị EmptyState khi danh sách so sánh rỗng', () => {
    render(<VenueCompareScreen />);

    expect(screen.getByText('Chưa có cơ sở nào trong danh sách so sánh')).toBeDefined();
    const exploreBtn = screen.getByRole('link', { name: /Khám phá danh sách sân/i });
    expect(exploreBtn.getAttribute('href')).toBe('/venues');
  });

  it('TC-SCR-02: Cảnh báo và card cơ sở khi chỉ có 1 cơ sở', () => {
    window.localStorage.setItem(
      COMPARE_STORAGE_KEY,
      JSON.stringify([mockVenueA]),
    );

    render(<VenueCompareScreen />);

    expect(
      screen.getByText('Bạn đã chọn 1 cơ sở. Vui lòng chọn thêm ít nhất 1 cơ sở nữa.'),
    ).toBeDefined();
    expect(screen.getByText('Sân Cầu Lông Ba Đình')).toBeDefined();
    expect(screen.getByText('+ Thêm cơ sở')).toBeDefined();
  });

  it('TC-SCR-03: Hiển thị ma trận đối chiếu 2 cột khi có 2 cơ sở', () => {
    window.localStorage.setItem(
      COMPARE_STORAGE_KEY,
      JSON.stringify([mockVenueA, mockVenueB]),
    );

    render(<VenueCompareScreen />);

    expect(screen.getByText('Thông số đối chiếu')).toBeDefined();
    expect(screen.getByText('Sân Cầu Lông Ba Đình')).toBeDefined();
    expect(screen.getByText('Sân Tennis Cầu Giấy')).toBeDefined();
    expect(screen.getByText('Môn thể thao')).toBeDefined();
    expect(screen.getByText('Giá thuê từ')).toBeDefined();
    expect(screen.getByText('Đánh giá & Uy tín')).toBeDefined();
    expect(screen.getByText('Khu vực & Địa chỉ')).toBeDefined();
  });

  it('TC-SCR-04: Hiển thị badge Giá tốt nhất cho cơ sở có mức giá rẻ hơn', () => {
    window.localStorage.setItem(
      COMPARE_STORAGE_KEY,
      JSON.stringify([mockVenueA, mockVenueB]),
    );

    render(<VenueCompareScreen />);

    // Sân A có giá 100.000đ < Sân B 150.000đ -> có badge "Giá tốt nhất"
    expect(screen.getByText('Giá tốt nhất')).toBeDefined();
  });

  it('TC-SCR-05: Nút xóa cơ sở trong bảng', () => {
    window.localStorage.setItem(
      COMPARE_STORAGE_KEY,
      JSON.stringify([mockVenueA, mockVenueB]),
    );

    render(<VenueCompareScreen />);

    const removeBtnA = screen.getByRole('button', {
      name: `Xóa ${mockVenueA.name} khỏi danh sách so sánh`,
    });
    fireEvent.click(removeBtnA);

    // Sau khi xóa Sân A, chỉ còn Sân B (chuyển sang trạng thái 1 sân)
    expect(screen.queryByText('Sân Cầu Lông Ba Đình')).toBeNull();
    expect(screen.getByText('Sân Tennis Cầu Giấy')).toBeDefined();
  });

  it('TC-SCR-06: Nút CTA Đặt sân ngay trỏ đúng đường dẫn', () => {
    window.localStorage.setItem(
      COMPARE_STORAGE_KEY,
      JSON.stringify([mockVenueA, mockVenueB]),
    );

    render(<VenueCompareScreen />);

    const bookLinks = screen.getAllByRole('link', { name: /Đặt sân ngay/i });
    expect(bookLinks.length).toBeGreaterThanOrEqual(2);
    expect(bookLinks[0]?.getAttribute('href')).toBe('/venues/san-cau-long-ba-dinh');
    expect(bookLinks[1]?.getAttribute('href')).toBe('/venues/san-tennis-cau-giay');
  });
});
