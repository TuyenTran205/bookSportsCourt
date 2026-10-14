'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BookingStatus } from '@bsc/shared';

import {
  addFavorite,
  cancelBooking,
  createHold,
  createReview,
  getBooking,
  getHold,
  listFavorites,
  listMyBookings,
  removeFavorite,
  uploadPaymentProof,
} from '@/lib/api/endpoints/bookings';
import { venueKeys } from '@/lib/hooks/useVenue';

export const bookingKeys = {
  all: ['bookings'] as const,
  list: (status: BookingStatus | undefined, page: number) =>
    [...bookingKeys.all, 'list', status ?? 'all', page] as const,
  detail: (id: string) => [...bookingKeys.all, 'detail', id] as const,
  hold: (id: string) => [...bookingKeys.all, 'hold', id] as const,
};

export const favoriteKeys = {
  all: ['favorites'] as const,
};

export function useMyBookings(status: BookingStatus | undefined, page: number, limit = 6) {
  return useQuery({
    queryKey: bookingKeys.list(status, page),
    queryFn: () => listMyBookings({ status, page, limit }),
    placeholderData: (previous) => previous,
  });
}

export function useBookingDetail(id: string) {
  return useQuery({
    queryKey: bookingKeys.detail(id),
    queryFn: () => getBooking(id),
  });
}

/** Thông tin hold + tài khoản nhận tiền; làm mới định kỳ để phát hiện hết hạn/được duyệt. */
export function useHoldInfo(id: string, enabled = true) {
  return useQuery({
    queryKey: bookingKeys.hold(id),
    queryFn: () => getHold(id),
    enabled,
    refetchInterval: 10 * 1000,
  });
}

export function useCreateHold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createHold,
    // Slot vừa bị giữ nên lưới ở trang chi tiết sân và dashboard chủ sân phải tải lại.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: venueKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['owner'] });
    },
  });
}

export function useUploadProof(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadPaymentProof(id, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['owner'] });
    },
  });
}

export function useCancelBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => cancelBooking(id, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      void queryClient.invalidateQueries({ queryKey: venueKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['owner'] });
    },
  });
}

export function useCreateReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, rating, comment }: { bookingId: string; rating: number; comment?: string }) =>
      createReview(bookingId, { rating, comment }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      void queryClient.invalidateQueries({ queryKey: venueKeys.all });
    },
  });
}

export function useFavorites(enabled = true) {
  return useQuery({
    queryKey: favoriteKeys.all,
    queryFn: listFavorites,
    enabled,
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ venueId, favorited }: { venueId: string; favorited: boolean }) => {
      if (favorited) await removeFavorite(venueId);
      else await addFavorite(venueId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: favoriteKeys.all }),
  });
}
