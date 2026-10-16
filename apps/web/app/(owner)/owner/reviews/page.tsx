import { ReviewsManagement } from '@/components/features/owner/ReviewsManagement';

export const metadata = {
  title: 'Đánh giá từ khách | Kênh chủ sân | BookSportsCourt',
  description: 'Xem cảm nhận của khách hàng và gửi phản hồi từ ban quản lý sân.',
};

export default function OwnerReviewsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl">
      <ReviewsManagement />
    </div>
  );
}
