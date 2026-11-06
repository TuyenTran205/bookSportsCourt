// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';

import {
  COMPARE_STORAGE_KEY,
  type CompareVenueItem,
  useVenueComparison,
} from './useVenueComparison';

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
  coverUrl: 'https://example.com/v1.jpg',
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
  coverUrl: 'https://example.com/v2.jpg',
  ratingAvg: 4.5,
  reviewCount: 20,
  fromPrice: 180000,
  sports: [{ id: 'sp-2', name: 'Bóng đá', slug: 'bong-da' }],
};

const mockVenue3: CompareVenueItem = {
  id: 'venue-3',
  name: 'Sân Pickleball Cầu Giấy',
  slug: 'san-pickleball-cau-giay',
  address: '789 Duy Tân, Hà Nội',
  lat: 21.03,
  lng: 105.78,
  coverUrl: null,
  ratingAvg: 4.9,
  reviewCount: 50,
  fromPrice: 150000,
  sports: [{ id: 'sp-3', name: 'Pickleball', slug: 'pickleball' }],
};

const mockVenue4: CompareVenueItem = {
  id: 'venue-4',
  name: 'Sân Tennis Mỹ Đình',
  slug: 'san-tennis-my-dinh',
  address: '101 Lê Đức Thọ, Hà Nội',
  lat: 21.02,
  lng: 105.76,
  coverUrl: null,
  ratingAvg: 4.6,
  reviewCount: 15,
  fromPrice: 200000,
  sports: [{ id: 'sp-4', name: 'Tennis', slug: 'tennis' }],
};

describe('useVenueComparison Hook (TC-CMP)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('TC-CMP-01: Khởi tạo rỗng khi localStorage chưa có dữ liệu', () => {
    const { result } = renderHook(() => useVenueComparison());

    expect(result.current.venues).toEqual([]);
    expect(result.current.count).toBe(0);
    expect(result.current.canCompare).toBe(false);
  });

  it('TC-CMP-02: Thêm 1 cơ sở thành công và lưu vào localStorage', () => {
    const { result } = renderHook(() => useVenueComparison());

    let success = false;
    act(() => {
      success = result.current.addVenue(mockVenue1);
    });

    expect(success).toBe(true);
    expect(result.current.count).toBe(1);
    expect(result.current.venues[0]?.id).toBe('venue-1');
    expect(result.current.isInComparison('venue-1')).toBe(true);
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining('Sân Cầu Lông Thăng Long'),
    );

    // Kiểm tra lưu trong localStorage
    const saved = JSON.parse(window.localStorage.getItem(COMPARE_STORAGE_KEY) || '[]');
    expect(saved.length).toBe(1);
    expect(saved[0].id).toBe('venue-1');
  });

  it('TC-CMP-03: Chặn thêm cơ sở trùng lặp', () => {
    const { result } = renderHook(() => useVenueComparison());

    act(() => {
      result.current.addVenue(mockVenue1);
    });

    act(() => {
      const addedAgain = result.current.addVenue(mockVenue1);
      expect(addedAgain).toBe(true);
    });

    expect(result.current.count).toBe(1);
  });

  it('TC-CMP-04: Chặn thêm vượt quá 3 cơ sở (MAX_COMPARE_VENUES = 3)', () => {
    const { result } = renderHook(() => useVenueComparison());

    act(() => {
      result.current.addVenue(mockVenue1);
      result.current.addVenue(mockVenue2);
      result.current.addVenue(mockVenue3);
    });

    expect(result.current.count).toBe(3);

    let fourthResult = true;
    act(() => {
      fourthResult = result.current.addVenue(mockVenue4);
    });

    expect(fourthResult).toBe(false);
    expect(result.current.count).toBe(3);
    expect(toast.warning).toHaveBeenCalledWith(
      expect.stringContaining('tối đa 3 cơ sở'),
    );
  });

  it('TC-CMP-05: Xóa cơ sở theo ID', () => {
    const { result } = renderHook(() => useVenueComparison());

    act(() => {
      result.current.addVenue(mockVenue1);
      result.current.addVenue(mockVenue2);
    });

    expect(result.current.count).toBe(2);
    expect(result.current.canCompare).toBe(true);

    act(() => {
      result.current.removeVenue('venue-1');
    });

    expect(result.current.count).toBe(1);
    expect(result.current.isInComparison('venue-1')).toBe(false);
    expect(result.current.isInComparison('venue-2')).toBe(true);
    expect(result.current.canCompare).toBe(false);
    expect(toast.info).toHaveBeenCalledWith(
      expect.stringContaining('Sân Cầu Lông Thăng Long'),
    );
  });

  it('TC-CMP-06: Xóa tất cả các cơ sở trong danh sách', () => {
    const { result } = renderHook(() => useVenueComparison());

    act(() => {
      result.current.addVenue(mockVenue1);
      result.current.addVenue(mockVenue2);
      result.current.clearVenues();
    });

    expect(result.current.count).toBe(0);
    expect(result.current.venues).toEqual([]);
    const saved = JSON.parse(window.localStorage.getItem(COMPARE_STORAGE_KEY) || '[]');
    expect(saved).toEqual([]);
  });

  it('TC-CMP-07: Đọc lại từ LocalStorage khi khởi tạo', () => {
    window.localStorage.setItem(
      COMPARE_STORAGE_KEY,
      JSON.stringify([mockVenue1, mockVenue2]),
    );

    const { result } = renderHook(() => useVenueComparison());

    expect(result.current.count).toBe(2);
    expect(result.current.canCompare).toBe(true);
    expect(result.current.isInComparison('venue-1')).toBe(true);
    expect(result.current.isInComparison('venue-2')).toBe(true);
  });
});
