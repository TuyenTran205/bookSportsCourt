'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BookingStatus } from '@bsc/shared';
import { forceCancelBooking, listAdminBookings } from '@/lib/api/endpoints/admin';
import { adminQueryKeys } from './useAdminDashboard';

export const adminBookingsQueryKeys = {
  all: ['admin', 'bookings'] as const,
  list: (params: { status?: BookingStatus; q?: string; page?: number; limit?: number }) =>
    [...adminBookingsQueryKeys.all, 'list', params] as const,
};

export function useAdminBookings(
  params: { status?: BookingStatus; q?: string; page?: number; limit?: number } = {},
) {
  return useQuery({
    queryKey: adminBookingsQueryKeys.list(params),
    queryFn: () => listAdminBookings(params),
    staleTime: 30 * 1000,
  });
}

export function useForceCancelBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      forceCancelBooking(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminBookingsQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.stats() });
    },
  });
}
