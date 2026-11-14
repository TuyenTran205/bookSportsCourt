'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  CalendarDays,
  CalendarX,
  ChevronLeft,
  ChevronRight,
  Eye,
  Search,
  UserX,
} from 'lucide-react';
import { toast } from 'sonner';

import { BOOKING_STATUSES } from '@bsc/shared';
import type { BookingStatus } from '@bsc/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Pagination } from '@/components/common/Pagination';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { NativeSelect } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { markBookingNoShow, type OwnerBookingItem } from '@/lib/api/endpoints/owner';
import { ApiError } from '@/lib/api/errors';
import { useOwnerBookings } from '@/lib/hooks/useOwnerBookings';
import { useOwnerRealtime } from '@/lib/hooks/useOwnerRealtime';
import {
  formatCurrency,
  formatDateTimeInVietnam,
  formatDateTimeRangeInVietnam,
  maskPhone,
} from '@/lib/utils/format';

const PAGE_SIZE = 10;
const EMPTY_BOOKINGS: OwnerBookingItem[] = [];

const BOOKING_FILTERS = ['all', ...BOOKING_STATUSES] as const;

/**
 * Kiểm tra điều kiện cho phép đánh dấu No-show (OWN-09):
 * 1. Đơn ở trạng thái 'confirmed'.
 * 2. Thời điểm hiện tại đã quá giờ bắt đầu trận đấu.
 */
function canMarkNoShow(booking: OwnerBookingItem): boolean {
  return booking.status === 'confirmed' && new Date() > new Date(booking.during.start);
}

function BookingDetails({
  booking,
  t,
}: {
  booking: OwnerBookingItem;
  t: ReturnType<typeof useTranslations<'owner'>>;
}) {
  const customerName = booking.customerName || booking.guestName || t('walkInCustomer');
  const customerPhone = booking.customerPhone || booking.guestPhone;

  const rows: Array<{ label: string; value: React.ReactNode }> = [
    {
      label: t('status'),
      value: <StatusBadge kind="booking" status={booking.status} size="sm" />,
    },
    {
      label: t('bookingPaymentStatus'),
      value: booking.paymentStatus ? (
        <StatusBadge kind="payment" status={booking.paymentStatus} size="sm" />
      ) : (
        <span className="text-neutral-500">{t('noPayment')}</span>
      ),
    },
    {
      label: t('customer'),
      value: (
        <span>
          {customerName}
          {customerPhone ? ` (${customerPhone})` : ''}
        </span>
      ),
    },
    { label: t('courtAndVenue'), value: booking.courtName },
    {
      label: t('source'),
      value: booking.source === 'manual' ? t('sourceManual') : t('sourceOnline'),
    },
    {
      label: t('time'),
      value: formatDateTimeRangeInVietnam(booking.during.start, booking.during.end),
    },
    { label: t('depositAmount'), value: formatCurrency(booking.depositAmount) },
    { label: t('totalAmount'), value: formatCurrency(booking.totalPrice) },
    { label: t('bookingCreatedAt'), value: formatDateTimeInVietnam(booking.createdAt) },
  ];

  return (
    <dl className="divide-y divide-neutral-100">
      {rows.map(({ label, value }) => (
        <div
          key={label}
          className="grid grid-cols-[minmax(6.5rem,0.8fr)_minmax(0,1.2fr)] items-start gap-3 py-2.5 text-sm"
        >
          <dt className="text-neutral-500">{label}</dt>
          <dd className="break-words text-right font-medium text-neutral-800">{value}</dd>
        </div>
      ))}
      {booking.note && (
        <div className="grid grid-cols-[minmax(6.5rem,0.8fr)_minmax(0,1.2fr)] items-start gap-3 py-2.5 text-sm">
          <dt className="text-neutral-500">{t('bookingNote')}</dt>
          <dd className="break-words text-right text-neutral-700">{booking.note}</dd>
        </div>
      )}
      {booking.cancelReason && (
        <div className="grid grid-cols-[minmax(6.5rem,0.8fr)_minmax(0,1.2fr)] items-start gap-3 py-2.5 text-sm">
          <dt className="text-neutral-500">{t('bookingCancelReason')}</dt>
          <dd className="break-words text-right text-neutral-700">{booking.cancelReason}</dd>
        </div>
      )}
    </dl>
  );
}

export function OwnerBookingsScreen() {
  const t = useTranslations('owner');
  const queryClient = useQueryClient();

  useOwnerRealtime();

  const [statusFilter, setStatusFilter] = React.useState<'all' | BookingStatus>('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [selectedBooking, setSelectedBooking] = React.useState<OwnerBookingItem | null>(null);
  const [bookingToNoShow, setBookingToNoShow] = React.useState<OwnerBookingItem | null>(null);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const bookingsQuery = useOwnerBookings({
    page,
    limit: PAGE_SIZE,
    status: statusFilter === 'all' ? undefined : statusFilter,
    q: debouncedSearch || undefined,
  });

  const noShowMutation = useMutation({
    mutationFn: (bookingId: string) => markBookingNoShow(bookingId),
    onSuccess: () => {
      setBookingToNoShow(null);
      if (selectedBooking && selectedBooking.id === bookingToNoShow?.id) {
        setSelectedBooking(null);
      }
      toast.success('Đã đánh dấu đơn đặt sân là khách không đến (No-show)');
      queryClient.invalidateQueries({ queryKey: ['owner', 'bookings'] });
      queryClient.invalidateQueries({ queryKey: ['owner', 'timeline'] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Thao tác thất bại');
    },
  });

  const bookings = bookingsQuery.data?.data ?? EMPTY_BOOKINGS;
  const meta = bookingsQuery.data?.meta;
  const total = meta?.total ?? 0;
  const totalPages = meta?.totalPages ?? 1;
  const currentPage = meta?.page ?? page;
  const firstItem = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const lastItem = Math.min(currentPage * PAGE_SIZE, total);

  const setFilter = (value: string) => {
    const next = BOOKING_FILTERS.find((filter) => filter === value);
    if (next) {
      setStatusFilter(next);
      setPage(1);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
          {t('bookingsTitle')}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">{t('bookingsDesc')}</p>
      </header>

      <section aria-label={t('bookingFilters')} className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <label className="relative min-w-0 flex-1 md:max-w-md">
            <span className="sr-only">{t('searchBookingsLabel')}</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
              aria-hidden="true"
            />
            <Input
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setPage(1);
              }}
              placeholder={t('searchBookingPlaceholder')}
              className="pl-9"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-neutral-600">
            <span className="shrink-0">{t('bookingStatusFilter')}</span>
            <NativeSelect
              value={statusFilter}
              onChange={(event) => setFilter(event.target.value)}
              className="min-w-44"
            >
              {BOOKING_FILTERS.map((status) => (
                <option key={status} value={status}>
                  {t(status === 'all' ? 'filterAll' : `bookingFilter_${status}`)}
                </option>
              ))}
            </NativeSelect>
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 text-sm text-neutral-500">
          <span aria-live="polite">{t('bookingCount', { count: total })}</span>
          {debouncedSearch && (
            <span className="truncate text-right">
              {t('bookingSearchSummary', { query: debouncedSearch })}
            </span>
          )}
        </div>
      </section>

      {bookingsQuery.isLoading ? (
        <Card className="space-y-3 overflow-hidden p-4">
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </Card>
      ) : bookingsQuery.isError ? (
        <ErrorState error={bookingsQuery.error} onRetry={() => void bookingsQuery.refetch()} />
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={CalendarX}
          title={
            debouncedSearch || statusFilter !== 'all'
              ? t('noMatchingBookings')
              : t('noRecentBookings')
          }
          description={
            debouncedSearch || statusFilter !== 'all'
              ? t('noMatchingBookingsDesc')
              : t('noRecentBookingsDesc')
          }
          action={
            debouncedSearch || statusFilter !== 'all' ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearchQuery('');
                  setDebouncedSearch('');
                  setStatusFilter('all');
                }}
              >
                {t('clearBookingFilters')}
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href="/owner/timeline">{t('timelineTitle')}</Link>
              </Button>
            )
          }
        />
      ) : (
        <Card className="overflow-hidden rounded-lg border border-border bg-bg-card shadow-none">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold text-neutral-500">
                  <th scope="col" className="whitespace-nowrap px-4 py-3">
                    {t('colBookingCode')}
                  </th>
                  <th scope="col" className="whitespace-nowrap px-4 py-3">
                    {t('colCustomer')}
                  </th>
                  <th scope="col" className="whitespace-nowrap px-4 py-3">
                    {t('colCourtVenue')}
                  </th>
                  <th scope="col" className="whitespace-nowrap px-4 py-3">
                    {t('bookingColTimeRange')}
                  </th>
                  <th scope="col" className="whitespace-nowrap px-4 py-3">
                    {t('colSource')}
                  </th>
                  <th scope="col" className="whitespace-nowrap px-4 py-3">
                    {t('colStatus')}
                  </th>
                  <th scope="col" className="whitespace-nowrap px-4 py-3">
                    {t('bookingPaymentStatus')}
                  </th>
                  <th scope="col" className="whitespace-nowrap px-4 py-3">
                    {t('bookingCreatedAt')}
                  </th>
                  <th scope="col" className="whitespace-nowrap px-4 py-3 text-right">
                    {t('colActions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {bookings.map((booking) => {
                  const name = booking.customerName || booking.guestName || t('walkInCustomer');
                  const eligibleNoShow = canMarkNoShow(booking);
                  return (
                    <tr key={booking.id} className="transition-colors hover:bg-neutral-50">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-neutral-600">
                        {booking.id.slice(0, 8)}…
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-neutral-900">{name}</div>
                        {(booking.customerPhone || booking.guestPhone) && (
                          <div className="mt-0.5 text-xs text-neutral-500">
                            {maskPhone(booking.customerPhone || booking.guestPhone)}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-neutral-800">
                        {booking.courtName}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-neutral-600">
                        {formatDateTimeRangeInVietnam(booking.during.start, booking.during.end)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-neutral-700">
                        {booking.source === 'manual' ? t('sourceManual') : t('sourceOnline')}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <StatusBadge kind="booking" status={booking.status} size="sm" />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {booking.paymentStatus ? (
                          <StatusBadge kind="payment" status={booking.paymentStatus} size="sm" />
                        ) : (
                          <span className="text-neutral-500">{t('noPayment')}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-neutral-600">
                        {formatDateTimeInVietnam(booking.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {eligibleNoShow && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="min-h-11 border-danger/30 text-danger hover:bg-danger-50 hover:text-danger"
                              onClick={() => setBookingToNoShow(booking)}
                            >
                              <UserX className="size-4" aria-hidden="true" />
                              <span>No-show</span>
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="min-h-11"
                            onClick={() => setSelectedBooking(booking)}
                          >
                            <Eye aria-hidden="true" />
                            {t('bookingDetailsAction')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <footer className="border-t border-border px-4 py-3">
            <Pagination
              meta={{
                page: currentPage,
                limit: PAGE_SIZE,
                total,
                totalPages,
              }}
              onPageChange={setPage}
              disabled={bookingsQuery.isFetching}
            />
          </footer>
        </Card>
      )}

      {/* Dialog chi tiết đơn */}
      <Dialog
        open={Boolean(selectedBooking)}
        onOpenChange={(open) => {
          if (!open) setSelectedBooking(null);
        }}
      >
        <DialogContent className="max-w-md p-5 sm:p-6" closeLabel={t('close')}>
          {selectedBooking && (
            <>
              <DialogHeader className="mb-3">
                <DialogTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="size-4 text-primary-700" aria-hidden="true" />
                  {t('bookingDetailTitle')}
                </DialogTitle>
                <DialogDescription className="break-all text-xs">
                  {t('bookingCodeLabel', { code: selectedBooking.id })}
                </DialogDescription>
              </DialogHeader>
              <BookingDetails booking={selectedBooking} t={t} />
              <DialogFooter className="mt-5 flex gap-2 sm:justify-end">
                {canMarkNoShow(selectedBooking) && (
                  <Button
                    type="button"
                    variant="danger"
                    className="min-h-11"
                    onClick={() => {
                      const target = selectedBooking;
                      setSelectedBooking(null);
                      setBookingToNoShow(target);
                    }}
                  >
                    <UserX className="size-4" aria-hidden="true" />
                    <span>Khách không đến (No-show)</span>
                  </Button>
                )}
                <Button type="button" variant="outline" onClick={() => setSelectedBooking(null)}>
                  {t('close')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog xác nhận No-show */}
      <Dialog
        open={Boolean(bookingToNoShow)}
        onOpenChange={(open) => {
          if (!open && !noShowMutation.isPending) setBookingToNoShow(null);
        }}
      >
        <DialogContent className="max-w-md p-5 sm:p-6" closeLabel={t('close')}>
          {bookingToNoShow && (
            <>
              <DialogHeader className="mb-3">
                <DialogTitle className="flex items-center gap-2 text-base text-danger">
                  <UserX className="size-4" aria-hidden="true" />
                  Xác nhận khách vắng mặt (No-show)?
                </DialogTitle>
                <DialogDescription className="text-sm text-neutral-600">
                  Đơn đặt sân mã #{bookingToNoShow.id.slice(0, 8)} sẽ chuyển sang trạng thái Vắng mặt. Hành động này không thể hoàn tác.
                </DialogDescription>
              </DialogHeader>

              <DialogFooter className="mt-5 flex gap-2 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={noShowMutation.isPending}
                  onClick={() => setBookingToNoShow(null)}
                >
                  Đóng
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  loading={noShowMutation.isPending}
                  onClick={() => noShowMutation.mutate(bookingToNoShow.id)}
                >
                  Xác nhận vắng mặt
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
