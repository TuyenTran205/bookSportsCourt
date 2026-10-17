import { PageLoader } from '@/components/ui/page-loader';

/** Khu chủ sân: DashboardShell (sidebar + topbar) do layout giữ, chỉ thay phần nội dung. */
export default function OwnerLoading() {
  return <PageLoader label="Đang tải trang…" />;
}
