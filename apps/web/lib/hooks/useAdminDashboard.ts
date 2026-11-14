'use client';

import { useQuery } from '@tanstack/react-query';
import { getAdminAnalytics, getAdminStats, getAdminStatsByRange } from '@/lib/api/endpoints/admin';

export interface AdminStatsRangeParams {
  from?: string;
  to?: string;
  groupBy?: 'day' | 'week' | 'month';
}

export const adminQueryKeys = {
  all: ['admin'] as const,
  stats: (params?: AdminStatsRangeParams) => [...adminQueryKeys.all, 'stats', params ?? {}] as const,
  analytics: () => [...adminQueryKeys.all, 'analytics'] as const,
};

export function useAdminStats(params?: AdminStatsRangeParams) {
  return useQuery({
    queryKey: adminQueryKeys.stats(params),
    queryFn: () => (params ? getAdminStatsByRange(params) : getAdminStats()),
    staleTime: 60 * 1000,
  });
}

export function useAdminAnalytics() {
  return useQuery({
    queryKey: adminQueryKeys.analytics(),
    queryFn: getAdminAnalytics,
    staleTime: 60 * 1000,
  });
}
