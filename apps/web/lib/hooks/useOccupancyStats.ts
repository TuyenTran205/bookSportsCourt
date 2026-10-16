import { useQuery } from '@tanstack/react-query';

import { getOccupancy } from '@/lib/api/endpoints/owner';
import { getVietnamDateRange } from '@/lib/utils/format';

export function useOccupancyStats(days = 30) {
  const range = getVietnamDateRange(days);

  return useQuery({
    queryKey: ['owner', 'occupancy', range],
    queryFn: () => getOccupancy(range),
    staleTime: 60 * 1000,
  });
}