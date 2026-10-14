'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UserRole, UserStatus } from '@bsc/shared';
import { listAdminUsers, setUserRole, setUserStatus } from '@/lib/api/endpoints/admin';
import { adminQueryKeys } from './useAdminDashboard';

export const adminUsersQueryKeys = {
  all: ['admin', 'users'] as const,
  list: (params: { role?: UserRole; status?: UserStatus; q?: string; page?: number; limit?: number }) =>
    [...adminUsersQueryKeys.all, 'list', params] as const,
};

export function useAdminUsers(
  params: { role?: UserRole; status?: UserStatus; q?: string; page?: number; limit?: number } = {},
) {
  return useQuery({
    queryKey: adminUsersQueryKeys.list(params),
    queryFn: () => listAdminUsers(params),
    staleTime: 30 * 1000,
  });
}

export function useSetUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) =>
      setUserStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminUsersQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.stats() });
    },
  });
}

export function useSetUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) =>
      setUserRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminUsersQueryKeys.all });
    },
  });
}
