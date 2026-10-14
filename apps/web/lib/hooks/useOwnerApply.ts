'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import type { OwnerApplication } from '@bsc/shared';
import {
  getMyOwnerApplication,
  type OwnerApplicationInput,
  submitOwnerApplication,
} from '@/lib/api/endpoints/owner';
import { ApiError } from '@/lib/api/errors';

export const ownerApplyKeys = {
  all: ['owner-application'] as const,
  me: () => [...ownerApplyKeys.all, 'me'] as const,
};

export function useMyOwnerApplication() {
  return useQuery<OwnerApplication | null>({
    queryKey: ownerApplyKeys.me(),
    queryFn: getMyOwnerApplication,
    staleTime: 60 * 1000,
  });
}

export function useSubmitOwnerApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: OwnerApplicationInput) => submitOwnerApplication(input),
    onSuccess: (newApp) => {
      queryClient.setQueryData(ownerApplyKeys.me(), newApp);
      void queryClient.invalidateQueries({ queryKey: ownerApplyKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'owner-applications'] });
      toast.success('Hồ sơ đăng ký chủ sân đã được gửi thành công! Quản trị viên sẽ xét duyệt trong vòng 24-48 giờ.');
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Có lỗi xảy ra khi nộp hồ sơ.');
    },
  });
}
