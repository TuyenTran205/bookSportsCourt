import type { Metadata } from 'next';
import { Suspense } from 'react';

import { VerifyEmailPanel } from '@/components/features/auth/VerifyEmailPanel';

export const metadata: Metadata = {
  title: 'Xác thực email',
  description: 'Xác thực địa chỉ email tài khoản BookSportsCourt.',
};

export default function VerifyEmailPage() {
  return (
    <main className="container flex min-h-[calc(100vh-4rem-12rem)] items-center justify-center py-12">
      <Suspense fallback={null}>
        <VerifyEmailPanel />
      </Suspense>
    </main>
  );
}
