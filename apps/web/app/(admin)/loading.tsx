import { PageSkeleton } from '@/components/ui/page-skeleton';

/** Khu quản trị: sidebar + topbar do layout giữ, chỉ thay phần nội dung. */
export default function AdminLoading() {
  return <PageSkeleton variant="dashboard" />;
}
