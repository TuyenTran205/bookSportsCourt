'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Check, Eye, Wallet, X } from 'lucide-react';
import { toast } from 'sonner';
import type { OwnerPaymentItem } from '@/lib/api/endpoints/owner';

import { ErrorState } from '@/components/common/ErrorState';
import { PageHeader } from '@/components/common/PageHeader';
import { ProofPreviewModal } from '@/components/features/owner/ProofPreviewModal';
import { RejectPaymentDialog } from '@/components/features/owner/RejectPaymentDialog';
import { Button } from '@/components/ui/button';
import { type Column, DataTable, DataTablePagination } from '@/components/ui/data-table';
import { NativeSelect } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { ApiError } from '@/lib/api/errors';
import { useApprovePayment } from '@/lib/hooks/useOwnerMutations';
import { useOwnerPayments } from '@/lib/hooks/useOwnerPayments';
import { formatCurrency, formatDateTime, formatTimeRange } from '@/lib/utils/format';

export function OwnerPaymentsScreen() {
  const t = useTranslations('owner');
  const tCommon = useTranslations('common');

  const [status, setStatus] = React.useState<string>('submitted');
  const [page, setPage] = React.useState(1);
  const [previewPayment, setPreviewPayment] = React.useState<OwnerPaymentItem | null>(null);
  const [rejectPaymentItem, setRejectPaymentItem] = React.useState<OwnerPaymentItem | null>(null);

  const paymentsQuery = useOwnerPayments({
    page,
    limit: 10,
    status: status === 'all' ? undefined : status,
  });

  const approveMutation = useApprovePayment();

  const handleApprove = async (payment: OwnerPaymentItem) => {
    try {
      await approveMutation.mutateAsync(payment.id);
      toast.success(t('approveSuccess'));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tCommon('error'));
    }
  };

  const data = paymentsQuery.data?.data ?? [];
  const meta = paymentsQuery.data?.meta;

  const columns: Array<Column<OwnerPaymentItem>> = [
    {
      key: 'bookingId',
      header: t('colBookingCode'),
      cell: (row) => (
        <span className="font-mono text-xs font-medium text-neutral-900" title={row.booking.id}>
          {row.booking.id.slice(0, 8)}…
        </span>
      ),
    },
    {
      key: 'customer',
      header: t('colCustomer'),
      cell: (row) => (
        <div>
          <p className="font-medium text-neutral-900">{row.booking.customerName}</p>
          {row.booking.customerPhone && (
            <p className="text-xs text-neutral-500">{row.booking.customerPhone}</p>
          )}
        </div>
      ),
    },
    {
      key: 'court',
      header: t('colCourtVenue'),
      cell: (row) => (
        <div>
          <p className="font-medium text-neutral-900">{row.booking.courtName}</p>
          <p className="text-xs text-neutral-500">{row.booking.venueName}</p>
        </div>
      ),
    },
    {
      key: 'time',
      header: t('colTime'),
      cell: (row) => (
        <span className="text-xs">
          {formatTimeRange(row.booking.during.start, row.booking.during.end)}
        </span>
      ),
    },
    {
      key: 'amount',
      header: t('colAmount'),
      align: 'right',
      cell: (row) => (
        <span className="font-bold text-neutral-900">{formatCurrency(row.amount)}</span>
      ),
    },
    {
      key: 'proofUploadedAt',
      header: t('colProofTime'),
      cell: (row) => (
        <span className="text-xs text-neutral-600">
          {row.proofUploadedAt ? formatDateTime(row.proofUploadedAt) : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('colStatus'),
      cell: (row) => <StatusBadge kind="payment" status={row.status} />,
    },
    {
      key: 'actions',
      header: t('colActions'),
      align: 'right',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setPreviewPayment(row)}
            aria-label={t('viewProof')}
            title={t('viewProof')}
          >
            <Eye className="size-4" aria-hidden="true" />
            <span className="hidden lg:inline">{t('viewProof')}</span>
          </Button>

          {row.status === 'submitted' && (
            <>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={approveMutation.isPending}
                onClick={() => handleApprove(row)}
                aria-label={t('approve')}
              >
                <Check className="size-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{t('approve')}</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-danger hover:bg-danger/10 hover:text-danger"
                onClick={() => setRejectPaymentItem(row)}
                aria-label={t('reject')}
              >
                <X className="size-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{t('reject')}</span>
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  const toolbar = (
    <div className="flex w-full flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <label htmlFor="filter-payment-status" className="text-sm font-medium text-neutral-600">
          {t('status')}:
        </label>
        <NativeSelect
          id="filter-payment-status"
          className="w-44"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">{t('filterAll')}</option>
          <option value="submitted">{t('filterSubmitted')}</option>
          <option value="completed">{t('filterCompleted')}</option>
          <option value="rejected">{t('filterRejected')}</option>
        </NativeSelect>
      </div>

      {meta && (
        <span className="text-xs text-neutral-500">
          {meta.total} giao dịch
        </span>
      )}
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t('paymentsTitle')}
        description={t('paymentsDesc')}
      />

      {paymentsQuery.isError ? (
        <ErrorState
          error={paymentsQuery.error}
          onRetry={() => void paymentsQuery.refetch()}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={data}
          getRowId={(r) => r.id}
          loading={paymentsQuery.isPending}
          toolbar={toolbar}
          emptyTitle="Không có giao dịch nào"
          emptyDescription="Chưa có yêu cầu thanh toán nào khớp với bộ lọc hiện tại."
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

      <ProofPreviewModal
        payment={previewPayment}
        onClose={() => setPreviewPayment(null)}
      />

      <RejectPaymentDialog
        payment={rejectPaymentItem}
        onClose={() => setRejectPaymentItem(null)}
      />
    </div>
  );
}
