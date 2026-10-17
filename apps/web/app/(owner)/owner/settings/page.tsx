import { BankAccountForm } from '@/components/features/owner/BankAccountForm';

export const metadata = {
  title: 'Cài đặt | Kênh chủ sân | BookSportsCourt',
  description: 'Cấu hình tài khoản ngân hàng nhận tiền cho từng cơ sở thể thao.',
};

export default function OwnerSettingsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl">
      <BankAccountForm />
    </div>
  );
}
