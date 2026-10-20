import { PageSkeleton } from '@/components/ui/page-skeleton';

/** Bao trọn các màn /owner/* (timeline, bookings, venues, pricing, payments, revenue, reviews, settings). */
export default function OwnerAreaLoading() {
  return <PageSkeleton variant="dashboard" />;
}
