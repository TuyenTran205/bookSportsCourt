'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MessageSquare, Star } from 'lucide-react';
import { toast } from 'sonner';
import { replyReviewSchema } from '@bsc/shared';
import type { z } from 'zod';

import { FormField } from '@/components/common/FormField';
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
import { ApiError } from '@/lib/api/errors';
import { useReplyReview, type OwnerReviewItem } from '@/lib/hooks/useOwnerReviews';
import { formatDateTime } from '@/lib/utils/format';

type ReplyFormData = z.infer<typeof replyReviewSchema>;

export interface ReviewReplyDialogProps {
  review: OwnerReviewItem | null;
  open: boolean;
  onClose: () => void;
}

export function ReviewReplyDialog({ review, open, onClose }: ReviewReplyDialogProps) {
  const t = useTranslations('owner');
  const tCommon = useTranslations('common');

  const replyMutation = useReplyReview();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReplyFormData>({
    resolver: zodResolver(replyReviewSchema),
    defaultValues: {
      ownerReply: '',
    },
  });

  React.useEffect(() => {
    if (review && open) {
      reset({
        ownerReply: review.ownerReply ?? '',
      });
    }
  }, [review, open, reset]);

  if (!review) return null;

  const onSubmit = handleSubmit(async (values) => {
    try {
      await replyMutation.mutateAsync({
        id: review.id,
        reply: values.ownerReply,
      });
      toast.success(t('replyReviewSuccess'));
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tCommon('error'));
    }
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('replyReviewTitle')}</DialogTitle>
          <DialogDescription>
            Phản hồi này sẽ được hiển thị công khai trên trang thông tin cơ sở dưới đánh giá của khách hàng.
          </DialogDescription>
        </DialogHeader>

        {/* Nội dung đánh giá của khách */}
        <div className="rounded-card border border-neutral-200 bg-neutral-50 p-4 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-neutral-900">
              {review.customerName ?? review.customer?.fullName ?? 'Khách hàng'}
            </span>
            <div className="flex items-center gap-0.5 text-amber-500">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`size-3.5 ${
                    i < review.rating ? 'fill-amber-500' : 'fill-neutral-200 text-neutral-200'
                  }`}
                  aria-hidden="true"
                />
              ))}
            </div>
          </div>
          <p className="mt-1 text-neutral-500">
            {review.venueName ? `${review.venueName} · ` : ''}
            {formatDateTime(review.createdAt)}
          </p>
          <p className="mt-2 text-sm italic text-neutral-800">
            &ldquo;{review.comment ?? 'Không có nhận xét viết'}&rdquo;
          </p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <FormField
            label={t('replyContent')}
            htmlFor="reply-content"
            required
            error={errors.ownerReply?.message}
          >
            <Textarea
              id="reply-content"
              rows={4}
              placeholder="Cảm ơn quý khách đã ghé thăm và gửi phản hồi..."
              {...register('ownerReply')}
            />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={replyMutation.isPending}>
              <MessageSquare className="mr-1.5 size-4" aria-hidden="true" />
              {replyMutation.isPending ? tCommon('loading') : t('sendReply')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
