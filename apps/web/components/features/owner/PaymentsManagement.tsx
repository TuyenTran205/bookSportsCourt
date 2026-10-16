'use client';

import * as React from 'react';
import Image from 'next/image';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Eye,
  FileImage,
} from 'lucide-react';
import { toast } from 'sonner';

import type { PaymentStatus } from '@bsc/shared';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { approvePayment, rejectPayment, type OwnerPaymentItem } from '@/lib/api/endpoints/owner';
import { formatCurrency, formatDateTimeRangeInVietnam } from '@/lib/utils/format';
import { useAuth } from '@/lib/hooks/useAuth';
import { useOwnerPayments } from '@/lib/hooks/useOwnerPayments';

const PAGE_SIZE = 10;
const PAYMENT_FILTERS: Array<PaymentStatus | 'all'> = [
  'all',
  'submitted',
  'completed',
  'rejected',
  'expired',
  'cancelled',
  'pending',
  'refunded',
];

function formatDateTimeInVietnam(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

export function PaymentsManagement() {
  const t = useTranslations('owner');
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const [status, setStatus] = React.useState<PaymentStatus | 'all'>('all');
  const [page, setPage] = React.useState(1);
  const [selectedPayment, setSelectedPayment] = React.useState<OwnerPaymentItem | null>(null);
  const [rejectTarget, setRejectTarget] = React.useState<OwnerPaymentItem | null>(null);
  const [rejectReason, setRejectReason] = React.useState('');
  const [failedImageId, setFailedImageId] = React.useState<string | null>(null);

  const paymentsQuery = useOwnerPayments(status === 'all' ? undefined : status, page, PAGE_SIZE, role === 'owner');

  const invalidatePayments = async () => {
    await queryClient.invalidateQueries({ queryKey: ['owner', 'payments'] });
    await queryClient.invalidateQueries({ queryKey: ['owner', 'bookings'] });
    await queryClient.invalidateQueries({ queryKey: ['owner', 'timeline'] });
  };

  const approveMutation = useMutation({
    mutationFn: approvePayment,
    onSuccess: async () => {
      await invalidatePayments();
      setSelectedPayment(null);
      toast.success(t('approveSuccess'));
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('approveFailed'));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectPayment(id, reason),
    onSuccess: async () => {
      await invalidatePayments();
      setRejectTarget(null);
      setSelectedPayment(null);
      setRejectReason('');
      toast.success(t('rejectSuccess'));
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('rejectFailed'));
    },
  });

  if (role !== 'owner') return null;

  if (paymentsQuery.isLoading) {
    return (
      <div className="space-y-5" aria-label={t('paymentsLoading')}>
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-10 w-72 max-w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (paymentsQuery.isError) {
    return (
      <ErrorState
        error={paymentsQuery.error}
        onRetry={() => void paymentsQuery.refetch()}
      />
    );
  }

  const items = paymentsQuery.data?.data ?? [];
  const meta = paymentsQuery.data?.meta;
  const totalPages = meta?.totalPages ?? 1;
  const firstItem = meta?.total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const lastItem = meta?.total ? Math.min(page * PAGE_SIZE, meta.total) : 0;
  const isProcessing = approveMutation.isPending || rejectMutation.isPending;
  const activePayment = selectedPayment;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">{t('paymentsTitle')}</h1>
        <p className="mt-1 text-sm text-neutral-600">{t('paymentsDesc')}</p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <label htmlFor="payment-status" className="shrink-0 text-sm font-medium text-neutral-700">
            {t('paymentStatusFilter')}
          </label>
          <select
            id="payment-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as PaymentStatus | 'all');
              setPage(1);
            }}
            className="h-10 min-w-40 rounded-input border border-neutral-300 bg-white px-3 text-sm text-neutral-900 hover:border-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
          >
            {PAYMENT_FILTERS.map((filter) => (
              <option key={filter} value={filter}>
                {t(filter === 'all' ? 'filterAll' : `paymentFilter_${filter}`)}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-neutral-500" aria-live="polite">
          {t('paymentCount', { count: meta?.total ?? items.length })}
        </p>
      </div>

      <section className="overflow-hidden rounded-card border border-neutral-200 bg-white">
        {items.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center">
            <CreditCard className="mb-3 size-8 text-neutral-400" aria-hidden="true" />
            <h2 className="font-medium text-neutral-900">{t(status === 'all' ? 'paymentsEmptyTitle' : 'paymentsFilterEmptyTitle')}</h2>
            <p className="mt-1 max-w-md text-sm text-neutral-600">
              {t(status === 'all' ? 'paymentsEmptyDesc' : 'paymentsFilterEmptyDesc')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-xs font-medium text-neutral-600">
                  <th scope="col" className="px-3 py-3">{t('colBookingCode')}</th>
                  <th scope="col" className="px-3 py-3">{t('colCustomer')}</th>
                  <th scope="col" className="px-3 py-3">{t('colCourtVenue')}</th>
                  <th scope="col" className="px-3 py-3">{t('colTime')}</th>
                  <th scope="col" className="px-3 py-3 text-right">{t('colAmount')}</th>
                  <th scope="col" className="px-3 py-3">{t('colProofTime')}</th>
                  <th scope="col" className="px-3 py-3">{t('colStatus')}</th>
                  <th scope="col" className="px-3 py-3 text-right">{t('colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((payment) => (
                  <tr key={payment.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/70">
                    <td className="px-3 py-3 font-mono text-xs text-neutral-600" title={payment.bookingId}>
                      {payment.bookingId.slice(0, 8)}…
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-neutral-900">{payment.booking.customerName}</div>
                      {payment.booking.customerPhone && (
                        <div className="mt-0.5 text-xs text-neutral-500">{payment.booking.customerPhone}</div>
                      )}
                    </td>
                    <td className="max-w-56 px-3 py-3">
                      <div className="font-medium text-neutral-900">{payment.booking.courtName}</div>
                      <div className="truncate text-xs text-neutral-500" title={payment.booking.venueName}>
                        {payment.booking.venueName}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs tabular-nums text-neutral-700">
                      {formatDateTimeRangeInVietnam(payment.booking.during.start, payment.booking.during.end)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-neutral-900">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs tabular-nums text-neutral-600">
                      {formatDateTimeInVietnam(payment.proofUploadedAt)}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge kind="payment" status={payment.status} size="sm" />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setFailedImageId(null);
                          setSelectedPayment(payment);
                        }}
                      >
                        <Eye aria-hidden="true" />
                        {t('viewProof')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {items.length > 0 && (
          <footer className="flex flex-col gap-3 border-t border-neutral-200 px-4 py-3 text-xs text-neutral-600 sm:flex-row sm:items-center sm:justify-between">
            <span>{t('paymentPaginationSummary', { from: firstItem, to: lastItem, total: meta?.total ?? items.length })}</span>
            <nav className="flex items-center justify-end gap-2" aria-label={t('paginationLabel')}>
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label={t('previousPage')}
                disabled={page <= 1 || paymentsQuery.isFetching}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <span className="min-w-12 text-center tabular-nums">{page} / {totalPages}</span>
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label={t('nextPage')}
                disabled={page >= totalPages || paymentsQuery.isFetching}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </nav>
          </footer>
        )}
      </section>

      <Dialog open={Boolean(activePayment)} onOpenChange={(open) => { if (!open) setSelectedPayment(null); }}>
        <DialogContent className="max-w-4xl" closeLabel={t('close')}>
          {activePayment && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <FileImage className="size-4 text-primary-700" aria-hidden="true" />
                  {t('viewProofTitle')}
                </DialogTitle>
                <DialogDescription className="break-all text-xs">
                  {t('paymentBookingCode', { code: activePayment.bookingId })}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(260px,0.9fr)]">
                <div className="relative flex min-h-56 items-center justify-center overflow-hidden rounded-card border border-neutral-200 bg-neutral-50 md:min-h-[320px]">
                  {activePayment.proofUrl && failedImageId !== activePayment.id ? (
                    <Image
                      src={activePayment.proofUrl}
                      alt={t('proofImageAlt', { customer: activePayment.booking.customerName })}
                      fill
                      unoptimized
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-contain"
                      onError={() => setFailedImageId(activePayment.id)}
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 px-4 text-center text-xs text-neutral-400">
                      <FileImage className="size-6" aria-hidden="true" />
                      {t(activePayment.proofUrl ? 'proofImageUnavailable' : 'proofUnavailable')}
                    </div>
                  )}
                </div>

                <section className="rounded-card border border-neutral-200 bg-white p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t('reconciliationTitle')}</h3>
                  <dl className="mt-3 space-y-3 text-xs">
                    <div className="flex items-start justify-between gap-3">
                      <dt className="shrink-0 text-neutral-500">{t('colCustomer')}</dt>
                      <dd className="text-right font-medium text-neutral-900">{activePayment.booking.customerName}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="shrink-0 text-neutral-500">{t('customerPhoneLabel')}</dt>
                      <dd className="text-right text-neutral-900">{activePayment.booking.customerPhone || '—'}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="shrink-0 text-neutral-500">{t('colCourtVenue')}</dt>
                      <dd className="max-w-[65%] text-right text-neutral-900">
                        {t('paymentCourtAndVenue', {
                          court: activePayment.booking.courtName,
                          venue: activePayment.booking.venueName,
                        })}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="shrink-0 text-neutral-500">{t('transferContent')}</dt>
                      <dd className="break-all text-right font-mono font-medium text-primary-700">
                        {activePayment.transferCode || '—'}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="shrink-0 text-neutral-500">{t('colAmount')}</dt>
                      <dd className="whitespace-nowrap text-right font-semibold tabular-nums text-neutral-900">
                        {formatCurrency(activePayment.amount)}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="shrink-0 text-neutral-500">{t('colProofTime')}</dt>
                      <dd className="text-right tabular-nums text-neutral-900">
                        {formatDateTimeInVietnam(activePayment.proofUploadedAt)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-neutral-100 pt-3">
                      <dt className="shrink-0 text-neutral-500">{t('colStatus')}</dt>
                      <dd><StatusBadge kind="payment" status={activePayment.status} size="sm" /></dd>
                    </div>
                  </dl>
                </section>
              </div>

              <DialogFooter className="sm:items-center">
                {activePayment.status === 'submitted' && (
                  <div className="mr-auto flex flex-col-reverse gap-2 sm:flex-row">
                    <Button
                      type="button"
                      variant="danger"
                      disabled={isProcessing}
                      onClick={() => {
                        setRejectReason('');
                        setRejectTarget(activePayment);
                      }}
                    >
                      {t('reject')}
                    </Button>
                    <Button
                      type="button"
                      loading={approveMutation.isPending}
                      disabled={isProcessing}
                      onClick={() => approveMutation.mutate(activePayment.id)}
                    >
                      {t('approve')}
                    </Button>
                  </div>
                )}
                <Button type="button" variant="outline" onClick={() => setSelectedPayment(null)}>
                  {t('close')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(rejectTarget)}
        onOpenChange={(open) => {
          if (!open && !rejectMutation.isPending) {
            setRejectTarget(null);
            setRejectReason('');
          }
        }}
      >
        <DialogContent closeLabel={t('close')}>
          <DialogHeader>
            <DialogTitle>{t('rejectTitle')}</DialogTitle>
            <DialogDescription>{t('rejectDesc')}</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!rejectTarget || !rejectReason.trim()) return;
              rejectMutation.mutate({ id: rejectTarget.id, reason: rejectReason.trim() });
            }}
          >
            <div className="space-y-1.5">
              <label htmlFor="payment-reject-reason" className="text-sm font-medium text-neutral-800">
                {t('rejectReason')}
              </label>
              <Textarea
                id="payment-reject-reason"
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                placeholder={t('rejectReasonPlaceholder')}
                maxLength={500}
                rows={4}
                required
              />
              <p className="text-right text-xs text-neutral-500">{rejectReason.length}/500</p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={rejectMutation.isPending}
                onClick={() => {
                  setRejectTarget(null);
                  setRejectReason('');
                }}
              >
                {t('manualCancel')}
              </Button>
              <Button
                type="submit"
                variant="danger"
                loading={rejectMutation.isPending}
                disabled={!rejectReason.trim()}
              >
                {t('rejectConfirm')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
