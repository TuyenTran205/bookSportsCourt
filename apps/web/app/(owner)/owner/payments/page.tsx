import { PaymentsManagement } from '@/components/features/owner/PaymentsManagement';

export const metadata = {
  title: 'Duyệt thanh toán | Kênh chủ sân | BookSportsCourt',
  description: 'Đối soát biên lai chuyển khoản đặt cọc và xác nhận đơn đặt sân.',
};

export default function OwnerPaymentsPage() {
  return (
    <div className="w-full min-w-0 p-4 sm:p-6 lg:p-8">
      <PaymentsManagement />
    </div>
  );
}
