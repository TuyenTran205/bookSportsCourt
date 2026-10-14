'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreditCard, Save, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import {
  bankAccountSchema,
  cancellationPolicySchema,
  type BankAccountInfo,
  type CancellationPolicy,
} from '@bsc/shared';
import type { z } from 'zod';

import { ErrorState } from '@/components/common/ErrorState';
import { FormField } from '@/components/common/FormField';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/errors';
import {
  useOwnerBankAccount,
  useUpdateBankAccount,
  useUpdateCancellationPolicy,
} from '@/lib/hooks/useOwnerSettings';

const POPULAR_BANKS = [
  { bin: '970436', name: 'Vietcombank (VCB)' },
  { bin: '970407', name: 'Techcombank (TCB)' },
  { bin: '970422', name: 'MBBank (Quân Đội)' },
  { bin: '970418', name: 'BIDV (Đầu tư & Phát triển)' },
  { bin: '970415', name: 'VietinBank (Công Thương)' },
  { bin: '970416', name: 'ACB (Á Châu)' },
  { bin: '970423', name: 'TPBank (Tiên Phong)' },
  { bin: '970432', name: 'VPBank (Việt Nam Thịnh Vượng)' },
];

type BankAccountFormData = z.infer<typeof bankAccountSchema>;
type CancellationPolicyFormData = z.infer<typeof cancellationPolicySchema>;

export function OwnerSettingsScreen() {
  const t = useTranslations('owner');
  const tCommon = useTranslations('common');

  const bankAccountQuery = useOwnerBankAccount();
  const updateBankMutation = useUpdateBankAccount();
  const updatePolicyMutation = useUpdateCancellationPolicy();

  // Form 1: Ngân hàng
  const {
    register: registerBank,
    handleSubmit: handleSubmitBank,
    setValue: setBankValue,
    reset: resetBank,
    formState: { errors: bankErrors },
  } = useForm<BankAccountFormData>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues: {
      bankBin: '970436',
      bankName: 'Vietcombank (VCB)',
      accountNo: '',
      accountName: '',
    },
  });

  // Form 2: Chính sách huỷ
  const {
    register: registerPolicy,
    handleSubmit: handleSubmitPolicy,
    formState: { errors: policyErrors },
  } = useForm<CancellationPolicyFormData>({
    resolver: zodResolver(cancellationPolicySchema),
    defaultValues: {
      depositPercent: 30,
      cancelBeforeHours: 24,
      refundPercent: 100,
    },
  });

  React.useEffect(() => {
    if (bankAccountQuery.data) {
      const b = bankAccountQuery.data;
      resetBank({
        bankBin: b.bankBin || '970436',
        bankName: (b as { bankName?: string }).bankName || 'Vietcombank (VCB)',
        accountNo: b.accountNo || '',
        accountName: b.accountName || '',
      });
    }
  }, [bankAccountQuery.data, resetBank]);

  const onBankChange = (bin: string) => {
    const found = POPULAR_BANKS.find((b) => b.bin === bin);
    if (found) {
      setBankValue('bankBin', found.bin, { shouldValidate: true });
      setBankValue('bankName', found.name, { shouldValidate: true });
    }
  };

  const onSubmitBank = handleSubmitBank(async (values) => {
    try {
      await updateBankMutation.mutateAsync({
        bankBin: values.bankBin,
        accountNo: values.accountNo,
        accountName: values.accountName.toUpperCase(),
      });
      toast.success(t('saveSettingsSuccess'));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tCommon('error'));
    }
  });

  const onSubmitPolicy = handleSubmitPolicy(async (values) => {
    try {
      await updatePolicyMutation.mutateAsync(values);
      toast.success('Đã lưu chính sách huỷ & đặt cọc');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tCommon('error'));
    }
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader title={t('settingsTitle')} description={t('settingsDesc')} />

      {bankAccountQuery.isPending ? (
        <div className="mt-6 flex flex-col gap-6">
          <Skeleton className="h-64 w-full rounded-card" />
          <Skeleton className="h-64 w-full rounded-card" />
        </div>
      ) : bankAccountQuery.isError ? (
        <div className="mt-6">
          <ErrorState
            error={bankAccountQuery.error}
            onRetry={() => void bankAccountQuery.refetch()}
          />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Card 1: Tài khoản ngân hàng nhận tiền */}
          <Card className="flex flex-col p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2.5 border-b border-neutral-100 pb-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                <CreditCard className="size-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-neutral-900">
                  {t('bankAccountSection')}
                </h3>
                <p className="text-xs text-neutral-500">
                  Khách hàng sẽ quét mã QR chuyển khoản tới tài khoản này khi đặt cọc sân trực tuyến.
                </p>
              </div>
            </div>

            <form onSubmit={onSubmitBank} className="flex flex-1 flex-col gap-4">
              <FormField
                label={t('bankName')}
                htmlFor="bank-bin"
                required
                error={bankErrors.bankBin?.message}
              >
                <NativeSelect
                  id="bank-bin"
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onBankChange(e.target.value)}
                  defaultValue="970436"
                >
                  {POPULAR_BANKS.map((b) => (
                    <option key={b.bin} value={b.bin}>
                      {b.name}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>

              <FormField
                label={t('accountNo')}
                htmlFor="account-no"
                required
                error={bankErrors.accountNo?.message}
              >
                <Input
                  id="account-no"
                  placeholder="Ví dụ: 0071000123456"
                  className="tabular-nums"
                  {...registerBank('accountNo')}
                />
              </FormField>

              <FormField
                label={t('accountName')}
                htmlFor="account-name"
                required
                error={bankErrors.accountName?.message}
              >
                <Input
                  id="account-name"
                  placeholder="Ví dụ: NGUYEN VAN A"
                  className="uppercase"
                  {...registerBank('accountName')}
                />
              </FormField>

              <div className="mt-auto pt-4">
                <Button
                  type="submit"
                  disabled={updateBankMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  <Save className="mr-1.5 size-4" aria-hidden="true" />
                  {updateBankMutation.isPending ? tCommon('loading') : t('saveSettings')}
                </Button>
              </div>
            </form>
          </Card>

          {/* Card 2: Chính sách huỷ & Đặt cọc */}
          <Card className="flex flex-col p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2.5 border-b border-neutral-100 pb-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <ShieldAlert className="size-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-neutral-900">
                  {t('cancellationPolicySection')}
                </h3>
                <p className="text-xs text-neutral-500">
                  Quy định tỷ lệ đặt cọc tối thiểu và điều kiện hoàn tiền khi khách huỷ đơn.
                </p>
              </div>
            </div>

            <form onSubmit={onSubmitPolicy} className="flex flex-1 flex-col gap-4">
              <FormField
                label="Tỷ lệ cọc yêu cầu (%)"
                htmlFor="deposit-percent"
                required
                error={policyErrors.depositPercent?.message}
              >
                <div className="relative">
                  <Input
                    id="deposit-percent"
                    type="number"
                    min="0"
                    max="100"
                    className="pr-10 tabular-nums"
                    {...registerPolicy('depositPercent', { valueAsNumber: true })}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-neutral-400">
                    %
                  </span>
                </div>
              </FormField>

              <FormField
                label="Số giờ huỷ trước giờ chơi tối thiểu"
                htmlFor="cancel-before-hours"
                required
                error={policyErrors.cancelBeforeHours?.message}
              >
                <div className="relative">
                  <Input
                    id="cancel-before-hours"
                    type="number"
                    min="0"
                    max="720"
                    className="pr-12 tabular-nums"
                    {...registerPolicy('cancelBeforeHours', { valueAsNumber: true })}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-neutral-400">
                    giờ
                  </span>
                </div>
              </FormField>

              <FormField
                label="Tỷ lệ hoàn tiền khi huỷ hợp lệ (%)"
                htmlFor="refund-percent"
                required
                error={policyErrors.refundPercent?.message}
              >
                <div className="relative">
                  <Input
                    id="refund-percent"
                    type="number"
                    min="0"
                    max="100"
                    className="pr-10 tabular-nums"
                    {...registerPolicy('refundPercent', { valueAsNumber: true })}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-neutral-400">
                    %
                  </span>
                </div>
              </FormField>

              <div className="mt-auto pt-4">
                <Button
                  type="submit"
                  disabled={updatePolicyMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  <Save className="mr-1.5 size-4" aria-hidden="true" />
                  {updatePolicyMutation.isPending ? tCommon('loading') : 'Lưu chính sách'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
