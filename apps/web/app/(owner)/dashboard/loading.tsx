import { PageLoader } from '@/components/ui/page-loader';

export default function OwnerDashboardLoading() {
  return (
    <PageLoader
      label="Đang tải tổng quan vận hành…"
      description="Đang tổng hợp đơn đặt và doanh thu hôm nay."
    />
  );
}
