'use client';

import * as React from 'react';
import Image from 'next/image';
import { AlertCircle, Check, Copy, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import type { HoldResult } from '@/lib/api/endpoints/bookings';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';
import { formatCurrency } from '@/lib/utils/format';
import { bankNameFromBin, buildTransferQrPayload } from '@/lib/utils/payment-qr';

export interface CheckoutPaymentSectionProps {
  payment: HoldResult['payment'];
  className?: string;
}

export function CheckoutPaymentSection({ payment, className }: CheckoutPaymentSectionProps) {
  const t = useTranslations('checkout');
  const { bankAccount } = payment;

  const payload = React.useMemo(
    () =>
      buildTransferQrPayload({
        bankBin: bankAccount.bankBin,
        accountNo: bankAccount.accountNo,
        amount: payment.amount,
        transferCode: payment.transferCode,
      }),
    [bankAccount.bankBin, bankAccount.accountNo, payment.amount, payment.transferCode],
  );

  const [qrSrc, setQrSrc] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(payload, { margin: 1, width: 240, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelled) setQrSrc(url);
      })
      .catch(() => {
        if (!cancelled) setQrSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [payload]);

  const copyToClipboard = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t('copied'));
    } catch {
      toast.error('Không thể sao chép, hãy sao chép thủ công.');
    }
  };

  return (
    <Card className={cn('space-y-6 p-5', className)}>
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold text-text-primary">
          <QrCode className="size-5 text-primary-600 dark:text-primary-400" aria-hidden="true" />
          <span>{t('transferInfoTitle')}</span>
        </h2>
        <p className="mt-1 text-xs text-text-secondary">
          {t('scanQrHint')}
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-[220px_minmax(0,1fr)] items-start">
        {/* Khối hiển thị mã QR VietQR (giữ nền trắng để dễ quét) */}
        <div className="mx-auto flex flex-col items-center">
          <div
            data-keep-white="true"
            className="flex size-[220px] items-center justify-center rounded-card border border-border bg-white p-2 shadow-xs"
          >
            {qrSrc ? (
              <Image
                src={qrSrc}
                alt="Mã VietQR chuyển khoản thanh toán đặt cọc"
                width={204}
                height={204}
                unoptimized
                className="size-full object-contain"
              />
            ) : (
              <div className="px-4 text-center text-xs text-neutral-400">
                Đang tạo mã VietQR...
              </div>
            )}
          </div>
          <span className="mt-2 text-center text-[11px] text-text-secondary">
            VietQR Napas 24/7
          </span>
        </div>

        {/* Khối thông tin chuyển khoản kèm nút sao chép */}
        <dl className="space-y-2.5 text-sm">
          <PaymentCopyRow
            label={t('bankName')}
            value={bankNameFromBin(bankAccount.bankBin)}
          />
          <PaymentCopyRow
            label={t('accountNo')}
            value={bankAccount.accountNo}
            onCopy={() => copyToClipboard(bankAccount.accountNo, t('accountNo'))}
            copyLabel={t('copy')}
            mono
          />
          <PaymentCopyRow
            label={t('accountName')}
            value={bankAccount.accountName}
          />
          <PaymentCopyRow
            label={t('amount')}
            value={formatCurrency(payment.amount)}
            onCopy={() => copyToClipboard(String(payment.amount), t('amount'))}
            copyLabel={t('copy')}
            emphasis
          />
          <PaymentCopyRow
            label={t('transferCode')}
            value={payment.transferCode}
            onCopy={() => copyToClipboard(payment.transferCode, t('transferCode'))}
            copyLabel={t('copy')}
            mono
            highlight
          />
        </dl>
      </div>

      <div className="flex items-start gap-2 rounded-btn border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <p className="leading-relaxed">
          {t('transferCodeWarning')}
        </p>
      </div>
    </Card>
  );
}

interface PaymentCopyRowProps {
  label: string;
  value: string;
  onCopy?: () => void;
  copyLabel?: string;
  mono?: boolean;
  emphasis?: boolean;
  highlight?: boolean;
}

function PaymentCopyRow({
  label,
  value,
  onCopy,
  copyLabel,
  mono,
  emphasis,
  highlight,
}: PaymentCopyRowProps) {
  const [done, setDone] = React.useState(false);

  const handleCopy = () => {
    if (!onCopy) return;
    onCopy();
    setDone(true);
    window.setTimeout(() => setDone(false), 1500);
  };

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-btn px-2.5 py-1.5 transition-colors',
        highlight
          ? 'border border-amber-200 bg-amber-50/50 dark:border-amber-800/50 dark:bg-amber-950/20'
          : 'border-b border-border last:border-b-0',
      )}
    >
      <div className="min-w-0">
        <dt className="text-xs text-text-secondary">{label}</dt>
        <dd
          className={cn(
            'truncate text-text-primary',
            mono && 'font-mono text-sm tracking-wide',
            emphasis && 'text-base font-bold text-primary-700 dark:text-primary-300',
            highlight && 'font-bold text-amber-900 dark:text-amber-200',
          )}
        >
          {value}
        </dd>
      </div>
      {onCopy && (
        <button
          type="button"
          aria-label={`${copyLabel ?? 'Sao chép'} ${label}`}
          onClick={handleCopy}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-btn text-text-secondary transition-colors hover:bg-bg-subtle hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
        >
          {done ? (
            <Check className="size-4 text-primary-600 dark:text-primary-400" aria-hidden="true" />
          ) : (
            <Copy className="size-4" aria-hidden="true" />
          )}
        </button>
      )}
    </div>
  );
}
