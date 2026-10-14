'use client';

import { useQuery } from '@tanstack/react-query';
import { listOwnerPayments } from '@/lib/api/endpoints/owner';
import { ownerQueryKeys } from '@/lib/hooks/useOwnerTimeline';

export function useOwnerPayments(params: { page?: number; limit?: number; status?: string } = {}) {
  return useQuery({
    queryKey: [...ownerQueryKeys.all, 'payments', params],
    queryFn: () => listOwnerPayments(params),
    staleTime: 15 * 1000,
  });
}
