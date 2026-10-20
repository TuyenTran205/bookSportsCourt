'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import type { OwnerApplicationInput } from '@bsc/shared';
import {
  getMyOwnerApplication,
  submitOwnerApplication,
} from '@/lib/api/endpoints/owner';

export const ownerApplicationKeys = {
  all: ['owner-application'] as const,
  me: () => [...ownerApplicationKeys.all, 'me'] as const,
};

export function useMyOwnerApplication(enabled: boolean) {
  return useQuery({
    queryKey: ownerApplicationKeys.me(),
    queryFn: getMyOwnerApplication,
    enabled,
    staleTime: 30_000,
  });
}

export function useSubmitOwnerApplication() {
  const queryClient = useQueryClient();
  const t = useTranslations('ownerApplication');

  return useMutation({
    mutationFn: (input: OwnerApplicationInput) => submitOwnerApplication(input),
    onSuccess: (application) => {
      queryClient.setQueryData(ownerApplicationKeys.me(), application);
      toast.success(t('submitSuccess'));
    },
  });
}
