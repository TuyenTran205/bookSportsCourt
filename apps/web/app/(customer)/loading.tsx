import { PageLoader } from '@/components/ui/page-loader';

/** Fallback tải dùng chung cho khu khách hàng đã đăng nhập. */
export default function CustomerLoading() {
  return <PageLoader label="Đang tải trang…" />;
}
