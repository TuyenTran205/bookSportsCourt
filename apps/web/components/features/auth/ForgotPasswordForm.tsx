'use client';

import * as React from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, CheckCircle2, Mail, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { forgotPasswordSchema } from '@bsc/shared';
import type { ForgotPasswordInput } from '@bsc/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { forgotPassword } from '@/lib/api/endpoints/auth';

/**
 * ForgotPasswordForm – Màn hình Quên mật khẩu (CUS-16).
 *
 * Quy tắc bảo mật (docs/11-api-contract.md):
 * Luôn phản hồi thành công kể cả khi email không tồn tại trong DB, nhằm chống enumeration attack
 * (dò quét danh sách tài khoản hợp lệ).
 */
export function ForgotPasswordForm() {
  const tAuth = useTranslations('auth');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSent, setIsSent] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    setIsSubmitting(true);
    try {
      await forgotPassword(data);
      setIsSent(true);
    } catch {
      // Dù lỗi mạng hay gì cũng cho hiện đã gửi để không lộ thông tin
      setIsSent(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSent) {
    return (
      <Card className="w-full max-w-md shadow-card">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary-100 text-primary-700">
            <CheckCircle2 className="size-6" />
          </div>
          <CardTitle className="text-xl font-bold text-neutral-900">{tAuth('forgotSent')}</CardTitle>
          <CardDescription>
            Vui lòng kiểm tra hộp thư đến (và hòm thư rác nếu cần) để làm theo hướng dẫn khôi phục mật khẩu.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button variant="outline" size="md" asChild className="w-full">
            <Link href="/login" className="flex items-center justify-center gap-2">
              <ArrowLeft className="size-4" />
              <span>{tAuth('loginTitle')}</span>
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-card">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary-50 text-primary-700">
          <Mail className="size-6" />
        </div>
        <CardTitle className="text-2xl font-bold text-neutral-900">{tAuth('forgotTitle')}</CardTitle>
        <CardDescription>{tAuth('forgotSubtitle')}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="forgot-email">{tAuth('email')}</Label>
            <Input
              id="forgot-email"
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

          <Button type="submit" variant="primary" size="lg" loading={isSubmitting} className="mt-2 w-full">
            <Send className="size-4" aria-hidden="true" />
            <span>{tAuth('forgotButton')}</span>
          </Button>
        </form>

        <p className="text-center text-xs text-neutral-500">
          <Link
            href="/login"
            className="inline-flex items-center gap-1 font-medium text-primary-700 transition-colors hover:text-primary-800 hover:underline"
          >
            <ArrowLeft className="size-3.5" />
            <span>Quay lại đăng nhập</span>
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
