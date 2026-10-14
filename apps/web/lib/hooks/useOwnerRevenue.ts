'use client';

import { useQuery } from '@tanstack/react-query';
import { getRevenue } from '@/lib/api/endpoints/owner';

export function useOwnerRevenue(days = 30) {
  return useQuery({
    queryKey: ['owner', 'revenue', days],
    queryFn: () => getRevenue({ days }),
    staleTime: 60 * 1000,
  });
}
