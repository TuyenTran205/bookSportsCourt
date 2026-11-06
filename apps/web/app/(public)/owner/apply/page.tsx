import type { Metadata } from 'next';

import { OwnerApplicationScreen } from '@/components/features/owner/OwnerApplicationScreen';

export const metadata: Metadata = {
  title: 'Đăng ký làm chủ sân',
  description: 'Gửi hồ sơ đăng ký làm chủ sân trên BookSportsCourt.',
};

export default function OwnerApplicationPage() {
  return <OwnerApplicationScreen />;
}
