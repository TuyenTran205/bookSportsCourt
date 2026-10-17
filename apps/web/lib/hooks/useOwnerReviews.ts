import { useQuery } from '@tanstack/react-query';
import { listOwnerReviews } from '@/lib/api/endpoints/owner';

export interface OwnerReviewFilters {
  page: number;
  limit: number;
  replied?: boolean;
}

export function useOwnerReviews(
  filters: OwnerReviewFilters,
  enabled = true,
) {
  return useQuery({
    queryKey: ['owner', 'reviews', filters],
    queryFn: () => listOwnerReviews(filters),
    enabled,
    staleTime: 60 * 1000,
  });
}