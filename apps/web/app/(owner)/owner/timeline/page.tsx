import type { Metadata } from 'next';
import { OwnerTimelineScreen } from '@/components/features/owner/OwnerTimelineScreen';

export const metadata: Metadata = {
  title: 'Lịch sân theo ngày',
  description: 'Quản lý lịch đặt sân, khung giờ và khoá sân theo thời gian thực.',
};

/**
 * Trang Lịch sân theo ngày dành cho chủ sân (OWN-06).
 * Bọc OwnerTimelineScreen trong container chuẩn để dùng thử trực tiếp trên trình duyệt.
 */
export default function OwnerTimelinePage() {
  return (
    <main className="container py-6">
      <OwnerTimelineScreen />
    </main>
  );
}
