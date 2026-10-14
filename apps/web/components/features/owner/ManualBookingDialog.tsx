'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { SLOT_MINUTES, createManualBookingSchema } from '@bsc/shared';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api/errors';
import { useCreateManualBooking } from '@/lib/hooks/useOwnerMutations';
import { formatDateWithWeekday, formatTimeRange } from '@/lib/utils/format';

/** Khoảng giờ vừa kéo chọn trên lưới. */
export interface ManualBookingRange {
  courtId: string;
  courtName: string;
  start: string;
  end: string;
}

// Court và khung giờ đã có từ lúc kéo chọn, nên form chỉ hỏi phần còn lại.
const formSchema = createManualBookingSchema.pick({
  guestName: true,
  guestPhone: true,
  note: true,
});
type FormInput = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

const OFFSET_MS = 7 * 60 * 60 * 1000;

/** Cắt khoảng kéo chọn thành từng block SLOT_MINUTES, giữ múi giờ +07:00. */
function splitIntoSlots(start: string, end: string) {
  const slots: Array<{ start: string; end: string }> = [];
  const step = SLOT_MINUTES * 60 * 1000;
  const toIso = (ms: number) => `${new Date(ms + OFFSET_MS).toISOString().slice(0, 19)}+07:00`;

  for (let cursor = new Date(start).getTime(); cursor < new Date(end).getTime(); cursor += step) {
    slots.push({ start: toIso(cursor), end: toIso(cursor + step) });
  }
  return slots;
}

interface ManualBookingDialogProps {
  range: ManualBookingRange | null;
  onClose: () => void;
}

export function ManualBookingDialog({ range, onClose }: ManualBookingDialogProps) {
  const t = useTranslations('owner');
  const mutation = useCreateManualBooking();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: { guestName: '', guestPhone: '', note: '' },
  });

  // Mỗi lần mở cho khoảng giờ mới thì xoá dữ liệu của lần trước.
  React.useEffect(() => {
    if (range) reset({ guestName: '', guestPhone: '', note: '' });
  }, [range, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (!range) return;
    try {
      await mutation.mutateAsync({
        courtId: range.courtId,
        slots: splitIntoSlots(range.start, range.end),
        guestName: values.guestName,
        guestPhone: values.guestPhone,
        note: values.note || undefined,
      });
      toast.success(t('manualBookingSuccess'));
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t('manualBookingFailed'));
    }
  });

  return (
    <Dialog open={range !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('manualBookingTitle')}</DialogTitle>
          {range && (
            <DialogDescription>
              {range.courtName} · {formatDateWithWeekday(range.start)} ·{' '}
              {formatTimeRange(range.start, range.end)}
            </DialogDescription>
          )}
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <FormField
            label={t('manualGuestName')}
            htmlFor="manual-guest-name"
            required
            error={errors.guestName?.message}
          >
            <Input id="manual-guest-name" autoComplete="off" {...register('guestName')} />
          </FormField>

          <FormField
            label={t('manualGuestPhone')}
            htmlFor="manual-guest-phone"
            required
            error={errors.guestPhone?.message}
          >
            <Input
              id="manual-guest-phone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              {...register('guestPhone')}
            />
          </FormField>

          <FormField label={t('manualNote')} htmlFor="manual-note" error={errors.note?.message}>
            <Textarea id="manual-note" rows={3} {...register('note')} />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('manualCancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t('manualBookingSubmitting') : t('manualBookingSubmit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
