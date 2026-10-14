'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Tag, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PricingRuleDialog } from '@/components/features/owner/PricingRuleDialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/errors';
import {
  useDeletePricingRule,
  useOwnerPricingRules,
} from '@/lib/hooks/useOwnerPricing';
import { formatCurrency } from '@/lib/utils/format';

const WEEKDAY_NAMES: Record<number, string> = {
  1: 'T2',
  2: 'T3',
  3: 'T4',
  4: 'T5',
  5: 'T6',
  6: 'T7',
  0: 'CN',
};

export interface PricingRulesTabProps {
  venueId: string;
}

export function PricingRulesTab({ venueId }: PricingRulesTabProps) {
  const t = useTranslations('owner');
  const tCommon = useTranslations('common');

  const { data: rules, isPending, isError, error, refetch } = useOwnerPricingRules(venueId);
  const deleteMutation = useDeletePricingRule();

  const [dialogOpen, setDialogOpen] = React.useState(false);

  const handleDelete = async (ruleId: string, ruleLabel: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xoá khung giá "${ruleLabel}"?`)) return;
    try {
      await deleteMutation.mutateAsync(ruleId);
      toast.success(t('deletePricingRuleSuccess'));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tCommon('error'));
    }
  };

  const formatWeekdays = (days: number[]) => {
    return days
      .slice()
      .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
      .map((d) => WEEKDAY_NAMES[d] ?? d)
      .join(', ');
  };

  if (isPending) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-card" />
        ))}
      </div>
    );
  }

  if (isError) {
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-card border border-neutral-200 bg-white p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between border-b border-neutral-100 pb-3">
          <div>
            <h3 className="text-base font-semibold text-neutral-900">
              {t('pricingRulesTitle')}
            </h3>
            <p className="text-xs text-neutral-500">
              Quy tắc giá theo khung giờ và ngày trong tuần. Khung giờ nào không khớp quy tắc sẽ áp dụng giá cơ bản.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setDialogOpen(true)}
            size="sm"
          >
            <Plus className="mr-1.5 size-4" aria-hidden="true" />
            {t('addPricingRule')}
          </Button>
        </div>

        {(!rules || rules.length === 0) ? (
          <EmptyState
            icon={Tag}
            title={t('noPricingRules')}
            description="Chưa có khung giá đặc biệt nào được tạo. Hãy thêm khung giá giờ cao điểm hoặc cuối tuần."
            action={
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-1.5 size-4" aria-hidden="true" />
                {t('addPricingRule')}
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-xs font-semibold uppercase text-neutral-500">
                  <th className="py-3 pr-4">Tên khung giá</th>
                  <th className="py-3 px-4">Ngày áp dụng</th>
                  <th className="py-3 px-4">Khung giờ</th>
                  <th className="py-3 px-4 text-right">Đơn giá / 30p</th>
                  <th className="py-3 px-4 text-right">Đơn giá / giờ</th>
                  <th className="py-3 pl-4 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-neutral-50/50">
                    <td className="py-3.5 pr-4 font-semibold text-neutral-900">
                      {rule.label}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-neutral-600">
                      <span className="rounded bg-neutral-100 px-2 py-0.5 font-medium">
                        {formatWeekdays(rule.weekdays)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-neutral-700">
                      {rule.startTime} – {rule.endTime}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium tabular-nums text-neutral-900">
                      {formatCurrency(rule.pricePerSlot)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold tabular-nums text-primary-700">
                      {formatCurrency(rule.pricePerSlot * 2)}
                    </td>
                    <td className="py-3.5 pl-4 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={deleteMutation.isPending}
                        onClick={() => handleDelete(rule.id, rule.label)}
                        className="text-danger hover:bg-danger/10 hover:text-danger"
                        title={t('deletePricingRule')}
                        aria-label={t('deletePricingRule')}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PricingRuleDialog
        venueId={venueId}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}
