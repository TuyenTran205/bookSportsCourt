'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Building2,
  CalendarCheck,
  ClipboardList,
  DollarSign,
  FileClock,
  ShieldCheck,
  Tags,
  Users,
} from 'lucide-react';

import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminStats } from '@/lib/hooks/useAdminDashboard';
import { formatCurrency } from '@/lib/utils/format';

export function AdminDashboardScreen() {
  const t = useTranslations('admin');
  const statsQuery = useAdminStats();
  const stats = statsQuery.data;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t('dashboard')}
        description="Tổng quan hoạt động và các yêu cầu phê duyệt trên nền tảng BookSportsCourt."
      />

      {statsQuery.isPending ? (
        <div className="mt-6 flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-card" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Skeleton className="h-32 w-full rounded-card" />
            <Skeleton className="h-32 w-full rounded-card" />
          </div>
        </div>
      ) : statsQuery.isError ? (
        <div className="mt-6">
          <ErrorState
            error={statsQuery.error}
            onRetry={() => void statsQuery.refetch()}
          />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          {/* 4 Thẻ KPI toàn sàn */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label={t('totalRevenue')}
              value={formatCurrency(stats?.totalRevenue ?? 0)}
              icon={DollarSign}
            />
            <StatCard
              label={t('totalUsers')}
              value={`${stats?.totalUsers ?? 0} người`}
              icon={Users}
            />
            <StatCard
              label={t('totalVenues')}
              value={`${stats?.totalVenues ?? 0} cơ sở`}
              icon={Building2}
            />
            <StatCard
              label={t('totalBookings')}
              value={`${stats?.totalBookings ?? 0} lượt`}
              icon={CalendarCheck}
            />
          </div>

          {/* 2 Khối cảnh báo chờ phê duyệt */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card className="flex items-center justify-between border-amber-200 bg-amber-50/60 p-5">
              <div className="flex items-start gap-3.5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-neutral-900">
                    Hồ sơ đăng ký chủ sân chờ duyệt
                  </h4>
                  <p className="mt-0.5 text-xs text-neutral-600">
                    Hiện có <strong>{stats?.pendingOwnerApplications ?? 0}</strong> đối tác đang chờ xác minh thông tin doanh nghiệp.
                  </p>
                </div>
              </div>
              <Link href="/admin/owner-applications">
                <Button size="sm" variant="outline" className="border-amber-300 bg-white hover:bg-amber-100">
                  Xử lý ngay
                  <ArrowRight className="ml-1 size-3.5" />
                </Button>
              </Link>
            </Card>

            <Card className="flex items-center justify-between border-blue-200 bg-blue-50/60 p-5">
              <div className="flex items-start gap-3.5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                  <Building2 className="size-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-neutral-900">
                    Cơ sở thể thao mới chờ kiểm duyệt
                  </h4>
                  <p className="mt-0.5 text-xs text-neutral-600">
                    Hiện có <strong>{stats?.pendingVenues ?? 0}</strong> cơ sở mới tạo đang chờ duyệt địa chỉ & tiện ích.
                  </p>
                </div>
              </div>
              <Link href="/admin/venues">
                <Button size="sm" variant="outline" className="border-blue-300 bg-white hover:bg-blue-100">
                  Xem danh sách
                  <ArrowRight className="ml-1 size-3.5" />
                </Button>
              </Link>
            </Card>
          </div>

          {/* Lối tắt quản trị nhanh */}
          <div className="mt-2">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
              Phân hệ quản trị
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <Link href="/admin/owner-applications" className="group">
                <Card className="flex flex-col p-4 transition-all hover:border-primary-500 hover:shadow-sm">
                  <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                    <ShieldCheck className="size-5" />
                  </div>
                  <span className="text-sm font-semibold text-neutral-900">{t('ownerApplications')}</span>
                  <span className="text-xs text-neutral-500">Xác minh đối tác chủ sân</span>
                </Card>
              </Link>

              <Link href="/admin/venues" className="group">
                <Card className="flex flex-col p-4 transition-all hover:border-primary-500 hover:shadow-sm">
                  <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <Building2 className="size-5" />
                  </div>
                  <span className="text-sm font-semibold text-neutral-900">{t('venues')}</span>
                  <span className="text-xs text-neutral-500">Duyệt và kiểm soát cơ sở</span>
                </Card>
              </Link>

              <Link href="/admin/users" className="group">
                <Card className="flex flex-col p-4 transition-all hover:border-primary-500 hover:shadow-sm">
                  <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <Users className="size-5" />
                  </div>
                  <span className="text-sm font-semibold text-neutral-900">{t('users')}</span>
                  <span className="text-xs text-neutral-500">Phân quyền & khoá tài khoản</span>
                </Card>
              </Link>

              <Link href="/admin/catalogs" className="group">
                <Card className="flex flex-col p-4 transition-all hover:border-primary-500 hover:shadow-sm">
                  <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-purple-100 text-purple-700 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                    <Tags className="size-5" />
                  </div>
                  <span className="text-sm font-semibold text-neutral-900">{t('catalogs')}</span>
                  <span className="text-xs text-neutral-500">Môn thể thao, tiện ích, khu vực</span>
                </Card>
              </Link>

              <Link href="/admin/bookings" className="group">
                <Card className="flex flex-col p-4 transition-all hover:border-primary-500 hover:shadow-sm">
                  <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700 group-hover:bg-cyan-600 group-hover:text-white transition-colors">
                    <ClipboardList className="size-5" />
                  </div>
                  <span className="text-sm font-semibold text-neutral-900">{t('bookings')}</span>
                  <span className="text-xs text-neutral-500">Tra cứu & can thiệp đơn đặt</span>
                </Card>
              </Link>

              <Link href="/admin/analytics" className="group">
                <Card className="flex flex-col p-4 transition-all hover:border-primary-500 hover:shadow-sm">
                  <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-rose-100 text-rose-700 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                    <BarChart3 className="size-5" />
                  </div>
                  <span className="text-sm font-semibold text-neutral-900">{t('analytics')}</span>
                  <span className="text-xs text-neutral-500">Biểu đồ cơ cấu & tỷ lệ</span>
                </Card>
              </Link>

              <Link href="/admin/audit-logs" className="group">
                <Card className="flex flex-col p-4 transition-all hover:border-primary-500 hover:shadow-sm">
                  <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700 group-hover:bg-neutral-800 group-hover:text-white transition-colors">
                    <FileClock className="size-5" />
                  </div>
                  <span className="text-sm font-semibold text-neutral-900">{t('auditLogs')}</span>
                  <span className="text-xs text-neutral-500">Lịch sử thao tác quản trị</span>
                </Card>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
