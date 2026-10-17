'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { PageLoader } from '@/components/ui/page-loader';
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
    <main className="container py-16">
      <PageLoader label="Đang xác thực tài khoản Google…" description="Vui lòng chờ trong giây lát." />
    </main>
  );
}
