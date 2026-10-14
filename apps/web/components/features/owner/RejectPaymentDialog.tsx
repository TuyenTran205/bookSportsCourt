'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';
import type { OwnerPaymentItem } from '@/lib/api/endpoints/owner';

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
import { useRejectPayment } from '@/lib/hooks/useOwnerMutations';

const formSchema = z.object({
  reason: z
    .string()
    .min(3, 'Vui lòng nhập lý do từ chối (tối thiểu 3 ký tự)')
    .max(500, 'Lý do tối đa 500 ký tự'),
});

type FormData = z.infer<typeof formSchema>;

export interface RejectPaymentDialogProps {
  payment: OwnerPaymentItem | null;
  onClose: () => void;
}

export function RejectPaymentDialog({ payment, onClose }: RejectPaymentDialogProps) {
  const t = useTranslations('owner');
  const tCommon = useTranslations('common');
  const mutation = useRejectPayment();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { reason: '' },
  });

  React.useEffect(() => {
    if (payment) reset({ reason: '' });
  }, [payment, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (!payment) return;
    try {
      await mutation.mutateAsync({
        paymentId: payment.id,
        reason: values.reason,
      });
      toast.success(t('rejectSuccess'));
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tCommon('error'));
    }
  });

  if (!payment) return null;

  return (
    <Dialog open={payment !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('rejectTitle')}</DialogTitle>
          <DialogDescription>{t('rejectDesc')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <FormField
            label={t('rejectReason')}
            htmlFor="reject-reason"
            required
            error={errors.reason?.message}
          >
            <Textarea
              id="reject-reason"
              rows={3}
              placeholder="Ví dụ: Số tiền không khớp, sai nội dung chuyển khoản, ảnh biên lai mờ..."
              {...register('reason')}
            />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" variant="danger" disabled={mutation.isPending}>
              {mutation.isPending ? tCommon('loading') : t('rejectConfirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
