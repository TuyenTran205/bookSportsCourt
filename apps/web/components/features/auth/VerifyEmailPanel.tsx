'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Loader2, MailCheck, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { verifyEmail } from '@/lib/api/endpoints/auth';

/**
 * VerifyEmailPanel – Xác thực email từ link `?token=` (CUS-01).
 * Tự gọi API một lần khi mở trang. Không token: chỉ hiện hướng dẫn "kiểm tra hộp thư".
 */
export function VerifyEmailPanel() {
  const t = useTranslations('auth');
  const token = useSearchParams().get('token');

  const mutation = useMutation({ mutationFn: (value: string) => verifyEmail(value) });
  const { mutate } = mutation;

  // Gọi đúng một lần; React StrictMode chạy effect hai lần ở dev nên cần cờ chặn.
  const fired = React.useRef(false);
  React.useEffect(() => {
    if (!token || fired.current) return;
    fired.current = true;
    mutate(token);
  }, [token, mutate]);

  let icon: React.ReactNode;
  let title: string;
  let desc: string;
  let tone = 'bg-primary-50 text-primary-700';

  if (!token) {
    icon = <MailCheck className="size-6" aria-hidden="true" />;
    title = t('verifyTitle');
    desc = t('verifySubtitle');
  } else if (mutation.isError) {
    icon = <XCircle className="size-6" aria-hidden="true" />;
    title = t('verifyFailedTitle');
    desc = t('verifyFailedDesc');
    tone = 'bg-danger/10 text-danger';
  } else if (mutation.isSuccess) {
    icon = <CheckCircle2 className="size-6" aria-hidden="true" />;
    title = t('verifyDoneTitle');
    desc = t('verifyDoneDesc');
  } else {
    icon = <Loader2 className="size-6 animate-spin" aria-hidden="true" />;
    title = t('verifying');
    desc = t('verifyingDesc');
  }

  return (
    <Card className="w-full max-w-md shadow-card">
      <CardHeader className="text-center">
        <div className={`mx-auto mb-2 flex size-12 items-center justify-center rounded-full ${tone}`}>
          {icon}
        </div>
        <CardTitle className="text-xl font-bold text-neutral-900" role="status" aria-live="polite">
          {title}
        </CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {mutation.isSuccess && (
          <Button asChild variant="primary" className="w-full">
            <Link href="/login">{t('loginButton')}</Link>
          </Button>
        )}
        {mutation.isError && token && (
          <Button variant="outline" className="w-full" onClick={() => mutate(token)}>
            {t('retry')}
          </Button>
        )}
        {!mutation.isSuccess && (
          <Button asChild variant="ghost" className="w-full">
            <Link href="/">{t('backToHome')}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
