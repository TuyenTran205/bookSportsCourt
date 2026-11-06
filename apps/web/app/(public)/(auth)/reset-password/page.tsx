import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ResetPasswordForm } from '@/components/features/auth/ResetPasswordForm';

export const metadata: Metadata = {
  title: 'Đặt lại mật khẩu',
  description: 'Tạo mật khẩu mới cho tài khoản BookSportsCourt.',
};

export default function ResetPasswordPage() {
  return (
    <main className="container flex min-h-[calc(100vh-4rem-12rem)] items-center justify-center py-12">
      {/* useSearchParams cần Suspense để trang vẫn render tĩnh được */}
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
