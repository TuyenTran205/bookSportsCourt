'use client';

import { useQuery } from '@tanstack/react-query';
import { getAdminAnalytics, getAdminStats } from '@/lib/api/endpoints/admin';

export const adminQueryKeys = {
  all: ['admin'] as const,
  stats: () => [...adminQueryKeys.all, 'stats'] as const,
  analytics: () => [...adminQueryKeys.all, 'analytics'] as const,
};

export function useAdminStats() {
  return useQuery({
    queryKey: adminQueryKeys.stats(),
    queryFn: getAdminStats,
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
