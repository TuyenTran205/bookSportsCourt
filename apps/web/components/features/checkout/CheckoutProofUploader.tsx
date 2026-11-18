'use client';

import * as React from 'react';
import Image from 'next/image';
import { AlertCircle, ImagePlus, Trash2, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ApiError } from '@/lib/api/errors';
import { useUploadProof } from '@/lib/hooks/useBookings';
import { cn } from '@/lib/utils/cn';

const MAX_PROOF_BYTES = 5 * 1024 * 1024; // 5MB

export interface CheckoutProofUploaderProps {
  bookingId: string;
  onSuccess?: () => void;
  className?: string;
}

export function CheckoutProofUploader({
  bookingId,
  onSuccess,
  className,
}: CheckoutProofUploaderProps) {
  const t = useTranslations('checkout');
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

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;

    if (!picked.type.startsWith('image/')) {
      setFile(null);
      setFileError('Chỉ chấp nhận tệp định dạng ảnh (JPG, PNG, WebP).');
      return;
    }

    if (picked.size > MAX_PROOF_BYTES) {
      setFile(null);
      setFileError('Kích thước ảnh vượt quá 5MB. Vui lòng chọn ảnh nhỏ hơn.');
      return;
    }

    setFileError(null);
    setFile(picked);
  };

  const handleClear = () => {
    setFile(null);
    setFileError(null);
  };

  const onSubmit = async () => {
    if (!file || upload.isPending) return;

    try {
      await upload.mutateAsync(file);
      toast.success(t('submitSuccess'));
      setFile(null);
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Không gửi được minh chứng. Vui lòng thử lại.');
    }
  };

  return (
    <Card className={cn('space-y-4 p-5', className)}>
      <div>
        <h3 className="text-base font-bold text-text-primary">
          {t('uploadProofTitle')}
        </h3>
        <p className="mt-1 text-xs text-text-secondary">
          {t('uploadProofHint')}
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={onPickFile}
        aria-label={t('chooseImage')}
      />

      {/* Vùng xem trước ảnh đã chọn */}
      {preview ? (
        <div className="relative overflow-hidden rounded-card border border-border bg-bg-subtle p-2">
          <div className="relative aspect-[4/3] max-h-56 w-full">
            <Image
              src={preview}
              alt="Ảnh biên lai giao dịch chuyển khoản"
              fill
              unoptimized
              className="object-contain"
            />
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-xs text-text-secondary">
            <span className="truncate font-medium">{file?.name}</span>
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1 text-xs font-semibold text-danger transition-colors hover:underline"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              <span>Xóa ảnh</span>
            </button>
          </div>
        </div>
      ) : null}

      {/* Thông báo lỗi inline */}
      {fileError && (
        <div
          role="alert"
          className="flex items-center gap-1.5 rounded-btn border border-danger/20 bg-danger/5 p-2.5 text-xs text-danger"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          <span>{fileError}</span>
        </div>
      )}

      {/* Nút hành động */}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          className="flex-1 sm:flex-initial"
        >
          <ImagePlus className="size-4" aria-hidden="true" />
          <span>{file ? t('changeImage') : t('chooseImage')}</span>
        </Button>

        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={!file || upload.isPending}
          loading={upload.isPending}
          onClick={onSubmit}
          className="flex-1 sm:flex-initial"
        >
          <Upload className="size-4" aria-hidden="true" />
          <span>{upload.isPending ? t('submitting') : t('confirmPayment')}</span>
        </Button>
      </div>
    </Card>
  );
}
