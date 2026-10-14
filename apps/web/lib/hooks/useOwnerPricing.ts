'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OpeningHour, PricingRule } from '@bsc/shared';
import {
  createPricingRule,
  deletePricingRule,
  getOpeningHours,
  listPricingRules,
  replaceOpeningHours,
} from '@/lib/api/endpoints/owner';
import { ownerQueryKeys } from '@/lib/hooks/useOwnerTimeline';
import { venueKeys } from '@/lib/hooks/useVenue';

export const pricingQueryKeys = {
  all: ['owner', 'pricing'] as const,
  openingHours: (venueId: string) => [...pricingQueryKeys.all, 'opening-hours', venueId] as const,
  rules: (venueId: string) => [...pricingQueryKeys.all, 'rules', venueId] as const,
};

export function useOwnerOpeningHours(venueId?: string) {
  return useQuery({
    queryKey: pricingQueryKeys.openingHours(venueId ?? ''),
    queryFn: () => getOpeningHours(venueId!),
    enabled: Boolean(venueId),
    staleTime: 60 * 1000,
  });
}

export function useUpdateOpeningHours() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      venueId,
      hours,
    }: {
      venueId: string;
      hours: Omit<OpeningHour, 'id' | 'venueId'>[];
    }) => replaceOpeningHours(venueId, hours),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: pricingQueryKeys.openingHours(variables.venueId),
      });
      queryClient.invalidateQueries({ queryKey: ownerQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: venueKeys.all });
    },
  });
}

export function useOwnerPricingRules(venueId?: string) {
  return useQuery({
    queryKey: pricingQueryKeys.rules(venueId ?? ''),
    queryFn: () => listPricingRules(venueId!),
    enabled: Boolean(venueId),
    staleTime: 60 * 1000,
  });
}

export function useCreatePricingRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      venueId,
      input,
    }: {
      venueId: string;
      input: Omit<PricingRule, 'id' | 'venueId'>;
    }) => createPricingRule(venueId, input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: pricingQueryKeys.rules(variables.venueId),
      });
      queryClient.invalidateQueries({ queryKey: ownerQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: venueKeys.all });
    },
  });
}

export function useDeletePricingRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: string) => deletePricingRule(ruleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pricingQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: ownerQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: venueKeys.all });
    },
  });
}
