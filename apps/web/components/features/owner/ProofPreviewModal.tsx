'use client';

import * as React from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { ExternalLink, ReceiptText } from 'lucide-react';
import type { OwnerPaymentItem } from '@/lib/api/endpoints/owner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';

export interface ProofPreviewModalProps {
  payment: OwnerPaymentItem | null;
  onClose: () => void;
}

export function ProofPreviewModal({ payment, onClose }: ProofPreviewModalProps) {
  const t = useTranslations('owner');
  const tCommon = useTranslations('common');

  if (!payment) return null;

  return (
    <Dialog open={payment !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ReceiptText className="size-5 text-primary-600" aria-hidden="true" />
            {t('viewProofTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('colBookingCode')}: <strong className="text-neutral-900">{payment.booking.id}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Ảnh biên lai */}
          <div className="flex flex-col items-center justify-center overflow-hidden rounded-card border border-neutral-200 bg-neutral-50 p-2">
            {payment.proofUrl ? (
              <div className="relative aspect-[3/4] w-full max-w-[280px]">
                <Image
                  src={payment.proofUrl}
                  alt={t('proofTitle')}
                  fill
                  sizes="280px"
                  className="rounded object-contain"
                />
              </div>
            ) : (
              <p className="p-8 text-center text-sm text-neutral-400">{tCommon('noData')}</p>
            )}

            {payment.proofUrl && (
              <a
                href={payment.proofUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary-700 hover:underline"
              >
                <ExternalLink className="size-3.5" aria-hidden="true" />
                Mở ảnh gốc
              </a>
            )}
          </div>

          {/* Chi tiết giao dịch */}
          <div className="flex flex-col justify-between gap-4">
            <div className="rounded-card border border-neutral-200 bg-white p-4">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                {t('proofCustomerInfo')}
              </h4>

              <dl className="flex flex-col gap-2.5 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-500">{t('colCustomer')}</dt>
                  <dd className="font-medium text-neutral-900">{payment.booking.customerName}</dd>
                </div>

                {payment.booking.customerPhone && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-neutral-500">Số điện thoại</dt>
                    <dd className="font-medium text-neutral-900">
                      {payment.booking.customerPhone}
                    </dd>
                  </div>
                )}

                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-500">{t('colCourtVenue')}</dt>
                  <dd className="text-right font-medium text-neutral-900">
                    {payment.booking.courtName} ({payment.booking.venueName})
                  </dd>
                </div>

                <div className="flex justify-between gap-2 border-t border-neutral-100 pt-2">
                  <dt className="text-neutral-500">Nội dung CK</dt>
                  <dd className="font-mono font-medium text-primary-700">
                    {payment.transferCode ?? '—'}
                  </dd>
                </div>

                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-500">Số tiền cọc</dt>
                  <dd className="font-bold text-neutral-900">
                    {formatCurrency(payment.amount)}
                  </dd>
                </div>

                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-500">{t('colProofTime')}</dt>
                  <dd className="text-right text-xs text-neutral-600">
                    {payment.proofUploadedAt ? formatDateTime(payment.proofUploadedAt) : '—'}
                  </dd>
                </div>

                {payment.rejectReason && (
                  <div className="mt-2 rounded-btn bg-danger/10 p-2.5 text-xs text-danger">
                    <strong>Lý do từ chối:</strong> {payment.rejectReason}
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {tCommon('close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
