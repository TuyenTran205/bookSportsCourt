import type { Metadata } from 'next';

import { CheckoutScreen } from '@/components/features/checkout/CheckoutScreen';

export const metadata: Metadata = {
  title: 'Thanh toán giữ chỗ | BookSportsCourt',
  description: 'Hoàn tất chuyển khoản tiền cọc để xác nhận đặt sân thể thao trong thời gian giữ chỗ.',
};

export default function CheckoutPage() {
  return <CheckoutScreen />;
}
