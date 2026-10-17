import { PageLoader } from '@/components/ui/page-loader';

/** Bao trọn 8 màn /admin/* (dashboard, venues, owner-applications, users, bookings, catalogs, analytics, audit-logs). */
export default function AdminAreaLoading() {
  return <PageLoader label="Đang tải dữ liệu quản trị…" />;
}
