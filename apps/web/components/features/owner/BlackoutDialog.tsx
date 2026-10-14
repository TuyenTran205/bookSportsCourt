'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';
import { Unlock } from 'lucide-react';
import type { Blackout, Court } from '@bsc/shared';

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
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api/errors';
import { useCreateBlackout } from '@/lib/hooks/useOwnerMutations';
import { formatTime } from '@/lib/utils/format';

const formSchema = z
  .object({
    courtId: z.string().min(1, 'Vui lòng chọn sân cần khoá'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ'),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Giờ không hợp lệ'),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Giờ không hợp lệ'),
    reason: z.string().max(500, 'Lý do tối đa 500 ký tự').optional(),
  })
  .refine((d) => d.startTime < d.endTime, {
    message: 'Giờ kết thúc phải sau giờ bắt đầu',
    path: ['endTime'],
  });

type FormData = z.infer<typeof formSchema>;

export interface BlackoutDialogProps {
  open: boolean;
  onClose: () => void;
  courts: readonly Court[];
  currentDate: string;
  blackouts?: readonly Blackout[];
  onDeleteBlackout?: (courtId: string, blackoutId: string) => Promise<void> | void;
}

export function BlackoutDialog({
  open,
  onClose,
  courts,
  currentDate,
  blackouts = [],
  onDeleteBlackout,
}: BlackoutDialogProps) {
  const t = useTranslations('owner');
  const tCommon = useTranslations('common');
  const mutation = useCreateBlackout();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      courtId: courts[0]?.id ?? '',
      date: currentDate,
      startTime: '08:00',
      endTime: '12:00',
      reason: '',
    },
  });

  // Cập nhật lại giá trị mặc định khi mở modal hoặc đổi ngày
  React.useEffect(() => {
    if (open) {
      reset({
        courtId: courts[0]?.id ?? '',
        date: currentDate,
        startTime: '08:00',
        endTime: '12:00',
        reason: '',
      });
    }
  }, [open, courts, currentDate, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const start = `${values.date}T${values.startTime}:00+07:00`;
      const end = `${values.date}T${values.endTime}:00+07:00`;

      await mutation.mutateAsync({
        courtId: values.courtId,
        start,
        end,
        reason: values.reason?.trim() || undefined,
      });

      toast.success(t('blackoutSuccess'));
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t('blackoutFailed'));
    }
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('blackoutDialogTitle')}</DialogTitle>
          <DialogDescription>{t('timelineHint')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <FormField
            label={t('blackoutCourt')}
            htmlFor="blackout-court"
            required
            error={errors.courtId?.message}
          >
            <NativeSelect id="blackout-court" {...register('courtId')}>
              {courts.map((court) => (
                <option key={court.id} value={court.id}>
                  {court.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>

          <FormField
            label={t('blackoutDate')}
            htmlFor="blackout-date"
            required
            error={errors.date?.message}
          >
            <Input id="blackout-date" type="date" {...register('date')} />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label={t('blackoutStartTime')}
              htmlFor="blackout-start-time"
              required
              error={errors.startTime?.message}
            >
              <Input id="blackout-start-time" type="time" {...register('startTime')} />
            </FormField>

            <FormField
              label={t('blackoutEndTime')}
              htmlFor="blackout-end-time"
              required
              error={errors.endTime?.message}
            >
              <Input id="blackout-end-time" type="time" {...register('endTime')} />
            </FormField>
          </div>

          <FormField
            label={t('blackoutReason')}
            htmlFor="blackout-reason"
            error={errors.reason?.message}
          >
            <Textarea
              id="blackout-reason"
              rows={3}
              placeholder={t('blackoutReasonPlaceholder')}
              {...register('reason')}
            />
          </FormField>

          {blackouts.length > 0 && (
            <div className="mt-2 border-t border-neutral-200 pt-3">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                {t('activeBlackouts')} ({blackouts.length})
              </h4>
              <div className="flex max-h-40 flex-col gap-2 overflow-y-auto pr-1">
                {blackouts.map((bo) => {
                  const courtName = courts.find((c) => c.id === bo.courtId)?.name ?? t('blackoutCourt');
                  return (
                    <div
                      key={bo.id}
                      className="flex items-center justify-between rounded-card border border-neutral-200 bg-neutral-50 p-2 text-xs"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-neutral-900">{courtName}</span>
                        <span className="text-neutral-500">
                          {formatTime(bo.start)} – {formatTime(bo.end)}
                          {bo.reason ? ` • ${bo.reason}` : ''}
                        </span>
                      </div>
                      {onDeleteBlackout && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-danger hover:bg-danger/10 hover:text-danger"
                          onClick={async () => {
                            if (window.confirm(t('unlockConfirm'))) {
                              await onDeleteBlackout(bo.courtId, bo.id);
                            }
                          }}
                        >
                          <Unlock className="mr-1 size-3.5" aria-hidden="true" />
                          {t('unlockCourt')}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t('blackoutSubmitting') : t('blackoutSubmit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
