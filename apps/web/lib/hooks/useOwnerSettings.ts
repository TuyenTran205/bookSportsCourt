'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BankAccountInfo, CancellationPolicy } from '@bsc/shared';
import {
  getBankAccount,
  updateBankAccount,
  updateCancellationPolicy,
} from '@/lib/api/endpoints/owner';

export const settingsQueryKeys = {
  all: ['owner', 'settings'] as const,
  bankAccount: () => [...settingsQueryKeys.all, 'bank-account'] as const,
};

export function useOwnerBankAccount() {
  return useQuery({
    queryKey: settingsQueryKeys.bankAccount(),
    queryFn: getBankAccount,
    staleTime: 60 * 1000,
  });
}

export function useUpdateBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BankAccountInfo) => updateBankAccount(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsQueryKeys.bankAccount() });
    },
  });
}

export function useUpdateCancellationPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CancellationPolicy) => updateCancellationPolicy(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsQueryKeys.all });
    },
  });
}
