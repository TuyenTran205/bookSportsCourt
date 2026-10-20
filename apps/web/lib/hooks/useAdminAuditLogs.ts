'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { listAuditLogs } from '@/lib/api/endpoints/admin';

export const adminAuditLogsQueryKeys = {
  all: ['admin', 'audit-logs'] as const,
  list: (params: { page?: number; limit?: number }) =>
    [...adminAuditLogsQueryKeys.all, 'list', params] as const,
};

export function useAdminAuditLogs(params: { page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: adminAuditLogsQueryKeys.list(params),
    queryFn: () => listAuditLogs(params),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });
}
