import { BankAccountForm } from '@/components/features/owner/BankAccountForm';

export const metadata = {
  title: 'Cài đặt | Kênh chủ sân | BookSportsCourt',
  description: 'Cấu hình tài khoản ngân hàng nhận tiền cho từng cơ sở thể thao.',
};

export default function OwnerSettingsPage() {
  return (
    <div className="w-full min-w-0 p-4 sm:p-6 lg:p-8">
      <BankAccountForm />
    </div>
  );
}
