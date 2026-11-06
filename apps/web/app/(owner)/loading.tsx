import { PageSkeleton } from '@/components/ui/page-skeleton';

/** Khu chủ sân: DashboardShell (sidebar + topbar) do layout giữ, chỉ thay phần nội dung. */
export default function OwnerLoading() {
  return <PageSkeleton variant="dashboard" />;
}
