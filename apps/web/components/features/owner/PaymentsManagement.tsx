'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CreditCard } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/lib/hooks/useAuth';
import { useOwnerPayments } from '@/lib/hooks/useOwnerPayments';
import { approvePayment, rejectPayment, type OwnerPaymentItem } from '@/lib/api/endpoints/owner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { ErrorState } from '@/components/common/ErrorState';
import { formatCurrency } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

export function PaymentsManagement() {
  const t = useTranslations('owner');
  const { role } = useAuth();
  const paymentsQuery = useOwnerPayments();
  const [processingId, setProcessingId] = React.useState<string | null>(null);

  if (role !== 'owner' && role !== 'admin') {
    return null;
  }

  const { data, isLoading, error, refetch } = paymentsQuery;

  if (isLoading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-6 w-48" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <ErrorState
        error={error}
        onRetry={() => void refetch()}
      />
    );
  }

  const items: OwnerPaymentItem[] = data?.data ?? [];

  if (items.length === 0) {
    return (
      <Card className="p-6 text-center text-neutral-500">
        <CreditCard className="mx-auto mb-2 size-8 text-neutral-400" />
        <p className="font-medium text-neutral-700">{t('noPendingPayments') ?? 'Không có giao dịch chờ duyệt'}</p>
        <p className="mt-1 text-xs text-neutral-500">Mọi khoản thanh toán đặt cọc đã được xử lý xong.</p>
      </Card>
    );
  }

  const handleApprove = async (id: string) => {
    try {
      setProcessingId(id);
      await approvePayment(id);
      toast.success(t('approveSuccess'));
      void refetch();
    } catch {
      toast.error('Không thể duyệt thanh toán.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt(t('rejectReason') + ':') ?? '';
    if (!reason.trim()) return;
    try {
      setProcessingId(id);
      await rejectPayment(id, reason);
      toast.success(t('rejectSuccess'));
      void refetch();
    } catch {
      toast.error('Không thể từ chối thanh toán.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <Card className="p-4 sm:p-5">
      <CardHeader className="flex flex-row items-center justify-between p-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <CreditCard className="size-5 text-amber-600" aria-hidden="true" />
          {t('paymentsTitle')}
        </CardTitle>
        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
          {items.length} đơn chờ duyệt
        </span>
      </CardHeader>

      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50/50 text-xs font-semibold uppercase text-neutral-500">
              <th className="py-3 px-3">{t('colBookingCode')}</th>
              <th className="py-3 px-3">{t('colCustomer')}</th>
              <th className="py-3 px-3">{t('colAmount')}</th>
              <th className="py-3 px-3">{t('colStatus')}</th>
              <th className="py-3 px-3 text-right">{t('colActions') ?? 'Thao tác'}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((payment) => (
              <tr key={payment.id} className="border-b border-neutral-100 hover:bg-neutral-50/60">
                <td className="py-3 px-3 font-mono text-xs text-neutral-600">
                  <Link href={`/owner/bookings`} className="hover:text-primary-700 hover:underline">
                    {payment.bookingId.substring(0, 8)}...
                  </Link>
                </td>
                <td className="py-3 px-3">
                  <div className="font-medium text-neutral-900">{payment.booking.customerName}</div>
                  {payment.booking.customerPhone && (
                    <div className="text-xs text-neutral-500">{payment.booking.customerPhone}</div>
                  )}
                </td>
                <td className="py-3 px-3 font-semibold tabular-nums text-neutral-900">
                  {formatCurrency(payment.amount)}
                </td>
                <td className="py-3 px-3">
                  <StatusBadge kind="payment" status={payment.status} />
                </td>
                <td className="py-3 px-3 text-right space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={processingId === payment.id}
                    onClick={() => void handleApprove(payment.id)}
                    className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  >
                    {t('approve')}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={processingId === payment.id}
                    onClick={() => void handleReject(payment.id)}
                  >
                    {t('reject')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}