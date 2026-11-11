import type { Metadata } from 'next';

import { BookingDetailScreen } from '@/components/features/booking/BookingDetailScreen';

export const metadata: Metadata = {
  title: 'Chi tiết đơn đặt sân',
  description: 'Thanh toán, theo dõi và quản lý đơn đặt sân của bạn.',
};

export default function BookingDetailPage() {
  return <BookingDetailScreen />;
}
