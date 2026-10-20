'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';
import type { AdminBookingRow } from '@/lib/api/endpoints/admin';

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
import { useForceCancelBooking } from '@/lib/hooks/useAdminBookings';

const forceCancelSchema = z.object({
  reason: z.string().min(3, 'Vui lòng nhập lý do can thiệp huỷ đơn').max(500),
});

type ForceCancelFormData = z.infer<typeof forceCancelSchema>;

export interface ForceCancelDialogProps {
  booking: AdminBookingRow | null;
  open: boolean;
  onClose: () => void;
}

export function ForceCancelDialog({ booking, open, onClose }: ForceCancelDialogProps) {
  const tCommon = useTranslations('common');
  const cancelMutation = useForceCancelBooking();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ForceCancelFormData>({
    resolver: zodResolver(forceCancelSchema),
    defaultValues: {
      reason: '',
    },
  });

  React.useEffect(() => {
    if (open) {
      reset({ reason: '' });
    }
  }, [open, reset]);

  if (!booking) return null;

  const onSubmit = handleSubmit(async (values) => {
    try {
      await cancelMutation.mutateAsync({
        id: booking.id,
        reason: values.reason.trim(),
      });
      toast.success('Đã cưỡng chế huỷ đơn đặt sân thành công');
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tCommon('error'));
    }
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cưỡng chế huỷ đơn đặt sân</DialogTitle>
          <DialogDescription>
            Bạn đang thực hiện quyền can thiệp quản trị viên đối với đơn hàng{' '}
            <strong className="font-mono">{booking.id}</strong> tại{' '}
            <strong>{booking.venueName}</strong>. Thao tác này sẽ giải phóng khung giờ chơi và ghi vào nhật ký kiểm toán.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4 py-2">
          <FormField
            label="Lý do huỷ đơn bắt buộc"
            htmlFor="cancel-reason"
            required
            error={errors.reason?.message}
          >
            <Textarea
              id="cancel-reason"
              rows={3}
              placeholder="Nhập lý do chi tiết (ví dụ: Tranh chấp thanh toán, vi phạm điều khoản...)"
              {...register('reason')}
            />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {tCommon('cancel')}
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? tCommon('loading') : 'Xác nhận cưỡng chế huỷ'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
