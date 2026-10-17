import { PageLoader } from '@/components/ui/page-loader';

/** Bao trọn các màn /owner/* (timeline, bookings, venues, pricing, payments, revenue, reviews, settings). */
export default function OwnerAreaLoading() {
  return <PageLoader label="Đang tải dữ liệu…" />;
}
