import { useQuery } from '@tanstack/react-query';

import { getRevenue } from '@/lib/api/endpoints/owner';
import { getVietnamDateRange } from '@/lib/utils/format';

export function useRevenueStats(days = 30) {
  const range = getVietnamDateRange(days);

  return useQuery({
    queryKey: ['owner', 'revenue', range],
    queryFn: () => getRevenue({ ...range, groupBy: 'day' }),
    staleTime: 60 * 1000,
  });
}