'use client';

import * as React from 'react';
import { toast } from 'sonner';

import type { VenueDetail, VenueListItem } from '@bsc/shared';

export const COMPARE_STORAGE_KEY = 'bsc_compare_venues_v1';
export const MAX_COMPARE_VENUES = 3;
export const COMPARE_UPDATED_EVENT = 'bsc:compare-updated';

export interface CompareVenueItem {
  id: string;
  name: string;
  slug: string;
  address: string;
  provinceName?: string;
  districtName?: string;
  lat: number | null;
  lng: number | null;
  coverUrl: string | null;
  ratingAvg: number;
  reviewCount: number;
  fromPrice: number | null;
  sports: Array<{ id: string; name: string; slug: string }>;
}

function readStorage(): CompareVenueItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(COMPARE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStorage(items: CompareVenueItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent(COMPARE_UPDATED_EVENT));
  } catch {
    // Ignore localStorage write error
  }
}

export function toCompareVenueItem(venue: VenueListItem | VenueDetail): CompareVenueItem {
  return {
    id: venue.id,
    name: venue.name,
    slug: venue.slug,
    address: venue.address,
    provinceName: venue.province?.name,
    districtName: venue.district?.name,
    lat: venue.lat,
    lng: venue.lng,
    coverUrl: venue.coverUrl,
    ratingAvg: venue.ratingAvg,
    reviewCount: venue.reviewCount,
    fromPrice: venue.fromPrice,
    sports: (venue.sports || []).map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
    })),
  };
}

export function useVenueComparison() {
  const [venues, setVenues] = React.useState<CompareVenueItem[]>(() => readStorage());

  // Đồng bộ hoá với Storage và sự kiện giữa các tab / components
  React.useEffect(() => {
    // Khởi tạo đọc từ Storage khi mount ở client
    setVenues(readStorage());

    const handleSync = () => {
      setVenues(readStorage());
    };

    window.addEventListener(COMPARE_UPDATED_EVENT, handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener(COMPARE_UPDATED_EVENT, handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const isInComparison = React.useCallback(
    (venueId: string) => venues.some((v) => v.id === venueId),
    [venues],
  );

  const addVenue = React.useCallback(
    (venue: VenueListItem | VenueDetail | CompareVenueItem): boolean => {
      const current = readStorage();
      if (current.some((v) => v.id === venue.id)) {
        return true;
      }

      if (current.length >= MAX_COMPARE_VENUES) {
        toast.warning(
          'Bạn chỉ có thể so sánh tối đa 3 cơ sở cùng lúc. Vui lòng bỏ bớt cơ sở trước khi thêm mới.',
        );
        return false;
      }

      const item: CompareVenueItem =
        'coverUrl' in venue && 'sports' in venue && Array.isArray(venue.sports)
          ? toCompareVenueItem(venue as VenueListItem | VenueDetail)
          : (venue as CompareVenueItem);

      const next = [...current, item];
      writeStorage(next);
      setVenues(next);
      toast.success(`Đã thêm "${item.name}" vào danh sách so sánh`);
      return true;
    },
    [],
  );

  const removeVenue = React.useCallback((venueId: string) => {
    const current = readStorage();
    const target = current.find((v) => v.id === venueId);
    const next = current.filter((v) => v.id !== venueId);
    writeStorage(next);
    setVenues(next);
    if (target) {
      toast.info(`Đã xóa "${target.name}" khỏi danh sách so sánh`);
    }
  }, []);

  const clearVenues = React.useCallback(() => {
    writeStorage([]);
    setVenues([]);
  }, []);

  const count = venues.length;
  const canCompare = count >= 2;

  return {
    venues,
    count,
    canCompare,
    isInComparison,
    addVenue,
    removeVenue,
    clearVenues,
  };
}
