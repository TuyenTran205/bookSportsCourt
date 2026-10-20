'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PricingRule } from '@bsc/shared';

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

interface PricingRuleDialogProps {
  open: boolean;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (rule: Omit<PricingRule, 'id' | 'venueId'>) => void;
}

export function PricingRuleDialog({
  open,
  saving,
  onOpenChange,
  onSubmit,
}: PricingRuleDialogProps) {
  const t = useTranslations('owner');
  const [label, setLabel] = React.useState('');
  const [weekdays, setWeekdays] = React.useState<number[]>(WEEKDAYS);
  const [startTime, setStartTime] = React.useState('06:00');
  const [endTime, setEndTime] = React.useState('17:00');
  const [price, setPrice] = React.useState('');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    setLabel('');
    setWeekdays(WEEKDAYS);
    setStartTime('06:00');
    setEndTime('17:00');
    setPrice('');
    setError('');
  }, [open]);

  const toggleWeekday = (weekday: number) => {
    setWeekdays((current) =>
      current.includes(weekday)
        ? current.filter((day) => day !== weekday)
        : [...current, weekday].sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b)),
    );
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const numericPrice = Number(price);
    if (!label.trim()) {
      setError(t('ruleLabelRequired'));
      return;
    }
    if (weekdays.length === 0) {
      setError(t('ruleDaysRequired'));
      return;
    }
    if (!startTime || !endTime || startTime >= endTime) {
      setError(t('ruleTimeInvalid'));
      return;
    }
    if (!Number.isSafeInteger(numericPrice) || numericPrice < 0) {
      setError(t('rulePriceInvalid'));
      return;
    }
    setError('');
    onSubmit({
      courtId: null,
      label: label.trim(),
      weekdays,
      startTime,
      endTime,
      pricePerSlot: numericPrice,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-5 sm:p-6" closeLabel={t('close')}>
        <DialogHeader>
          <DialogTitle>{t('addPricingRule')}</DialogTitle>
          <DialogDescription>{t('pricingRuleFormDescription')}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit} noValidate>
          <label className="block space-y-1.5 text-sm font-medium text-neutral-700">
            <span>{t('ruleLabel')} <span className="text-danger">*</span></span>
            <Input
              autoFocus
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder={t('ruleLabelPlaceholder')}
              maxLength={100}
              required
            />
          </label>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-neutral-700">
              {t('ruleWeekdays')} <span className="text-danger">*</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((weekday) => {
                const selected = weekdays.includes(weekday);
                return (
                  <button
                    key={weekday}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleWeekday(weekday)}
                    className={`min-h-9 rounded-btn border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 ${
                      selected
                        ? 'border-primary-700 bg-primary-700 text-white'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    {t(`weekday${weekday}`)}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5 text-sm font-medium text-neutral-700">
              <span>{t('ruleStartTime')} <span className="text-danger">*</span></span>
              <Input
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                required
              />
            </label>
            <label className="block space-y-1.5 text-sm font-medium text-neutral-700">
              <span>{t('ruleEndTime')} <span className="text-danger">*</span></span>
              <Input
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                required
              />
            </label>
          </div>

          <label className="block space-y-1.5 text-sm font-medium text-neutral-700">
            <span>{t('rulePricePerSlot')} <span className="text-danger">*</span></span>
            <div className="relative">
              <Input
                type="number"
                min="0"
                step="1000"
                inputMode="numeric"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="80000"
                className="pr-20"
                required
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-neutral-500">
                {t('perBlock')}
              </span>
            </div>
          </label>

          {error && <p role="alert" className="text-sm text-danger">{error}</p>}

          <DialogFooter className="pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              {t('cancelAction')}
            </Button>
            <Button type="submit" loading={saving}>
              {saving ? t('savingVenue') : t('saveVenue')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
