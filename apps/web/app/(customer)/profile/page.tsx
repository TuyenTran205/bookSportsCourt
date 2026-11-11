import type { Metadata } from 'next';

import { ProfileScreen } from '@/components/features/auth/ProfileScreen';

export const metadata: Metadata = {
  title: 'Tài khoản của tôi',
  description: 'Quản lý thông tin cá nhân và mật khẩu.',
};

export default function ProfilePage() {
  return <ProfileScreen />;
}
