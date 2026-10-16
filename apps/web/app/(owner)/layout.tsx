import * as React from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';

export const metadata = {
  title: 'Kênh chủ sân | BookSportsCourt',
  description: 'Quản lý cơ sở thể thao, lịch đặt sân, duyệt thanh toán và báo cáo doanh thu.',
};

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell area="owner">{children}</DashboardShell>;
}
