import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { BookingStatus } from '@bsc/shared';
import { listOwnerBookings } from '@/lib/api/endpoints/owner';

export interface UseOwnerBookingsParams {
  page?: number;
  limit?: number;
  status?: BookingStatus;
  q?: string;
  venueId?: string;
  courtId?: string;
  from?: string;
  to?: string;
}

export function useOwnerBookings(params: UseOwnerBookingsParams = {}) {
  return useQuery({
    queryKey: ['owner', 'bookings', params],
    queryFn: () => listOwnerBookings(params),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });
}
