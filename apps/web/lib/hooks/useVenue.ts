'use client';

import { useQuery } from '@tanstack/react-query';

import { listVenueReviews } from '@/lib/api/endpoints/bookings';
import { getVenue, getVenueReviewSummary, getVenueSlots } from '@/lib/api/endpoints/venues';

export const venueKeys = {
  all: ['venues'] as const,
  detail: (slug: string) => [...venueKeys.all, 'detail', slug] as const,
  slots: (slug: string, date: string) => [...venueKeys.all, 'slots', slug, date] as const,
  reviews: (slug: string, page: number) => [...venueKeys.all, 'reviews', slug, page] as const,
  reviewSummary: (slug: string) => [...venueKeys.all, 'review-summary', slug] as const,
};

export function useVenueDetail(slug: string) {
  return useQuery({
    queryKey: venueKeys.detail(slug),
    queryFn: () => getVenue(slug),
    staleTime: 60 * 1000,
  });
}

/** Lưới slot của một ngày; tự làm mới để thấy slot bị người khác giữ/đặt. */
export function useVenueSlots(slug: string, date: string) {
  return useQuery({
    queryKey: venueKeys.slots(slug, date),
    queryFn: () => getVenueSlots(slug, date),
    refetchInterval: 15 * 1000,
    staleTime: 5 * 1000,
  });
}

export function useVenueReviews(slug: string, page: number, limit = 5) {
  return useQuery({
    queryKey: venueKeys.reviews(slug, page),
    queryFn: () => listVenueReviews(slug, { page, limit }),
    placeholderData: (previous) => previous,
  });
}

export function useReviewSummary(slug: string) {
  return useQuery({
    queryKey: venueKeys.reviewSummary(slug),
    queryFn: () => getVenueReviewSummary(slug),
    staleTime: 60 * 1000,
  });
}
