'use client';

import * as React from 'react';
import { ImagePlus, X } from 'lucide-react';
import {
  reportReviewSchema,
  UPLOAD_ACCEPTED_TYPES,
  UPLOAD_MAX_BYTES,
} from '@bsc/shared';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import type { OwnerReview } from '@/lib/api/endpoints/owner';

interface ReviewReportDialogProps {
  review: OwnerReview | null;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reviewId: string, input: { reason: string; file?: File | null }) => void;
}

export function ReviewReportDialog({
  review,
  submitting,
  onOpenChange,
  onSubmit,
}: ReviewReportDialogProps) {
  const [reason, setReason] = React.useState('');
  const [file, setFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState('');
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    setReason('');
    setFile(null);
    setError('');
  }, [review]);

  React.useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (!(UPLOAD_ACCEPTED_TYPES as readonly string[]).includes(selected.type)) {
      setError('Chỉ hỗ trợ ảnh định dạng JPG, PNG hoặc WebP.');
      event.target.value = '';
      return;
    }
    if (selected.size > UPLOAD_MAX_BYTES) {
      setError('Dung lượng ảnh minh chứng tối đa 5 MB.');
      event.target.value = '';
      return;
    }
    setError('');
    setFile(selected);
  };

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!review) return;
    const parsed = reportReviewSchema.safeParse({ reason: reason.trim() });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Lý do báo cáo chưa hợp lệ.');
      return;
    }
    setError('');
    onSubmit(review.id, { reason: parsed.data.reason, file });
  };

  return (
    <Dialog
      open={review !== null}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !submitting) onOpenChange(false);
      }}
    >
      <DialogContent closeLabel="Đóng" className="max-w-lg p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle>Báo cáo đánh giá lên quản trị viên</DialogTitle>
          <DialogDescription>
            Gửi yêu cầu xem xét ẩn đánh giá không phù hợp của{' '}
            <span className="font-medium text-text-primary">
              {review?.customerName ?? 'Khách hàng'}
            </span>
            . Admin sẽ kiểm tra lý do và bằng chứng đính kèm.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <label className="block space-y-1.5 text-sm font-medium text-text-primary">
            <span>
              Lý do báo cáo <span className="text-danger">*</span>
            </span>
            <Textarea
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                if (error) setError('');
              }}
              rows={4}
              maxLength={1000}
              disabled={submitting}
              autoFocus
              aria-invalid={Boolean(error)}
              placeholder="Ví dụ: Đánh giá sai sự thật, ngôn từ công kích hoặc spam đối thủ..."
            />
          </label>

          <div className="space-y-2">
            <span className="block text-sm font-medium text-text-primary">
              Ảnh minh chứng (tuỳ chọn)
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept={UPLOAD_ACCEPTED_TYPES.join(',')}
              disabled={submitting}
              onChange={handleFileChange}
              className="sr-only"
              id="review-report-image"
            />
            {previewUrl ? (
              <div className="relative overflow-hidden rounded-card border border-border bg-bg-subtle p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Ảnh minh chứng báo cáo"
                  className="mx-auto max-h-48 w-auto rounded object-contain"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="absolute right-2 top-2 size-8 bg-bg-card"
                  disabled={submitting}
                  onClick={clearFile}
                  aria-label="Xoá ảnh đã chọn"
                >
                  <X className="size-4" aria-hidden="true" />
                </Button>
              </div>
            ) : (
              <label
                htmlFor="review-report-image"
                className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-card border border-dashed border-border bg-bg-subtle px-4 py-5 text-center transition-colors hover:border-primary-500 hover:bg-bg-card"
              >
                <ImagePlus className="size-6 text-text-secondary" aria-hidden="true" />
                <span className="text-xs font-medium text-text-primary">
                  Tải ảnh chụp màn hình hoặc bằng chứng
                </span>
                <span className="text-[11px] text-text-secondary">
                  JPG, PNG hoặc WebP (tối đa 5 MB)
                </span>
              </label>
            )}
          </div>

          <div className="flex items-start justify-between gap-3">
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : (
              <span />
            )}
            <p className="shrink-0 text-xs text-text-secondary">{reason.length}/1000</p>
          </div>

          <DialogFooter className="pt-1">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              Huỷ
            </Button>
            <Button type="submit" variant="danger" loading={submitting}>
              Gửi báo cáo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
