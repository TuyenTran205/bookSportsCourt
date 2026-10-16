'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { replyReviewSchema } from '@bsc/shared';

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

interface ReviewReplyDialogProps {
  review: OwnerReview | null;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reviewId: string, reply: string) => void;
}

export function ReviewReplyDialog({
  review,
  saving,
  onOpenChange,
  onSubmit,
}: ReviewReplyDialogProps) {
  const t = useTranslations('owner');
  const [reply, setReply] = React.useState('');
  const [error, setError] = React.useState('');
  const open = review !== null;

  React.useEffect(() => {
    setReply(review?.ownerReply ?? '');
    setError('');
  }, [review]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!review) return;
    const parsed = replyReviewSchema.safeParse({ ownerReply: reply.trim() });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t('replyContentInvalid'));
      return;
    }
    setError('');
    onSubmit(review.id, parsed.data.ownerReply);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !saving) onOpenChange(false);
      }}
    >
      <DialogContent closeLabel={t('close')} className="p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle>
            {review?.ownerReply ? t('editReviewReplyTitle') : t('replyReviewTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('replyReviewDescription', { name: review?.customerName ?? review?.customer?.fullName ?? t('customer') })}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit} noValidate>
          <label className="block space-y-1.5 text-sm font-medium text-neutral-700">
            <span>{t('replyContent')}</span>
            <Textarea
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              rows={5}
              maxLength={2000}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'review-reply-error review-reply-count' : 'review-reply-count'}
              disabled={saving}
              autoFocus
              placeholder={t('replyPlaceholder')}
            />
          </label>
          <div className="flex items-start justify-between gap-3">
            {error ? (
              <p id="review-reply-error" role="alert" className="text-sm text-danger">{error}</p>
            ) : <span />}
            <p id="review-reply-count" className="shrink-0 text-xs text-neutral-500">
              {t('characterCount', { count: reply.length, max: 2000 })}
            </p>
          </div>
          <DialogFooter className="pt-1">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              {t('cancelAction')}
            </Button>
            <Button type="submit" loading={saving} disabled={!reply.trim()}>
              {review?.ownerReply ? t('saveReplyChanges') : t('sendReply')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
