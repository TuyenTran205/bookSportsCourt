'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Calendar, Search, Filter } from 'lucide-react';
import { format, isValid, parseISO } from 'date-fns';

import type { BookingStatus } from '@bsc/shared';
import { useOwnerBookings } from '@/lib/hooks/useOwnerBookings';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { formatCurrency } from '@/lib/utils/format';
import type { OwnerBookingItem } from '@/lib/api/endpoints/owner';

const EMPTY_BOOKINGS: OwnerBookingItem[] = [];

function formatBookingSlot(startStr: string, endStr: string) {
  try {
    const s = parseISO(startStr);
    const e = parseISO(endStr);
    if (!isValid(s) || !isValid(e)) return '—';
    return `${format(s, 'dd/MM/yyyy HH:mm')} - ${format(e, 'HH:mm')}`;
  } catch {
    return '—';
  }
}

export function OwnerBookingsScreen() {
  const t = useTranslations('owner');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [searchQuery, setSearchQuery] = React.useState<string>('');

  const filterParam = statusFilter === 'all' ? undefined : (statusFilter as BookingStatus);
  const bookingsQuery = useOwnerBookings({ status: filterParam });

  const bookings = bookingsQuery.data?.data ?? EMPTY_BOOKINGS;

  const filtered = React.useMemo(() => {
    if (!searchQuery.trim()) return bookings;
    const q = searchQuery.toLowerCase();
    return bookings.filter(
      (b) =>
        b.id.toLowerCase().includes(q) ||
        (b.customerName && b.customerName.toLowerCase().includes(q)) ||
        (b.guestName && b.guestName.toLowerCase().includes(q)) ||
        (b.customerPhone && b.customerPhone.includes(q)) ||
        b.courtName.toLowerCase().includes(q),
    );
  }, [bookings, searchQuery]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
          {t('bookingsTitle')}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {t('bookingsDesc')}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchBookingPlaceholder')}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          <Filter className="size-4 text-neutral-400 shrink-0" />
          {[
            { key: 'all', label: 'Tất cả' },
            { key: 'confirmed', label: 'Đã xác nhận' },
            { key: 'pending_payment', label: 'Chờ duyệt' },
            { key: 'completed', label: 'Hoàn thành' },
            { key: 'cancelled', label: 'Đã huỷ' },
            { key: 'expired', label: 'Hết hạn' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                statusFilter === tab.key
                  ? 'bg-primary-700 text-white'
                  : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {bookingsQuery.isLoading ? (
        <Card className="p-4">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </Card>
      ) : bookingsQuery.isError ? (
        <ErrorState
          error={bookingsQuery.error}
          onRetry={() => void bookingsQuery.refetch()}
        />
      ) : (
        <Card className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-none">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/50 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  <th className="px-4 py-3.5 text-left">{t('colBookingCode')}</th>
                  <th className="px-4 py-3.5 text-left">{t('colCustomer')}</th>
                  <th className="px-4 py-3.5 text-left">{t('colCourt')}</th>
                  <th className="px-4 py-3.5 text-left">{t('colTimeRange')}</th>
                  <th className="px-4 py-3.5 text-right pr-8">{t('colTotalPrice')}</th>
                  <th className="px-4 py-3.5 text-right pr-6">{t('colStatus')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12">
                      <EmptyState
                        icon={Calendar}
                        title={t('noRecentBookings')}
                        description="Không tìm thấy đơn đặt sân phù hợp với bộ lọc hiện tại."
                      />
                    </td>
                  </tr>
                ) : (
                  filtered.map((b) => (
                    <tr key={b.id} className="hover:bg-neutral-50/60 transition-colors">
                      <td className="px-4 py-3.5 font-mono text-xs text-neutral-600 whitespace-nowrap">
                        {b.id.substring(0, 8)}...
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-neutral-900 text-sm">
                          {b.customerName || b.guestName || 'Khách vãng lai'}
                        </div>
                        {b.customerPhone && (
                          <div className="text-xs text-neutral-500 mt-0.5">
                            {b.customerPhone}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-sm font-medium text-neutral-800 whitespace-nowrap">
                        {b.courtName}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-neutral-600 tabular-nums whitespace-nowrap">
                        {formatBookingSlot(b.during.start, b.during.end)}
                      </td>
                      <td className="px-4 py-3.5 text-sm font-semibold tabular-nums text-neutral-900 text-right pr-8 whitespace-nowrap">
                        {formatCurrency(b.totalPrice)}
                      </td>
                      <td className="px-4 py-3.5 text-right pr-6 whitespace-nowrap">
                        <StatusBadge kind="booking" status={b.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
