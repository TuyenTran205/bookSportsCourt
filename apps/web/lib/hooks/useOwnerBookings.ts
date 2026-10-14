'use client';

import { useQuery } from '@tanstack/react-query';
import { listOwnerBookings } from '@/lib/api/endpoints/owner';
import { ownerQueryKeys } from '@/lib/hooks/useOwnerTimeline';
import type { BookingStatus } from '@bsc/shared';

export function useOwnerBookings(
  params: {
    page?: number;
    limit?: number;
    status?: BookingStatus;
    date?: string;
  } = {},
) {
  return useQuery({
    queryKey: [...ownerQueryKeys.all, 'bookings', params],
    queryFn: () => listOwnerBookings(params),
    staleTime: 20 * 1000,
  });
}
