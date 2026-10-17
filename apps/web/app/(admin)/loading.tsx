import { PageLoader } from '@/components/ui/page-loader';

/** Khu quản trị: sidebar + topbar do layout giữ, chỉ thay phần nội dung. */
export default function AdminLoading() {
  return <PageLoader label="Đang tải trang…" />;
}
