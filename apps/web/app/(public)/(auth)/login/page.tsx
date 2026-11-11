import type { Metadata } from 'next';
import { LoginForm } from '@/components/features/auth/LoginForm';

export const metadata: Metadata = {
  title: 'Đăng nhập',
  description: 'Đăng nhập vào BookSportsCourt để đặt sân thể thao nhanh chóng và tiện lợi.',
};

export default function LoginPage() {
  return (
    <main className="container flex min-h-[calc(100vh-4rem-12rem)] items-center justify-center py-12">
      <LoginForm />
    </main>
  );
}
