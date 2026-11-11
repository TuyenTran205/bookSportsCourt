import { useQuery } from '@tanstack/react-query';

import { getOwnerTimeline } from '@/lib/api/endpoints/owner';

export function useOwnerTimeline(venueId?: string, date?: string) {
  const targetDate = date ?? new Date().toISOString().split('T')[0]!;
  return useQuery({
    queryKey: ['owner', 'timeline', venueId, targetDate],
    queryFn: () => getOwnerTimeline(venueId!, targetDate),
    enabled: Boolean(venueId),
    staleTime: 60 * 1000,
  });
}