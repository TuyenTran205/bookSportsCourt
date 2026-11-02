'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listAdminReviews,
  setReviewVisibility,
  type AdminReviewRow,
} from '@/lib/api/endpoints/admin';

export interface AdminReviewsFilterParams {
  venueId?: string;
  isVisible?: boolean;
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

export type { AdminReviewRow };
