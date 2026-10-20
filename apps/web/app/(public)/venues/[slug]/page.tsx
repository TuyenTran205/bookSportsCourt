import type { Metadata } from 'next';

import { VenueDetailScreen } from '@/components/features/venue/VenueDetailScreen';

// Dữ liệu sân đến từ mock ở trình duyệt nên server không lấy được tên sân;
// dùng metadata chung để tab trình duyệt vẫn có tiêu đề hợp lệ.
export const metadata: Metadata = {
  title: 'Chi tiết sân',
  description: 'Xem thông tin, lịch trống và đánh giá của cơ sở thể thao.',
};

export default function VenueDetailPage() {
  return <VenueDetailScreen />;
}
