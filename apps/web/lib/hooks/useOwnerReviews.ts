'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginationMeta, Review } from '@bsc/shared';
import { listOwnerReviews, replyToReview } from '@/lib/api/endpoints/owner';
import { ownerQueryKeys } from '@/lib/hooks/useOwnerTimeline';

export interface OwnerReviewItem extends Review {
  venueName?: string;
  customerName?: string;
}

export const reviewsQueryKeys = {
  all: ['owner', 'reviews'] as const,
  list: (params: { page?: number; limit?: number; replied?: boolean }) =>
    [...reviewsQueryKeys.all, 'list', params] as const,
};

export function useOwnerReviews(params: { page?: number; limit?: number; replied?: boolean } = {}) {
  return useQuery({
    queryKey: reviewsQueryKeys.list(params),
    queryFn: () =>
      listOwnerReviews(params) as unknown as Promise<{ data: OwnerReviewItem[]; meta?: PaginationMeta }>,
    staleTime: 30 * 1000,
  });
}

export function useReplyReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reply }: { id: string; reply: string }) => replyToReview(id, reply),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewsQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: ownerQueryKeys.all });
    },
  });
}
