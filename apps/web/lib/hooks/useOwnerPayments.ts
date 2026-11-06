import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { listOwnerPayments } from '@/lib/api/endpoints/owner';

export function useOwnerPayments(
  status?: string,
  page = 1,
  limit = 20,
  enabled = true,
) {
  return useQuery({
    queryKey: ['owner', 'payments', { status, page, limit }],
    queryFn: () => listOwnerPayments({ status, page, limit }),
    enabled,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });
}