'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';
import type { AdminVenueRow } from '@/lib/api/endpoints/admin';

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
import { useReviewVenue } from '@/lib/hooks/useAdminVenues';

const rejectVenueSchema = z.object({
  reviewNote: z.string().min(2, 'Vui lòng nhập lý do từ chối').max(500),
});

type RejectVenueFormData = z.infer<typeof rejectVenueSchema>;

export interface RejectVenueDialogProps {
  venue: AdminVenueRow | null;
  open: boolean;
  onClose: () => void;
}

export function RejectVenueDialog({ venue, open, onClose }: RejectVenueDialogProps) {
  const tCommon = useTranslations('common');
  const reviewMutation = useReviewVenue();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RejectVenueFormData>({
    resolver: zodResolver(rejectVenueSchema),
    defaultValues: {
      reviewNote: '',
    },
  });

  React.useEffect(() => {
    if (open) {
      reset({ reviewNote: '' });
    }
  }, [open, reset]);

  if (!venue) return null;

  const onSubmit = handleSubmit(async (values) => {
    try {
      await reviewMutation.mutateAsync({
        id: venue.id,
        status: 'rejected',
        reviewNote: values.reviewNote,
      });
      toast.success('Đã từ chối duyệt cơ sở');
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tCommon('error'));
    }
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Từ chối duyệt cơ sở thể thao</DialogTitle>
          <DialogDescription>
            Nhập lý do từ chối cơ sở <strong>{venue.name}</strong>. Chủ sân sẽ nhận được thông báo để cập nhật lại thông tin.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <FormField
            label="Lý do từ chối"
            htmlFor="reject-venue-note"
            required
            error={errors.reviewNote?.message}
          >
            <Textarea
              id="reject-venue-note"
              rows={3}
              placeholder="Ví dụ: Địa chỉ chưa chính xác, thiếu hình ảnh cơ sở vật chất..."
              {...register('reviewNote')}
            />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {tCommon('cancel')}
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={reviewMutation.isPending}
            >
              {reviewMutation.isPending ? tCommon('loading') : 'Xác nhận từ chối'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
