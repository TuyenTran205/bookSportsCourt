'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createAmenity, createArea, createSport, deleteAmenity, deleteSport } from '@/lib/api/endpoints/admin';
import { listAmenities, listAreas, listProvinces, listSports } from '@/lib/api/endpoints/venues';

export const adminCatalogsQueryKeys = {
  all: ['catalogs'] as const,
  sports: () => [...adminCatalogsQueryKeys.all, 'sports'] as const,
  amenities: () => [...adminCatalogsQueryKeys.all, 'amenities'] as const,
  areas: () => [...adminCatalogsQueryKeys.all, 'areas'] as const,
  provinces: () => [...adminCatalogsQueryKeys.all, 'provinces'] as const,
};

export function useSportsList() {
  return useQuery({
    queryKey: adminCatalogsQueryKeys.sports(),
    queryFn: listSports,
    staleTime: 60 * 1000,
  });
}

export function useAmenitiesList() {
  return useQuery({
    queryKey: adminCatalogsQueryKeys.amenities(),
    queryFn: listAmenities,
    staleTime: 60 * 1000,
  });
}

export function useAreasList() {
  return useQuery({
    queryKey: adminCatalogsQueryKeys.areas(),
    queryFn: () => listAreas(),
    staleTime: 60 * 1000,
  });
}

export function useProvincesList() {
  return useQuery({
    queryKey: adminCatalogsQueryKeys.provinces(),
    queryFn: listProvinces,
    staleTime: 60 * 1000,
  });
}

export function useCreateSport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; icon?: string }) => createSport(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminCatalogsQueryKeys.sports() });
    },
  });
}

export function useDeleteSport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSport(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminCatalogsQueryKeys.sports() });
    },
  });
}

export function useCreateAmenity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; icon?: string; slug?: string }) => createAmenity(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminCatalogsQueryKeys.amenities() });
    },
  });
}

export function useDeleteAmenity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAmenity(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminCatalogsQueryKeys.amenities() });
    },
  });
}

export function useCreateArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; type: 'province' | 'ward' | 'district'; parentId?: string }) =>
      createArea(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminCatalogsQueryKeys.areas() });
      queryClient.invalidateQueries({ queryKey: adminCatalogsQueryKeys.provinces() });
    },
  });
}
