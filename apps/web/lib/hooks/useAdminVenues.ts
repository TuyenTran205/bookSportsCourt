'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listAdminVenues, reviewVenue } from '@/lib/api/endpoints/admin';
import { adminQueryKeys } from './useAdminDashboard';

export const adminVenuesQueryKeys = {
  all: ['admin', 'venues'] as const,
  list: (params: { status?: string; page?: number; limit?: number }) =>
    [...adminVenuesQueryKeys.all, 'list', params] as const,
};

export function useAdminVenues(params: { status?: string; page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: adminVenuesQueryKeys.list(params),
    queryFn: () => listAdminVenues(params),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useReviewVenue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      reviewNote,
    }: {
      id: string;
      status: 'approved' | 'rejected' | 'suspended';
      reviewNote?: string;
    }) => reviewVenue(id, { status, reviewNote }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminVenuesQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.stats() });
    },
  });
}
