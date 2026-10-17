import { PaymentsManagement } from '@/components/features/owner/PaymentsManagement';

export const metadata = {
  title: 'Duyệt thanh toán | Kênh chủ sân | BookSportsCourt',
  description: 'Đối soát biên lai chuyển khoản đặt cọc và xác nhận đơn đặt sân.',
};

export default function OwnerPaymentsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl">
      <PaymentsManagement />
    </div>
  );
}
