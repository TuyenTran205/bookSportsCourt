'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Ban,
  Calendar,
  Eye,
  Search,
} from 'lucide-react';
import type { BookingStatus } from '@bsc/shared';
import type { AdminBookingRow } from '@/lib/api/endpoints/admin';

import { Pagination } from '@/components/common/Pagination';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { AdminBookingDetailDrawer } from '@/components/features/admin/AdminBookingDetailDrawer';
import { ForceCancelDialog } from '@/components/features/admin/ForceCancelDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAdminBookings } from '@/lib/hooks/useAdminBookings';
import { formatCurrency, formatDate, formatTimeRange } from '@/lib/utils/format';

export function AdminBookingsScreen() {
  const t = useTranslations('admin');

  const [page, setPage] = React.useState(1);
  const [statusFilter, setStatusFilter] = React.useState<BookingStatus | undefined>(undefined);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [selectedBooking, setSelectedBooking] = React.useState<AdminBookingRow | null>(null);
  const [cancellingBooking, setCancellingBooking] = React.useState<AdminBookingRow | null>(null);

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const bookingsQuery = useAdminBookings({
    page,
    limit: 10,
    status: statusFilter,
    q: debouncedSearch.trim() || undefined,
  });

  const bookings = bookingsQuery.data?.data ?? [];
  const meta = bookingsQuery.data?.meta;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t('bookings')}
        description="Tra cứu và giám sát toàn bộ đơn đặt sân trên toàn sàn, xử lý khiếu nại và can thiệp khi có tranh chấp."
      />

      {/* Tìm kiếm & bộ lọc trạng thái */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo mã đơn, cơ sở hoặc tên khách..."
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={statusFilter === undefined ? 'primary' : 'outline'}
            size="sm"
            onClick={() => {
              setStatusFilter(undefined);
              setPage(1);
            }}
          >
            Tất cả
          </Button>
          <Button
            variant={statusFilter === 'held' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => {
              setStatusFilter('held');
              setPage(1);
            }}
          >
            Đang giữ chỗ
          </Button>
          <Button
            variant={statusFilter === 'pending_payment' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => {
              setStatusFilter('pending_payment');
              setPage(1);
            }}
          >
            Chờ duyệt TT
          </Button>
          <Button
            variant={statusFilter === 'confirmed' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => {
              setStatusFilter('confirmed');
              setPage(1);
            }}
          >
            Đã xác nhận
          </Button>
          <Button
            variant={statusFilter === 'completed' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => {
              setStatusFilter('completed');
              setPage(1);
            }}
          >
            Hoàn tất
          </Button>
          <Button
            variant={statusFilter === 'cancelled' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => {
              setStatusFilter('cancelled');
              setPage(1);
            }}
          >
            Đã huỷ
          </Button>
        </div>
      </div>

      {bookingsQuery.isPending ? (
        <Card className="p-4">
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </Card>
      ) : bookingsQuery.isError ? (
        <ErrorState
          error={bookingsQuery.error}
          onRetry={() => void bookingsQuery.refetch()}
        />
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="Không tìm thấy đơn đặt sân nào"
          description="Hiện không có đơn đặt sân nào phù hợp với điều kiện tìm kiếm hoặc bộ lọc."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50/50 text-xs font-semibold uppercase text-neutral-500">
                    <th className="py-3 px-4">Mã đơn</th>
                    <th className="py-3 px-4">Khách hàng</th>
                    <th className="py-3 px-4">Cơ sở & Sân</th>
                    <th className="py-3 px-4">Thời gian chơi</th>
                    <th className="py-3 px-4 text-right">Tổng tiền</th>
                    <th className="py-3 px-4">Nguồn</th>
                    <th className="py-3 px-4 text-center">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {bookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-neutral-50/50">
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs font-medium text-neutral-700">
                          {booking.id.slice(0, 8)}...
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-neutral-900">{booking.customerName}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-neutral-800">{booking.venueName}</p>
                        <p className="text-xs text-neutral-500">{booking.courtName}</p>
                      </td>
                      <td className="py-3 px-4 text-xs text-neutral-600">
                        <p className="font-medium">
                          {formatTimeRange(booking.during.start, booking.during.end)}
                        </p>
                        <p className="text-neutral-500">{formatDate(booking.during.start)}</p>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-semibold tabular-nums text-neutral-900">
                          {formatCurrency(booking.totalPrice)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="rounded-btn bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                          {booking.source === 'online' ? 'Online' : 'Tại quầy'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <StatusBadge kind="booking" status={booking.status} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedBooking(booking)}
                            title="Xem chi tiết đơn"
                          >
                            <Eye className="size-4" />
                          </Button>

                          {booking.status !== 'cancelled' && booking.status !== 'completed' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setCancellingBooking(booking)}
                              className="text-danger hover:bg-danger/10 hover:text-danger"
                              title="Cưỡng chế huỷ đơn (Quản trị viên)"
                            >
                              <Ban className="size-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {meta && (
            <Pagination
              meta={meta}
              onPageChange={setPage}
            />
          )}
        </div>
      )}

      <AdminBookingDetailDrawer
        booking={selectedBooking}
        open={selectedBooking !== null}
        onClose={() => setSelectedBooking(null)}
      />

      <ForceCancelDialog
        booking={cancellingBooking}
        open={cancellingBooking !== null}
        onClose={() => setCancellingBooking(null)}
      />
    </div>
  );
}
