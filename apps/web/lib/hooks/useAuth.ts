'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

import type { LoginInput, RegisterInput, User, OwnerProfile } from '@bsc/shared';
import { login as apiLogin, logout as apiLogout, me as apiMe, register as apiRegister } from '@/lib/api/endpoints/auth';

export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
};

export function useAuth() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const tAuth = useTranslations('auth');

  const meQuery = useQuery({
    queryKey: authKeys.me(),
    queryFn: async () => {
      try {
        return await apiMe();
      } catch (err: unknown) {
        // 401 Unauthorized là bình thường khi chưa đăng nhập — dọn dẹp cookie phiên rác (nếu có)
        // để middleware không hiểu nhầm là đã đăng nhập và chặn truy cập /login, /register
        if (typeof document !== 'undefined') {
          document.cookie = 'bsc_session=; path=/; max-age=0; samesite=lax';
          document.cookie = 'bsc_role=; path=/; max-age=0; samesite=lax';
        }
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: (input: LoginInput) => apiLogin(input),
    onSuccess: (result) => {
      queryClient.setQueryData(authKeys.me(), { user: result.user, ownerProfile: null });
      queryClient.invalidateQueries();
      toast.success(tAuth('loginSuccess'));
    },
  });

  const registerMutation = useMutation({
    mutationFn: (input: RegisterInput) => apiRegister(input),
    onSuccess: (result) => {
      queryClient.setQueryData(authKeys.me(), { user: result.user, ownerProfile: null });
      queryClient.invalidateQueries();
    },
  });

  const logoutMutation = useMutation({
    mutationFn: apiLogout,
    onSuccess: () => {
      if (typeof document !== 'undefined') {
        document.cookie = 'bsc_session=; path=/; max-age=0; samesite=lax';
        document.cookie = 'bsc_role=; path=/; max-age=0; samesite=lax';
      }
      queryClient.setQueryData(authKeys.me(), null);
      queryClient.invalidateQueries();
      toast.success(tAuth('logoutSuccess'));
      router.push('/login');
    },
  });

  const user: User | null = meQuery.data?.user ?? null;
  const ownerProfile: OwnerProfile | null = meQuery.data?.ownerProfile ?? null;

  return {
    user,
    ownerProfile,
    role: user?.role ?? null,
    isAuthenticated: user !== null,
    isLoading: meQuery.isLoading,
    isPending: meQuery.isPending,
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    register: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    logout: logoutMutation.mutateAsync,
    isLoggingOut: logoutMutation.isPending,
    refetchMe: meQuery.refetch,
  };
}
