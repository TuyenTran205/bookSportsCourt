'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import * as Recharts from 'recharts';

import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminAnalytics } from '@/lib/hooks/useAdminDashboard';
import { formatCurrency } from '@/lib/utils/format';

const ResponsiveContainer = Recharts.ResponsiveContainer as unknown as React.ComponentType<Record<string, unknown>>;
const PieChart = Recharts.PieChart as unknown as React.ComponentType<Record<string, unknown>>;
const Pie = Recharts.Pie as unknown as React.ComponentType<Record<string, unknown>>;
const BarChart = Recharts.BarChart as unknown as React.ComponentType<Record<string, unknown>>;
const Bar = Recharts.Bar as unknown as React.ComponentType<Record<string, unknown>>;
const Cell = Recharts.Cell as unknown as React.ComponentType<Record<string, unknown>>;
const CartesianGrid = Recharts.CartesianGrid as unknown as React.ComponentType<Record<string, unknown>>;
const Tooltip = Recharts.Tooltip as unknown as React.ComponentType<Record<string, unknown>>;
const Legend = Recharts.Legend as unknown as React.ComponentType<Record<string, unknown>>;
const XAxis = Recharts.XAxis as unknown as React.ComponentType<Record<string, unknown>>;
const YAxis = Recharts.YAxis as unknown as React.ComponentType<Record<string, unknown>>;

const SPORT_COLORS = ['#16a34a', '#2563eb', '#f59e0b', '#ec4899', '#8b5cf6'];

const STATUS_LABELS: Record<string, string> = {
  held: 'Đang giữ chỗ',
  pending_payment: 'Chờ duyệt tiền',
  confirmed: 'Đã xác nhận',
  completed: 'Hoàn thành',
  cancelled: 'Đã huỷ',
  expired: 'Hết hạn giữ chỗ',
  no_show: 'Khách vắng mặt',
};

export function AdminAnalyticsScreen() {
  const t = useTranslations('admin');
  const analyticsQuery = useAdminAnalytics();
  const data = analyticsQuery.data;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t('analytics')}
        description="Thống kê cơ cấu môn thể thao, trạng thái đơn và hiệu suất kinh doanh của từng cơ sở."
      />

      {analyticsQuery.isPending ? (
        <div className="mt-6 flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Skeleton className="h-80 w-full rounded-card" />
            <Skeleton className="h-80 w-full rounded-card" />
          </div>
          <Skeleton className="h-96 w-full rounded-card" />
        </div>
      ) : analyticsQuery.isError ? (
        <div className="mt-6">
          <ErrorState
            error={analyticsQuery.error}
            onRetry={() => void analyticsQuery.refetch()}
          />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          {/* 2 Biểu đồ */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Biểu đồ tròn: Cơ cấu theo môn thể thao */}
            <Card className="p-5">
              <h3 className="mb-1 text-base font-semibold text-neutral-900">
                Tỷ lệ lượt đặt theo môn thể thao
              </h3>
              <p className="mb-4 text-xs text-neutral-500">
                Phân bổ nhu cầu chơi thể thao của khách hàng
              </p>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data?.bySport ?? []}
                      dataKey="bookings"
                      nameKey="sport"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }: { name?: string; percent?: number }) =>
                        `${name ?? ''}: ${((percent ?? 0) * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      {data?.bySport.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={SPORT_COLORS[index % SPORT_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: number) => [`${val} lượt`, 'Số lượt đặt']}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Biểu đồ cột: Phân bổ trạng thái đơn */}
            <Card className="p-5">
              <h3 className="mb-1 text-base font-semibold text-neutral-900">
                Phân bổ trạng thái đơn đặt sân
              </h3>
              <p className="mb-4 text-xs text-neutral-500">
                Tỷ lệ hoàn thành, huỷ đơn và chờ duyệt thanh toán
              </p>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={
                      data?.byStatus.map((s) => ({
                        ...s,
                        name: STATUS_LABELS[s.status] ?? s.status,
                      })) ?? []
                    }
                    margin={{ top: 10, right: 10, left: 0, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      angle={-20}
                      textAnchor="end"
                    />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      formatter={(val: number) => [`${val} đơn`, 'Số lượng']}
                    />
                    <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Bảng xếp hạng doanh thu theo cơ sở */}
          <Card className="p-5">
            <h3 className="mb-1 text-base font-semibold text-neutral-900">
              Bảng xếp hạng hiệu suất cơ sở thể thao
            </h3>
            <p className="mb-4 text-xs text-neutral-500">
              Cơ sở có số lượt đặt và doanh thu cao nhất trên toàn hệ thống
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50/50 text-xs font-semibold uppercase text-neutral-500">
                    <th className="py-2.5 px-3">Hạng</th>
                    <th className="py-2.5 px-3">Tên cơ sở</th>
                    <th className="py-2.5 px-3 text-right">Lượt đặt</th>
                    <th className="py-2.5 px-3 text-right">Doanh thu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {data?.byVenue
                    .sort((a, b) => b.revenue - a.revenue)
                    .map((venue, idx) => (
                      <tr key={venue.venueId} className="hover:bg-neutral-50/50">
                        <td className="py-2.5 px-3 font-medium text-neutral-500">
                          #{idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-neutral-900">
                          {venue.name}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-neutral-700">
                          {venue.bookings} lượt
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold tabular-nums text-primary-700">
                          {formatCurrency(venue.revenue)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
