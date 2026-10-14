'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OwnerApplication, OwnerApplicationStatus } from '@bsc/shared';
import {
  listOwnerApplications,
  reviewOwnerApplication,
} from '@/lib/api/endpoints/admin';
import { adminQueryKeys } from './useAdminDashboard';

export const ownerApplicationsQueryKeys = {
  all: ['admin', 'owner-applications'] as const,
  list: (params: { status?: OwnerApplicationStatus; page?: number; limit?: number }) =>
    [...ownerApplicationsQueryKeys.all, 'list', params] as const,
};

export function useOwnerApplications(
  params: { status?: OwnerApplicationStatus; page?: number; limit?: number } = {},
) {
  return useQuery({
    queryKey: ownerApplicationsQueryKeys.list(params),
    queryFn: () => listOwnerApplications(params),
    staleTime: 30 * 1000,
  });
}

export function useReviewOwnerApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      reviewNote,
    }: {
      id: string;
      status: 'approved' | 'rejected';
      reviewNote?: string;
    }) => reviewOwnerApplication(id, { status, reviewNote }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ownerApplicationsQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.stats() });
    },
  });
}
