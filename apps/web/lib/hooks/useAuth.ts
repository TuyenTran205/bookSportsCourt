'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

import type { LoginInput, RegisterInput, User } from '@bsc/shared';
import { login as apiLogin, logout as apiLogout, me as apiMe, register as apiRegister } from '@/lib/api/endpoints/auth';
import { useAppRouter } from '@/lib/navigation/navigate';

export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
};

/** Cookie phiên chỉ để `middleware.ts` biết đã đăng nhập; BE vẫn là nơi quyết định quyền. */
const SESSION_COOKIE = 'bsc_session';
const ROLE_COOKIE = 'bsc_role';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60;

/**
 * BE đặt cookie httpOnly `access_token`/`refresh_token` cho miền API, còn
 * `middleware.ts` của Next lại chạy trên miền FE nên không đọc được cookie đó.
 * Vì vậy FE giữ thêm 2 cookie "gợi ý phiên" (không httpOnly, không chứa secret)
 * để chặn điều hướng sớm — quyền thật vẫn do BE kiểm tra ở mỗi request.
 */
function syncSessionCookies(user: User | null) {
  if (typeof document === 'undefined') return;

  if (user) {
    document.cookie = `${SESSION_COOKIE}=${user.id}; path=/; max-age=${SESSION_MAX_AGE}; samesite=lax`;
    document.cookie = `${ROLE_COOKIE}=${user.role}; path=/; max-age=${SESSION_MAX_AGE}; samesite=lax`;
    return;
  }
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`;
  document.cookie = `${ROLE_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

export function useAuth() {
  const queryClient = useQueryClient();
  const router = useAppRouter();
  const tAuth = useTranslations('auth');

  const meQuery = useQuery({
    queryKey: authKeys.me(),
    queryFn: async (): Promise<User | null> => {
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
      queryClient.setQueryData(authKeys.me(), result);
      queryClient.invalidateQueries();
      toast.success(tAuth('loginSuccess'));
    },
  });

  const registerMutation = useMutation({
    mutationFn: (input: RegisterInput) => apiRegister(input),
    onSuccess: (result) => {
      queryClient.setQueryData(authKeys.me(), result);
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

  const user: User | null = meQuery.data ?? null;

  // Giữ cookie gợi ý phiên đồng bộ với trạng thái đăng nhập thật (kể cả khi
  // người dùng F5 — `GET /users/me` thành công sẽ dựng lại cookie cho middleware).
  useEffect(() => {
    if (!meQuery.isSuccess) return;
    syncSessionCookies(user);
  }, [meQuery.isSuccess, user]);

  /**
   * BE hiện chưa trả hồ sơ chủ sân kèm `GET /users/me`; trạng thái chủ sân lấy
   * từ `GET /owner-applications/me`. Giữ trường này để không phá vỡ API hook.
   */
  const ownerProfile = null;

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
