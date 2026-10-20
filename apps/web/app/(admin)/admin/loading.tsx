import { PageSkeleton } from '@/components/ui/page-skeleton';

/** Bao trọn 8 màn /admin/* (dashboard, venues, owner-applications, users, bookings, catalogs, analytics, audit-logs). */
export default function AdminAreaLoading() {
  return <PageSkeleton variant="dashboard" />;
}
