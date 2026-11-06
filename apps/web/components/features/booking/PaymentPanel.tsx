'use client';

import * as React from 'react';
import Image from 'next/image';
import { Check, Copy, ImagePlus, Timer, Upload } from 'lucide-react';
import QRCode from 'qrcode';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ApiError } from '@/lib/api/errors';
import type { HoldResult } from '@/lib/api/endpoints/bookings';
import { useUploadProof } from '@/lib/hooks/useBookings';
import { cn } from '@/lib/utils/cn';
import { formatCountdown, formatCurrency } from '@/lib/utils/format';
import { bankNameFromBin, buildTransferQrPayload } from '@/lib/utils/payment-qr';

const MAX_PROOF_BYTES = 5 * 1024 * 1024;

interface PaymentPanelProps {
  bookingId: string;
  payment: HoldResult['payment'];
  /** ISO; hết hạn thì gọi `onExpired` để màn cha tải lại trạng thái. */
  expiresAt: string | null;
  onExpired: () => void;
}

/**
 * PaymentPanel – CUS-08/CUS-09: quét QR, đếm ngược 10 phút, gửi ảnh biên lai.
 * Thông tin chuyển khoản luôn hiện dạng văn bản kèm nút sao chép để dự phòng khi không quét được.
 */
export function PaymentPanel({ bookingId, payment, expiresAt, onExpired }: PaymentPanelProps) {
  const t = useTranslations('payment');
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

  // ===== Đếm ngược =====
  const expiredRef = React.useRef(onExpired);
  expiredRef.current = onExpired;
  const [remaining, setRemaining] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (!expiresAt) return;
    const target = new Date(expiresAt).getTime();
    let fired = false;
    const tick = () => {
      const ms = Math.max(0, target - Date.now());
      setRemaining(ms);
      if (ms === 0 && !fired) {
        fired = true;
        expiredRef.current();
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  // ===== Biên lai =====
  const upload = useUploadProof(bookingId);
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    if (!picked.type.startsWith('image/')) {
      setFile(null);
      setFileError(t('fileInvalid'));
      return;
    }
    if (picked.size > MAX_PROOF_BYTES) {
      setFile(null);
      setFileError(t('fileTooBig'));
      return;
    }
    setFileError(null);
    setFile(picked);
  };

  const onSubmit = async () => {
    if (!file) return;
    try {
      await upload.mutateAsync(file);
      toast.success(t('sent'));
      setFile(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t('sendFailed'));
    }
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t('copied'));
    } catch {
      toast.error(t('copyFailed'));
    }
  };

  const urgent = remaining !== null && remaining <= 60 * 1000;

  return (
    <Card className="space-y-6 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">{t('title')}</h2>
        {remaining !== null && (
          <p
            role="timer"
            aria-label={t('countdownAria')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold tabular-nums',
              urgent ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning',
            )}
          >
            <Timer className="size-4" aria-hidden="true" />
            {formatCountdown(remaining)}
          </p>
        )}
      </div>

      <div className="grid gap-6 sm:grid-cols-[240px_minmax(0,1fr)]">
        <div className="mx-auto flex size-60 items-center justify-center rounded-card border border-neutral-200 bg-white p-2">
          {qrSrc ? (
            <Image
              src={qrSrc}
              alt={t('qrAlt')}
              width={224}
              height={224}
              unoptimized
              className="size-full"
            />
          ) : (
            <p className="px-4 text-center text-sm text-neutral-500">{t('qrFailed')}</p>
          )}
        </div>

        <dl className="space-y-3 text-sm">
          <p className="text-neutral-600">{t('scanHint')}</p>
          <CopyRow label={t('bank')} value={bankNameFromBin(bankAccount.bankBin)} />
          <CopyRow label={t('accountNo')} value={bankAccount.accountNo} onCopy={copy} copyLabel={t('copy')} mono />
          <CopyRow label={t('accountName')} value={bankAccount.accountName} />
          <CopyRow
            label={t('amount')}
            value={formatCurrency(payment.amount)}
            onCopy={() => copy(String(payment.amount))}
            copyLabel={t('copy')}
            emphasis
          />
          <CopyRow
            label={t('transferCode')}
            value={payment.transferCode}
            onCopy={copy}
            copyLabel={t('copy')}
            mono
          />
        </dl>
      </div>

      <div className="space-y-3 border-t border-neutral-200 pt-5">
        <h3 className="text-base font-semibold text-neutral-900">{t('uploadTitle')}</h3>
        <p className="text-sm text-neutral-600">{t('uploadHint')}</p>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={onPick}
          aria-label={t('chooseFile')}
        />

        {preview ? (
          <div className="relative h-48 w-full max-w-xs overflow-hidden rounded-card border border-neutral-200 bg-neutral-50">
            <Image src={preview} alt={t('previewAlt')} fill unoptimized className="object-contain" />
          </div>
        ) : null}

        {fileError && (
          <p role="alert" className="text-sm text-danger">
            {fileError}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => inputRef.current?.click()}>
            <ImagePlus className="size-4" aria-hidden="true" />
            {file ? t('changeFile') : t('chooseFile')}
          </Button>
          <Button variant="primary" disabled={!file} loading={upload.isPending} onClick={onSubmit}>
            <Upload className="size-4" aria-hidden="true" />
            {t('send')}
          </Button>
        </div>
      </div>
    </Card>
  );
}

interface CopyRowProps {
  label: string;
  value: string;
  onCopy?: (value: string) => void;
  copyLabel?: string;
  mono?: boolean;
  emphasis?: boolean;
}

function CopyRow({ label, value, onCopy, copyLabel, mono, emphasis }: CopyRowProps) {
  const [done, setDone] = React.useState(false);
  return (
    <div className="flex items-center justify-between gap-3 border-b border-neutral-100 pb-2 last:border-b-0">
      <div className="min-w-0">
        <dt className="text-xs text-neutral-500">{label}</dt>
        <dd
          className={cn(
            'truncate text-neutral-900',
            mono && 'font-mono',
            emphasis && 'text-base font-bold text-primary-700',
          )}
        >
          {value}
        </dd>
      </div>
      {onCopy && (
        <button
          type="button"
          aria-label={`${copyLabel ?? 'Sao chép'} ${label}`}
          onClick={() => {
            onCopy(value);
            setDone(true);
            window.setTimeout(() => setDone(false), 1500);
          }}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-btn text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
        >
          {done ? (
            <Check className="size-4 text-success" aria-hidden="true" />
          ) : (
            <Copy className="size-4" aria-hidden="true" />
          )}
        </button>
      )}
    </div>
  );
}
