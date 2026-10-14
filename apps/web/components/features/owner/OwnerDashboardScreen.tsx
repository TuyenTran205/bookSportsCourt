'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Layers,
  Settings,
  TrendingUp,
} from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { useOwnerBookings } from '@/lib/hooks/useOwnerBookings';
import { useOwnerPayments } from '@/lib/hooks/useOwnerPayments';
import { useOwnerRevenue } from '@/lib/hooks/useOwnerRevenue';
import { formatCurrency, formatDate, formatTimeRange } from '@/lib/utils/format';

export function OwnerDashboardScreen() {
  const t = useTranslations('owner');

  const revenueQuery = useOwnerRevenue(7);
  const pendingPaymentsQuery = useOwnerPayments({ status: 'submitted', limit: 10 });
  const recentBookingsQuery = useOwnerBookings({ limit: 5 });

  const summary = revenueQuery.data?.summary;
  const pendingPayments = pendingPaymentsQuery.data?.data ?? [];
  const pendingCount = pendingPayments.length;
  const recentBookings = recentBookingsQuery.data?.data ?? [];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Tổng quan vận hành"
        description="Theo dõi hoạt động đặt sân, thanh toán và hiệu suất kinh doanh của bạn."
      />

      {/* Cảnh báo thanh toán chờ duyệt */}
      {pendingCount > 0 && (
        <div className="mb-6 flex items-center justify-between rounded-card border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="size-5 shrink-0 text-amber-600" aria-hidden="true" />
            <div>
              <p className="font-semibold text-amber-900">
                Có {pendingCount} đơn đặt sân đang chờ bạn duyệt biên lai chuyển khoản
              </p>
              <p className="text-xs text-amber-700">
                Hãy kiểm tra đối soát với tài khoản ngân hàng để xác nhận đơn cho khách.
              </p>
            </div>
          </div>
          <Link href="/owner/payments">
            <Button size="sm" className="bg-amber-600 text-white hover:bg-amber-700">
              Duyệt ngay
              <ArrowRight className="ml-1.5 size-4" aria-hidden="true" />
            </Button>
          </Link>
        </div>
      )}

      {/* 4 Thẻ KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {revenueQuery.isPending ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-card" />
          ))
        ) : (
          <>
            <StatCard
              label="Doanh thu 7 ngày"
              value={formatCurrency(summary?.totalRevenue ?? 0)}
              icon={DollarSign}
            />
            <StatCard
              label="Chờ duyệt tiền"
              value={`${pendingCount} đơn`}
              icon={CreditCard}
            />
            <StatCard
              label="Lượt đặt 7 ngày"
              value={`${summary?.totalBookings ?? 0} lượt`}
              icon={CalendarCheck}
            />
            <StatCard
              label="Tỷ lệ lấp đầy"
              value={`${Math.round((summary?.occupancyRate ?? 0) * 100)}%`}
              icon={TrendingUp}
            />
          </>
        )}
      </div>

      {/* Lối tắt chức năng nhanh */}
      <div className="mt-8">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
          Lối tắt chức năng
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Link href="/owner/timeline" className="group">
            <Card className="flex flex-col items-center p-4 text-center transition-all hover:border-primary-500 hover:shadow-sm">
              <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600 group-hover:bg-primary-600 group-hover:text-white transition-colors">
                <Calendar className="size-5" />
              </div>
              <span className="text-xs font-semibold text-neutral-900">Lịch sân ngày</span>
              <span className="text-[11px] text-neutral-400">Xem timeline & đặt tại quầy</span>
            </Card>
          </Link>

          <Link href="/owner/payments" className="group">
            <Card className="flex flex-col items-center p-4 text-center transition-all hover:border-primary-500 hover:shadow-sm">
              <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <CreditCard className="size-5" />
              </div>
              <span className="text-xs font-semibold text-neutral-900">Duyệt thanh toán</span>
              <span className="text-[11px] text-neutral-400">{pendingCount} đơn chờ</span>
            </Card>
          </Link>

          <Link href="/owner/venues" className="group">
            <Card className="flex flex-col items-center p-4 text-center transition-all hover:border-primary-500 hover:shadow-sm">
              <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Building2 className="size-5" />
              </div>
              <span className="text-xs font-semibold text-neutral-900">Cơ sở & Sân con</span>
              <span className="text-[11px] text-neutral-400">Quản lý cơ sở vật chất</span>
            </Card>
          </Link>

          <Link href="/owner/pricing" className="group">
            <Card className="flex flex-col items-center p-4 text-center transition-all hover:border-primary-500 hover:shadow-sm">
              <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <Layers className="size-5" />
              </div>
              <span className="text-xs font-semibold text-neutral-900">Giờ mở & Bảng giá</span>
              <span className="text-[11px] text-neutral-400">Cấu hình khung giờ</span>
            </Card>
          </Link>

          <Link href="/owner/revenue" className="group">
            <Card className="flex flex-col items-center p-4 text-center transition-all hover:border-primary-500 hover:shadow-sm">
              <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <TrendingUp className="size-5" />
              </div>
              <span className="text-xs font-semibold text-neutral-900">Báo cáo doanh thu</span>
              <span className="text-[11px] text-neutral-400">Biểu đồ & chỉ số</span>
            </Card>
          </Link>
        </div>
      </div>

      {/* Đơn đặt sân gần đây */}
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
            Đơn đặt sân gần đây
          </h3>
          <Link
            href="/owner/bookings"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700"
          >
            Xem tất cả
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

        <Card className="overflow-hidden p-0">
          {recentBookingsQuery.isPending ? (
            <div className="p-4">
              <Skeleton className="h-40 w-full" />
            </div>
          ) : recentBookings.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-500">
              Chưa có đơn đặt sân nào gần đây.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50/50 text-xs font-semibold uppercase text-neutral-500">
                    <th className="py-3 px-4">Mã đơn</th>
                    <th className="py-3 px-4">Khách hàng</th>
                    <th className="py-3 px-4">Sân con</th>
                    <th className="py-3 px-4">Khung giờ</th>
                    <th className="py-3 px-4 text-right">Tổng tiền</th>
                    <th className="py-3 px-4 text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {recentBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-neutral-50/50">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-neutral-700">
                        {b.id.slice(0, 8)}…
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-neutral-900">{b.customerName}</p>
                        <p className="text-xs text-neutral-400">{b.customerPhone ?? '-'}</p>
                      </td>
                      <td className="py-3 px-4 font-medium text-neutral-800">{b.courtName}</td>
                      <td className="py-3 px-4 text-xs text-neutral-600">
                        <span className="font-semibold">{formatDate(b.during.start)}</span> ·{' '}
                        {formatTimeRange(b.during.start, b.during.end)}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold tabular-nums text-neutral-900">
                        {formatCurrency(b.totalPrice)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <StatusBadge kind="booking" status={b.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
