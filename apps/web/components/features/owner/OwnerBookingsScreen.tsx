'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Eye } from 'lucide-react';
import type { BookingStatus } from '@bsc/shared';
import type { OwnerBookingItem } from '@/lib/api/endpoints/owner';

import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { OwnerBookingDetailDrawer } from '@/components/features/owner/OwnerBookingDetailDrawer';
import { Button } from '@/components/ui/button';
import { type Column, DataTable, DataTablePagination } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { useOwnerBookings } from '@/lib/hooks/useOwnerBookings';
import { formatCurrency, formatDateTime, formatTimeRange } from '@/lib/utils/format';

export function OwnerBookingsScreen() {
  const t = useTranslations('owner');

  const [status, setStatus] = React.useState<string>('all');
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [selectedBooking, setSelectedBooking] = React.useState<OwnerBookingItem | null>(null);

  const bookingsQuery = useOwnerBookings({
    page,
    limit: 10,
    status: status === 'all' ? undefined : (status as BookingStatus),
  });

  const rawData = React.useMemo(() => bookingsQuery.data?.data ?? [], [bookingsQuery.data?.data]);
  const meta = bookingsQuery.data?.meta;

  // Lọc thêm theo tìm kiếm mã đơn / tên khách / SĐT
  const filteredData = React.useMemo(() => {
    if (!search.trim()) return rawData;
    const q = search.toLowerCase();
    return rawData.filter(
      (b) =>
        b.id.toLowerCase().includes(q) ||
        b.customerName.toLowerCase().includes(q) ||
        (b.customerPhone && b.customerPhone.includes(q)),
    );
  }, [rawData, search]);

  const columns: Array<Column<OwnerBookingItem>> = [
    {
      key: 'id',
      header: t('colBookingCode'),
      cell: (row) => (
        <span className="font-mono text-xs font-medium text-neutral-900" title={row.id}>
          {row.id.slice(0, 8)}…
        </span>
      ),
    },
    {
      key: 'customer',
      header: t('colCustomer'),
      cell: (row) => (
        <div>
          <p className="font-medium text-neutral-900">{row.customerName}</p>
          {row.customerPhone && <p className="text-xs text-neutral-500">{row.customerPhone}</p>}
        </div>
      ),
    },
    {
      key: 'court',
      header: t('colCourtVenue'),
      cell: (row) => <span className="font-medium text-neutral-900">{row.courtName}</span>,
    },
    {
      key: 'source',
      header: t('colSource'),
      cell: (row) => (
        <span className="text-xs text-neutral-600">
          {row.source === 'manual' ? t('sourceManual') : t('sourceOnline')}
        </span>
      ),
    },
    {
      key: 'time',
      header: t('colTime'),
      cell: (row) => (
        <span className="text-xs">
          {formatTimeRange(row.during.start, row.during.end)}
        </span>
      ),
    },
    {
      key: 'totalPrice',
      header: t('totalAmount'),
      align: 'right',
      cell: (row) => (
        <span className="font-bold text-neutral-900">{formatCurrency(row.totalPrice)}</span>
      ),
    },
    {
      key: 'status',
      header: t('status'),
      cell: (row) => <StatusBadge kind="booking" status={row.status} />,
    },
    {
      key: 'paymentStatus',
      header: 'Thanh toán',
      cell: (row) =>
        row.paymentStatus ? (
          <StatusBadge kind="payment" status={row.paymentStatus} />
        ) : (
          <span className="text-neutral-400">—</span>
        ),
    },
    {
      key: 'createdAt',
      header: 'Ngày tạo',
      cell: (row) => (
        <span className="text-xs text-neutral-600">{formatDateTime(row.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: t('colActions'),
      align: 'right',
      cell: (row) => (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setSelectedBooking(row)}
          aria-label="Xem chi tiết"
          title="Xem chi tiết"
        >
          <Eye className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Chi tiết</span>
        </Button>
      ),
    },
  ];

  const toolbar = (
    <div className="flex w-full flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          placeholder={t('searchBookingPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />

        <div className="flex items-center gap-1.5">
          <label htmlFor="filter-booking-status" className="text-sm font-medium text-neutral-600">
            {t('status')}:
          </label>
          <NativeSelect
            id="filter-booking-status"
            className="w-40"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">{t('filterAll')}</option>
            <option value="held">Đang giữ chỗ</option>
            <option value="pending_payment">Chờ duyệt</option>
            <option value="confirmed">Đã xác nhận</option>
            <option value="completed">Hoàn tất</option>
            <option value="cancelled">Đã huỷ</option>
          </NativeSelect>
        </div>
      </div>

      {meta && (
        <span className="text-xs text-neutral-500">
          Tổng cộng {meta.total} đơn
        </span>
      )}
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t('bookingsTitle')}
        description={t('bookingsDesc')}
      />

      {bookingsQuery.isError ? (
        <ErrorState
          error={bookingsQuery.error}
          onRetry={() => void bookingsQuery.refetch()}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={filteredData}
          getRowId={(r) => r.id}
          loading={bookingsQuery.isPending}
          toolbar={toolbar}
          emptyTitle="Chưa có đơn đặt sân nào"
          emptyDescription="Không tìm thấy đơn đặt sân phù hợp với bộ lọc hiện tại."
          pagination={
            meta && (
              <DataTablePagination
                page={meta.page}
                totalPages={meta.totalPages}
                onPageChange={(p) => setPage(p)}
              />
            )
          }
        />
      )}

      <OwnerBookingDetailDrawer
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
      />
    </div>
  );
}
