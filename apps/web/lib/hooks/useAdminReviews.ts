'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReviewReportStatus } from '@bsc/shared';
import {
  listAdminReviews,
  moderateReviewReport,
  setReviewVisibility,
  type AdminReviewRow,
} from '@/lib/api/endpoints/admin';

export interface AdminReviewsFilterParams {
  venueId?: string;
  isVisible?: boolean;
  reportStatus?: ReviewReportStatus;
  rating?: number;
  q?: string;
  page?: number;
  limit?: number;
}

export const adminReviewsQueryKeys = {
  all: ['admin', 'reviews'] as const,
  list: (params: AdminReviewsFilterParams) =>
    [...adminReviewsQueryKeys.all, 'list', params] as const,
};

export function useAdminReviews(params: AdminReviewsFilterParams = {}) {
  return useQuery({
    queryKey: adminReviewsQueryKeys.list(params),
    queryFn: () => listAdminReviews(params),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useSetReviewVisibility() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isVisible }: { id: string; isVisible: boolean }) =>
      setReviewVisibility(id, isVisible),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminReviewsQueryKeys.all });
    },
  });
}

export function useModerateReviewReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) =>
      moderateReviewReport(id, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminReviewsQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: ['owner', 'reviews'] });
    },
  });
}

export type { AdminReviewRow };
