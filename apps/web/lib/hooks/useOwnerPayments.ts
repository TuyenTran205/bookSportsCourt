import { useQuery } from '@tanstack/react-query';

import { listOwnerPayments } from '@/lib/api/endpoints/owner';

export function useOwnerPayments() {
  return useQuery({
    queryKey: ['owner', 'payments'],
    queryFn: () => listOwnerPayments({ status: 'submitted' }),
    staleTime: 60 * 1000,
  });
}