import { OwnerTimeline } from '@/components/features/owner/OwnerTimeline';

export const metadata = {
  title: 'Lịch sân | Kênh chủ sân | BookSportsCourt',
  description: 'Xem timeline lịch đặt sân và tạo đặt sân tại quầy.',
};

export default function OwnerTimelinePage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl">
      <OwnerTimeline />
    </div>
  );
}
