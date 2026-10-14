'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { pricingRuleSchema, type PricingRule } from '@bsc/shared';
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
import { ApiError } from '@/lib/api/errors';
import { useCreatePricingRule } from '@/lib/hooks/useOwnerPricing';

const WEEKDAYS = [
  { weekday: 1, label: 'Thứ 2' },
  { weekday: 2, label: 'Thứ 3' },
  { weekday: 3, label: 'Thứ 4' },
  { weekday: 4, label: 'Thứ 5' },
  { weekday: 5, label: 'Thứ 6' },
  { weekday: 6, label: 'Thứ 7' },
  { weekday: 0, label: 'Chủ nhật' },
];

type PricingRuleFormData = z.infer<typeof pricingRuleSchema>;

export interface PricingRuleDialogProps {
  venueId: string;
  open: boolean;
  onClose: () => void;
}

export function PricingRuleDialog({ venueId, open, onClose }: PricingRuleDialogProps) {
  const t = useTranslations('owner');
  const tCommon = useTranslations('common');

  const createMutation = useCreatePricingRule();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<PricingRuleFormData>({
    resolver: zodResolver(pricingRuleSchema),
    defaultValues: {
      label: '',
      weekdays: [1, 2, 3, 4, 5],
      startTime: '17:00',
      endTime: '22:00',
      pricePerSlot: 60000,
    },
  });

  const selectedWeekdays = watch('weekdays') || [];

  React.useEffect(() => {
    if (open) {
      reset({
        label: '',
        weekdays: [1, 2, 3, 4, 5],
        startTime: '17:00',
        endTime: '22:00',
        pricePerSlot: 60000,
      });
    }
  }, [open, reset]);

  const toggleWeekday = (w: number) => {
    const current = selectedWeekdays;
    if (current.includes(w)) {
      if (current.length === 1) {
        toast.error('Phải chọn ít nhất một ngày trong tuần');
        return;
      }
      setValue(
        'weekdays',
        current.filter((x) => x !== w),
        { shouldValidate: true },
      );
    } else {
      setValue('weekdays', [...current, w].sort(), { shouldValidate: true });
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createMutation.mutateAsync({
        venueId,
        input: {
          label: values.label,
          weekdays: values.weekdays,
          startTime: values.startTime,
          endTime: values.endTime,
          pricePerSlot: values.pricePerSlot,
          courtId: null,
        },
      });
      toast.success(t('createPricingRuleSuccess'));
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tCommon('error'));
    }
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('addPricingRule')}</DialogTitle>
          <DialogDescription>
            Định nghĩa mức giá theo khung giờ và ngày trong tuần. Giá áp dụng cho mỗi block 30 phút.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <FormField
            label={t('ruleLabel')}
            htmlFor="rule-label"
            required
            error={errors.label?.message}
          >
            <Input
              id="rule-label"
              placeholder="Ví dụ: Giờ vàng buổi tối, Cuối tuần..."
              {...register('label')}
            />
          </FormField>

          <FormField
            label={t('ruleWeekdays')}
            htmlFor="rule-weekdays"
            required
            error={errors.weekdays?.message}
          >
            <div className="flex flex-wrap gap-1.5 pt-1">
              {WEEKDAYS.map(({ weekday, label }) => {
                const checked = selectedWeekdays.includes(weekday);
                return (
                  <button
                    key={weekday}
                    type="button"
                    onClick={() => toggleWeekday(weekday)}
                    className={`rounded-btn px-2.5 py-1 text-xs font-medium transition-colors ${
                      checked
                        ? 'bg-primary-600 text-white'
                        : 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label={t('ruleStartTime')}
              htmlFor="rule-start-time"
              required
              error={errors.startTime?.message}
            >
              <Input
                id="rule-start-time"
                type="time"
                {...register('startTime')}
              />
            </FormField>

            <FormField
              label={t('ruleEndTime')}
              htmlFor="rule-end-time"
              required
              error={errors.endTime?.message}
            >
              <Input
                id="rule-end-time"
                type="time"
                {...register('endTime')}
              />
            </FormField>
          </div>

          <FormField
            label={t('rulePricePerSlot')}
            htmlFor="rule-price"
            required
            error={errors.pricePerSlot?.message}
          >
            <div className="relative">
              <Input
                id="rule-price"
                type="number"
                step="5000"
                placeholder="60000"
                className="pr-16 tabular-nums"
                {...register('pricePerSlot', { valueAsNumber: true })}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-neutral-400">
                đ / 30p
              </span>
            </div>
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? tCommon('loading') : tCommon('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
