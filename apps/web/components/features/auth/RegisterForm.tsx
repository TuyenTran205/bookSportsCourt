'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { registerSchema } from '@bsc/shared';
import type { RegisterInput } from '@bsc/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api/errors';
import { useAuth } from '@/lib/hooks/useAuth';

/**
 * RegisterForm – Màn hình Đăng ký tài khoản khách hàng (CUS-02).
 *
 * Tính năng:
 * - Validate chặt chẽ từ Zod `registerSchema` (@bsc/shared):
 *   + Họ tên ≥ 2 ký tự
 *   + Email đúng định dạng
 *   + SĐT Việt Nam chuẩn (10 chữ số, bắt đầu bằng 0)
 *   + Mật khẩu ≥ 8 ký tự, xác nhận mật khẩu khớp
 * - Hiện/ẩn mật khẩu an toàn.
 * - Tự động đăng nhập và chuyển hướng sau khi tạo tài khoản thành công.
 */
export function RegisterForm() {
  const tAuth = useTranslations('auth');
  const router = useRouter();
  const { register: authRegister, isRegistering } = useAuth();

  const [showPassword, setShowPassword] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: RegisterInput) => {
    setServerError(null);
    try {
      await authRegister(data);
      router.push('/');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError('Không thể tạo tài khoản lúc này. Vui lòng thử lại.');
      }
    }
  };

  return (
    <Card className="w-full max-w-md shadow-card">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold text-neutral-900">{tAuth('registerTitle')}</CardTitle>
        <CardDescription>{tAuth('registerSubtitle')}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {/* Thông báo lỗi từ server */}
        {serverError && (
          <div
            role="alert"
            className="rounded-btn border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger"
          >
            {serverError}
          </div>
        )}

        {/* Form đăng ký chính */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {/* Họ và tên */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reg-fullname">{tAuth('fullName')}</Label>
            <Input
              id="reg-fullname"
              type="text"
              autoComplete="name"
              placeholder="Nguyễn Văn A"
              aria-invalid={!!errors.fullName}
              {...register('fullName')}
            />
            {errors.fullName && (
              <span className="text-xs text-danger" role="alert">
                {errors.fullName.message}
              </span>
            )}
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reg-email">{tAuth('email')}</Label>
            <Input
              id="reg-email"
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

          {/* Số điện thoại */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reg-phone">{tAuth('phone')}</Label>
            <Input
              id="reg-phone"
              type="tel"
              autoComplete="tel"
              placeholder="0912345678"
              aria-invalid={!!errors.phone}
              {...register('phone')}
            />
            {errors.phone && (
              <span className="text-xs text-danger" role="alert">
                {errors.phone.message}
              </span>
            )}
          </div>

          {/* Mật khẩu */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reg-password">{tAuth('password')}</Label>
            <div className="relative">
              <Input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
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

          {/* Nhập lại mật khẩu */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reg-confirm-password">{tAuth('confirmPassword')}</Label>
            <Input
              id="reg-confirm-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              aria-invalid={!!errors.confirmPassword}
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <span className="text-xs text-danger" role="alert">
                {errors.confirmPassword.message}
              </span>
            )}
          </div>

          {/* Nút gửi */}
          <Button type="submit" variant="primary" size="lg" loading={isRegistering} className="mt-2 w-full">
            <UserPlus className="size-4" aria-hidden="true" />
            <span>{tAuth('registerButton')}</span>
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

        {/* Chuyển sang Đăng nhập */}
        <p className="text-center text-xs text-neutral-500">
          {tAuth('hasAccount')}{' '}
          <Link
            href="/login"
            className="font-semibold text-primary-700 transition-colors hover:text-primary-800 hover:underline"
          >
            {tAuth('loginButton')}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
