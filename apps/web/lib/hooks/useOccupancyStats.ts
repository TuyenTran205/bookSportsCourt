import { useQuery } from '@tanstack/react-query';

import { getOccupancy } from '@/lib/api/endpoints/owner';
import { getVietnamDateRange } from '@/lib/utils/format';
import type { ReportFilters } from './useRevenueStats';

export function useOccupancyStats(
  days = 30,
  filters: Pick<ReportFilters, 'venueId' | 'courtId'> = {},
) {
  const range = getVietnamDateRange(days);

  return useQuery({
    queryKey: ['owner', 'occupancy', range, filters],
    queryFn: () => getOccupancy({
      ...range,
      venueId: filters.venueId,
      courtId: filters.courtId,
    }),
    staleTime: 60 * 1000,
  });
}