'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';
import type { OwnerApplication } from '@bsc/shared';

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
import { useReviewOwnerApplication } from '@/lib/hooks/useAdminOwnerApplications';

const rejectSchema = z.object({
  reviewNote: z.string().min(2, 'Vui lòng nhập lý do từ chối').max(500),
});

type RejectFormData = z.infer<typeof rejectSchema>;

export interface RejectApplicationDialogProps {
  application: OwnerApplication | null;
  open: boolean;
  onClose: () => void;
}

export function RejectApplicationDialog({
  application,
  open,
  onClose,
}: RejectApplicationDialogProps) {
  const tCommon = useTranslations('common');
  const reviewMutation = useReviewOwnerApplication();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RejectFormData>({
    resolver: zodResolver(rejectSchema),
    defaultValues: {
      reviewNote: '',
    },
  });

  React.useEffect(() => {
    if (open) {
      reset({ reviewNote: '' });
    }
  }, [open, reset]);

  if (!application) return null;

  const onSubmit = handleSubmit(async (values) => {
    try {
      await reviewMutation.mutateAsync({
        id: application.id,
        status: 'rejected',
        reviewNote: values.reviewNote,
      });
      toast.success('Đã từ chối hồ sơ đăng ký');
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tCommon('error'));
    }
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Từ chối hồ sơ đối tác</DialogTitle>
          <DialogDescription>
            Nhập lý do từ chối hồ sơ của <strong>{application.user.fullName}</strong> ({application.businessName}). Người nộp sẽ nhận được thông báo để bổ sung thông tin.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <FormField
            label="Lý do từ chối"
            htmlFor="reject-note"
            required
            error={errors.reviewNote?.message}
          >
            <Textarea
              id="reject-note"
              rows={3}
              placeholder="Ví dụ: Mã số thuế không tra cứu được, thông tin chưa rõ ràng..."
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
