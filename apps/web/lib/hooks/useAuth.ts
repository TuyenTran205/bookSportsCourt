'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

import type { LoginInput, RegisterInput, User, OwnerProfile } from '@bsc/shared';
import { login as apiLogin, logout as apiLogout, me as apiMe, register as apiRegister } from '@/lib/api/endpoints/auth';
import { useAppRouter } from '@/lib/navigation/navigate';

export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
};

/**
 * Đồng bộ cookie gợi ý phiên mà `middleware.ts` dùng để chặn route.
 *
 * Backend thật đặt `access_token`/`refresh_token` httpOnly với path `/api/v1`,
 * nên middleware (chạy trên `/owner/*`, `/admin/*`...) không thấy được. Backend
 * đã ghi thêm `bsc_session`/`bsc_role`; ở đây ghi lại từ hồ sơ user để phòng
 * trường hợp phiên cũ (đăng nhập trước khi backend có cookie này). Cookie không
 * chứa bí mật — quyền thật vẫn do API kiểm tra.
 */
function syncSessionHint(user: Pick<User, 'id' | 'role'> | null) {
  if (typeof document === 'undefined') return;
  if (user) {
    document.cookie = `bsc_session=${encodeURIComponent(user.id)}; path=/; samesite=lax`;
    document.cookie = `bsc_role=${encodeURIComponent(user.role)}; path=/; samesite=lax`;
  } else {
    document.cookie = 'bsc_session=; path=/; max-age=0; samesite=lax';
    document.cookie = 'bsc_role=; path=/; max-age=0; samesite=lax';
  }
}

export function useAuth() {
  const queryClient = useQueryClient();
  const router = useAppRouter();
  const tAuth = useTranslations('auth');

  const meQuery = useQuery({
    queryKey: authKeys.me(),
    queryFn: async () => {
      try {
        const result = await apiMe();
        syncSessionHint(result.user);
        return result;
      } catch (err: unknown) {
        // 401 Unauthorized là bình thường khi chưa đăng nhập — dọn dẹp cookie phiên rác (nếu có)
        // để middleware không hiểu nhầm là đã đăng nhập và chặn truy cập /login, /register
        syncSessionHint(null);
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: (input: LoginInput) => apiLogin(input),
    onSuccess: (result) => {
      // Ghi cookie TRƯỚC khi LoginForm gọi router.push, để middleware cho qua ngay.
      syncSessionHint(result.user);
      // `apiLogin` đã chuẩn hoá cả `{ user }` (mock) lẫn hồ sơ trực tiếp (NestJS).
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
