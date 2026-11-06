'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAppRouter } from '@/lib/navigation/navigate';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, LogIn, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { loginSchema } from '@bsc/shared';
import type { LoginInput } from '@bsc/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api/errors';
import { useAuth } from '@/lib/hooks/useAuth';
import { DEMO_PASSWORD } from '@/mocks/fixtures/users';

const DEMO_ACCOUNTS = [
  { label: 'Khách hàng', email: 'khach@example.com', role: 'customer' },
  { label: 'Chủ sân', email: 'owner@example.com', role: 'owner' },
  { label: 'Quản trị viên', email: 'admin@example.com', role: 'admin' },
];

/**
 * LoginForm – Màn hình Đăng nhập (CUS-01).
 *
 * Tính năng:
 * - Validate phía client bằng Zod `loginSchema` (@bsc/shared).
 * - Bộ chọn tài khoản demo nhanh cho đồ án: bấm 1 click tự điền tài khoản.
 * - Hiện/ẩn mật khẩu an toàn.
 * - Điều hướng thông minh theo tham số `?next=` hoặc theo vai trò sau đăng nhập.
 */
export function LoginForm() {
  const tAuth = useTranslations('auth');
  const tCommon = useTranslations('common');
  const router = useAppRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get('next');

  const { login, isLoggingIn } = useAuth();
  const [showPassword, setShowPassword] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginInput) => {
    setServerError(null);
    try {
      const res = await login(data);
      // Chuyển hướng theo vai trò hoặc query param
      if (nextUrl) {
        router.push(nextUrl);
      } else if (res.user.role === 'admin') {
        router.push('/admin/dashboard');
      } else if (res.user.role === 'owner') {
        router.push('/owner/timeline');
      } else {
        router.push('/');
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError(tAuth('demoHint'));
      }
    }
  };

  const handleFillDemo = (email: string) => {
    setValue('email', email, { shouldValidate: true });
    setValue('password', DEMO_PASSWORD, { shouldValidate: true });
    setServerError(null);
  };

  return (
    <Card className="w-full max-w-md shadow-card">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold text-neutral-900">{tAuth('loginTitle')}</CardTitle>
        <CardDescription>{tAuth('loginSubtitle')}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {/* Bộ chọn tài khoản demo nhanh (Hỗ trợ báo cáo đồ án) */}
        <div className="flex flex-col gap-2 rounded-btn border border-primary-200 bg-primary-50/50 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary-800">
            <Sparkles className="size-3.5" aria-hidden="true" />
            <span>{tAuth('demoAccounts')}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => handleFillDemo(acc.email)}
                className="rounded-btn border border-primary-200 bg-white px-2.5 py-1 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
              >
                {acc.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-primary-600">{tAuth('demoHint')}</p>
        </div>

        {/* Thông báo lỗi từ server */}
        {serverError && (
          <div
            role="alert"
            className="rounded-btn border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger"
          >
            {serverError}
          </div>
        )}

        {/* Form đăng nhập chính */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="login-email">{tAuth('email')}</Label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder={tAuth('emailPlaceholder')}
              aria-invalid={!!errors.email}
              {...register('email')}
            />
            {errors.email && (
              <span className="text-xs text-danger" role="alert">
                {errors.email.message}
              </span>
            )}
          </div>

          {/* Mật khẩu */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="login-password">{tAuth('password')}</Label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-primary-700 transition-colors hover:text-primary-800 hover:underline"
              >
                {tAuth('forgotPassword')}
              </Link>
            </div>
            <div className="relative">
              <Input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className="pr-10"
                aria-invalid={!!errors.password}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {errors.password && (
              <span className="text-xs text-danger" role="alert">
                {errors.password.message}
              </span>
            )}
          </div>

          {/* Ghi nhớ đăng nhập */}
          <div className="flex items-center gap-2">
            <input
              id="login-remember"
              type="checkbox"
              className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-600"
              {...register('rememberMe')}
            />
            <Label htmlFor="login-remember" className="text-xs font-normal text-neutral-600 cursor-pointer">
              {tAuth('rememberMe')}
            </Label>
          </div>

          {/* Nút gửi */}
          <Button type="submit" variant="primary" size="lg" loading={isLoggingIn} className="mt-2 w-full">
            <LogIn className="size-4" aria-hidden="true" />
            <span>{tAuth('loginButton')}</span>
          </Button>
        </form>

        {/* Phân tách */}
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-neutral-200" />
          </div>
          <span className="relative bg-white px-2 text-xs uppercase text-neutral-400">
            {tAuth('orContinueWith')}
          </span>
        </div>

        {/* Đăng nhập bằng Google */}
        <Button
          type="button"
          variant="outline"
          size="md"
          className="w-full"
          onClick={() => {
            // Chuyển hướng sang Google Auth endpoint theo hợp đồng
            window.location.href = '/api/v1/auth/google';
          }}
        >
          <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.02h3.88c2.27-2.09 3.665-5.17 3.665-9.11z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.02c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.12C3.26 21.36 7.33 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.3c-.25-.72-.38-1.49-.38-2.3s.13-1.58.38-2.3V6.58H1.26C.46 8.17 0 9.99 0 12s.46 3.83 1.26 5.42l4.02-3.12z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.26 6.58l4.02 3.12c.95-2.83 3.6-4.95 6.72-4.95z"
            />
          </svg>
          <span>{tAuth('googleLogin')}</span>
        </Button>

        {/* Chuyển sang Đăng ký */}
        <p className="text-center text-xs text-neutral-500">
          {tAuth('noAccount')}{' '}
          <Link
            href="/register"
            className="font-semibold text-primary-700 transition-colors hover:text-primary-800 hover:underline"
          >
            {tAuth('registerButton')}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
