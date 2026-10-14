import type { Metadata } from 'next';

import { BookingsScreen } from '@/components/features/booking/BookingsScreen';

export const metadata: Metadata = {
  title: 'Lịch đặt sân của tôi',
  description: 'Quản lý danh sách các lượt đặt sân thể thao của bạn.',
};

export default function BookingsPage() {
  return <BookingsScreen />;
}
