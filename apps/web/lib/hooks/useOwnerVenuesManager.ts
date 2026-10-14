'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createCourt,
  createOwnerVenue,
  deleteCourt,
  listOwnerVenues,
  updateOwnerVenue,
} from '@/lib/api/endpoints/owner';
import { listDistricts, listProvinces, listSports } from '@/lib/api/endpoints/venues';
import { ownerQueryKeys } from '@/lib/hooks/useOwnerTimeline';

export function useOwnerVenuesList() {
  return useQuery({
    queryKey: ownerQueryKeys.venues(),
    queryFn: listOwnerVenues,
    staleTime: 60 * 1000,
  });
}

export function useProvinces() {
  return useQuery({
    queryKey: ['catalogs', 'provinces'],
    queryFn: listProvinces,
    staleTime: 10 * 60 * 1000,
  });
}

export function useDistricts(provinceId?: string) {
  return useQuery({
    queryKey: ['catalogs', 'districts', provinceId],
    queryFn: () => listDistricts(provinceId!),
    enabled: Boolean(provinceId),
    staleTime: 10 * 60 * 1000,
  });
}

export function useSports() {
  return useQuery({
    queryKey: ['catalogs', 'sports'],
    queryFn: listSports,
    staleTime: 10 * 60 * 1000,
  });
}

export function useCreateVenue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createOwnerVenue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ownerQueryKeys.all });
    },
  });
}

export function useUpdateVenue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateOwnerVenue>[1] }) =>
      updateOwnerVenue(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ownerQueryKeys.all });
    },
  });
}

export function useCreateCourt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ venueId, input }: { venueId: string; input: Parameters<typeof createCourt>[1] }) =>
      createCourt(venueId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ownerQueryKeys.all });
    },
  });
}

export function useDeleteCourt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (courtId: string) => deleteCourt(courtId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ownerQueryKeys.all });
    },
  });
}
