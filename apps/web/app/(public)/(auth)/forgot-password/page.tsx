import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/features/auth/ForgotPasswordForm';

export const metadata: Metadata = {
  title: 'Quên mật khẩu',
  description: 'Khôi phục mật khẩu tài khoản BookSportsCourt.',
};

export default function ForgotPasswordPage() {
  return (
    <main className="container flex min-h-[calc(100vh-4rem-12rem)] items-center justify-center py-12">
      <ForgotPasswordForm />
    </main>
  );
}
