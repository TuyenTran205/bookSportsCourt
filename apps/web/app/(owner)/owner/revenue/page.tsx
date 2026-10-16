import { RevenueChart } from '@/components/features/owner/RevenueChart';
import { OccupancyChart } from '@/components/features/owner/OccupancyChart';

export const metadata = {
  title: 'Báo cáo doanh thu | Kênh chủ sân | BookSportsCourt',
  description: 'Thống kê doanh thu, số lượt đặt sân và tỷ lệ lấp đầy theo thời gian.',
};

export default function OwnerRevenuePage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
          Báo cáo doanh thu & hiệu suất
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Theo dõi biểu đồ doanh thu theo ngày và phân tích tỷ lệ lấp đầy sân.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueChart />
        <OccupancyChart />
      </div>
    </div>
  );
}
