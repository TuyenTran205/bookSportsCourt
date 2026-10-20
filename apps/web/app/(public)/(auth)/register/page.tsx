import type { Metadata } from 'next';
import { RegisterForm } from '@/components/features/auth/RegisterForm';

export const metadata: Metadata = {
  title: 'Đăng ký tài khoản',
  description: 'Tạo tài khoản BookSportsCourt miễn phí để đặt sân thể thao và nhận thông báo theo thời gian thực.',
};

export default function RegisterPage() {
  return (
    <main className="container flex min-h-[calc(100vh-4rem-12rem)] items-center justify-center py-12">
      <RegisterForm />
    </main>
  );
}
