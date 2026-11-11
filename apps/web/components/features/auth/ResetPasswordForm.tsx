'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAppRouter } from '@/lib/navigation/navigate';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { resetPasswordSchema } from '@bsc/shared';
import type { ResetPasswordInput } from '@bsc/shared';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { resetPassword } from '@/lib/api/endpoints/auth';
import { ApiError } from '@/lib/api/errors';

/**
 * ResetPasswordForm – Đặt lại mật khẩu từ link email (CUS-16).
 * Token lấy từ `?token=`; thiếu token thì báo link không hợp lệ thay vì hiện form vô dụng.
 * Token hết hạn sau 15 phút và dùng một lần (docs/02-features-by-role.md).
 */
export function ResetPasswordForm() {
  const t = useTranslations('auth');
  const router = useAppRouter();
  const token = useSearchParams().get('token') ?? '';

  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: '', confirmPassword: '' },
  });

  React.useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => router.push('/login'), 2500);
    return () => window.clearTimeout(timer);
  }, [done, router]);

  const onSubmit = async (data: ResetPasswordInput) => {
    setSubmitError(null);
    try {
      await resetPassword({ ...data, token });
      setDone(true);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : t('resetFailed'));
    }
  };

  if (!token) {
    return (
      <Card className="w-full max-w-md shadow-card">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-warning/10 text-warning">
            <AlertTriangle className="size-6" aria-hidden="true" />
          </div>
          <CardTitle className="text-xl font-bold text-neutral-900">{t('resetInvalidTitle')}</CardTitle>
          <CardDescription>{t('resetInvalidDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="primary" className="w-full">
            <Link href="/forgot-password">{t('forgotButton')}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (done) {
    return (
      <Card className="w-full max-w-md shadow-card">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary-100 text-primary-700">
            <CheckCircle2 className="size-6" aria-hidden="true" />
          </div>
          <CardTitle className="text-xl font-bold text-neutral-900">{t('resetDoneTitle')}</CardTitle>
          <CardDescription>{t('resetDoneDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">{t('loginButton')}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-card">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary-50 text-primary-700">
          <KeyRound className="size-6" aria-hidden="true" />
        </div>
        <CardTitle className="text-2xl font-bold text-neutral-900">{t('resetTitle')}</CardTitle>
        <CardDescription>{t('resetSubtitle')}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {submitError && (
          <p
            role="alert"
            className="rounded-btn border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger"
          >
            {submitError}
          </p>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <FormField
            label={t('newPassword')}
            htmlFor="reset-password"
            required
            hint={t('passwordHint')}
            error={errors.password?.message}
          >
            <Input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              {...register('password')}
            />
          </FormField>

          <FormField
            label={t('confirmPassword')}
            htmlFor="reset-confirm"
            required
            error={errors.confirmPassword?.message}
          >
            <Input
              id="reset-confirm"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.confirmPassword}
              {...register('confirmPassword')}
            />
          </FormField>

          <Button type="submit" variant="primary" size="lg" loading={isSubmitting} className="mt-2 w-full">
            {t('resetButton')}
          </Button>
        </form>

        <p className="text-center text-xs text-neutral-500">
          <Link
            href="/login"
            className="inline-flex items-center gap-1 font-medium text-primary-700 hover:underline"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            <span>{t('backToLogin')}</span>
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
