'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { useAuth } from '@/lib/hooks/useAuth';

/**
 * Trang nhận callback Google OAuth (docs/09).
 * Nằm ngoài mọi route group để middleware không chặn khi chưa có session cookie.
 */
export default function GoogleAuthCallbackPage() {
  const router = useRouter();
  const { refetchMe } = useAuth();

  React.useEffect(() => {
    // Làm mới trạng thái auth và chuyển hướng về trang chủ
    void (async () => {
      await refetchMe();
      router.replace('/');
    })();
  }, [refetchMe, router]);

  return (
    <main className="container flex min-h-[calc(100vh-4rem-12rem)] flex-col items-center justify-center py-16 text-center">
      <Loader2 className="size-8 animate-spin text-primary-700" aria-hidden="true" />
      <p className="mt-4 text-sm text-neutral-600">Đang xác thực tài khoản Google…</p>
    </main>
  );
}
