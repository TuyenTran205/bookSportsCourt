import { PageLoader } from '@/components/ui/page-loader';

/** Chi tiết đơn đặt – /bookings/[id]. */
export default function BookingDetailLoading() {
  return <PageLoader label="Đang tải chi tiết đơn đặt…" />;
}
