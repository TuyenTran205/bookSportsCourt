import { useQuery } from '@tanstack/react-query';

import { getRevenue } from '@/lib/api/endpoints/owner';
import { getVietnamDateRange } from '@/lib/utils/format';

export interface ReportFilters {
  venueId?: string;
  courtId?: string;
  groupBy?: 'day' | 'week' | 'month';
}

export function useRevenueStats(days = 30, filters: ReportFilters = {}) {
  const range = getVietnamDateRange(days);

  return useQuery({
    queryKey: ['owner', 'revenue', range, filters],
    queryFn: () => getRevenue({
      ...range,
      groupBy: filters.groupBy ?? 'day',
      venueId: filters.venueId,
      courtId: filters.courtId,
    }),
    staleTime: 60 * 1000,
  });
}