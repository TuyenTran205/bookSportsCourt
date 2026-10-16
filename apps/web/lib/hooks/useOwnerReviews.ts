import { useQuery } from '@tanstack/react-query';
import { listOwnerReviews } from '@/lib/api/endpoints/owner';

export function useOwnerReviews(enabled = true) {
  return useQuery({
    queryKey: ['owner', 'reviews'],
    queryFn: () => listOwnerReviews(),
    enabled,
    staleTime: 60 * 1000,
  });
}