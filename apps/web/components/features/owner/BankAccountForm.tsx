'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cancellationPolicySchema } from '@bsc/shared';
import type { BankAccountInfo, CancellationPolicy } from '@bsc/shared';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Building2, Save, ShieldCheck, WalletCards } from 'lucide-react';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getBankAccount,
  getCancellationPolicy,
  listOwnerVenues,
  updateBankAccount,
  updateCancellationPolicy,
} from '@/lib/api/endpoints/owner';
import { bankNameFromBin, SUPPORTED_BANKS } from '@/lib/utils/payment-qr';

const EMPTY_ACCOUNT: BankAccountInfo = { bankBin: '', accountNo: '', accountName: '' };
const EMPTY_VENUES: Awaited<ReturnType<typeof listOwnerVenues>> = [];
const DEFAULT_POLICY: CancellationPolicy = {
  cancelBeforeHours: 24,
  refundPercent: 100,
  depositPercent: 30,
};

interface CancellationPolicyFormState {
  cancelBeforeHours: string;
  refundPercent: string;
  depositPercent: string;
}

function policyFormState(policy: CancellationPolicy | null): CancellationPolicyFormState {
  const value = policy ?? DEFAULT_POLICY;
  return {
    cancelBeforeHours: String(value.cancelBeforeHours),
    refundPercent: String(value.refundPercent),
    depositPercent: String(value.depositPercent),
  };
}

export function BankAccountForm() {
  const t = useTranslations('owner');
  const [venueId, setVenueId] = React.useState('');
  const venuesQuery = useQuery({
    queryKey: ['owner', 'venues'],
    queryFn: listOwnerVenues,
    staleTime: 60_000,
  });
  const venues = venuesQuery.data ?? EMPTY_VENUES;

  React.useEffect(() => {
    if (!venueId && venues.length > 0) setVenueId(venues[0]!.id);
  }, [venueId, venues]);

  return (
    <main className="w-full min-w-0 space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
          {t('settingsTitle')}
        </h1>
        <p className="mt-1 text-sm text-neutral-600">{t('settingsDesc')}</p>
      </header>

      {venuesQuery.isLoading ? (
        <div className="space-y-5" aria-label={t('loadingSettings')}>
          <Skeleton className="h-10 w-full max-w-sm" />
          <div className="grid gap-4 lg:grid-cols-2">
            <SettingsCardSkeleton />
            <SettingsCardSkeleton />
          </div>
        </div>
      ) : venuesQuery.isError ? (
        <ErrorState error={venuesQuery.error} onRetry={() => void venuesQuery.refetch()} />
      ) : venues.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={t('noVenueForBankTitle')}
          description={t('noVenueForBankDesc')}
          action={
            <Button asChild variant="outline">
              <Link href="/owner/venues">{t('goToVenues')}</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="max-w-md">
            <FormField label={t('selectVenue')} htmlFor="settings-venue" required>
              <NativeSelect
                id="settings-venue"
                value={venueId}
                onChange={(event) => setVenueId(event.target.value)}
                aria-label={t('selectVenue')}
              >
                {venues.map((venue) => (
                  <option key={venue.id} value={venue.id}>
                    {venue.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          </div>

          {venueId && (
            <div className="grid items-start gap-4 lg:grid-cols-2 xl:gap-6">
              <BankAccountCard key={venueId} venueId={venueId} />
              <CancellationPolicyCard key={venueId} venueId={venueId} />
            </div>
          )}
        </>
      )}
    </main>
  );
}

function SettingsCardSkeleton() {
  return (
    <Card className="space-y-4 p-4 sm:p-6" aria-hidden="true">
      <Skeleton className="h-6 w-56" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-28" />
    </Card>
  );
}

function SettingsCardHeader({
  icon: Icon,
  title,
  description,
  tone,
}: {
  icon: typeof WalletCards;
  title: string;
  description: string;
  tone: 'primary' | 'warning';
}) {
  return (
    <CardHeader className="flex-row items-center gap-3 border-b border-neutral-100 p-4 sm:p-5">
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-card ${
          tone === 'primary' ? 'bg-primary-100 text-primary-700' : 'bg-warning/10 text-warning'
        }`}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        <p className="mt-0.5 text-xs leading-5 text-neutral-500">{description}</p>
      </div>
    </CardHeader>
  );
}

function BankAccountCard({ venueId }: { venueId: string }) {
  const t = useTranslations('owner');
  const queryClient = useQueryClient();
  const [account, setAccount] = React.useState<BankAccountInfo>(EMPTY_ACCOUNT);
  const accountQuery = useQuery({
    queryKey: ['owner', 'venues', venueId, 'payment-account'],
    queryFn: () => getBankAccount(venueId),
    staleTime: 60_000,
  });

  React.useEffect(() => {
    if (accountQuery.isSuccess) setAccount(accountQuery.data ?? EMPTY_ACCOUNT);
  }, [accountQuery.data, accountQuery.isSuccess]);

  const saveMutation = useMutation({
    mutationFn: () => updateBankAccount(venueId, account),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['owner', 'venues', venueId, 'payment-account'],
      });
      toast.success(t('saveBankSuccess'));
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('saveSettingsFailed'));
    },
  });

  return (
    <Card>
      <SettingsCardHeader
        icon={WalletCards}
        title={t('bankAccountSection')}
        description={t('bankAccountVenueHint')}
        tone="primary"
      />
      <CardContent className="space-y-4 p-4 sm:p-5">
        {accountQuery.isLoading ? (
          <div className="space-y-4" aria-label={t('loadingSettings')}>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : accountQuery.isError ? (
          <ErrorState error={accountQuery.error} onRetry={() => void accountQuery.refetch()} />
        ) : (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              saveMutation.mutate();
            }}
          >
            <FormField label={t('bankName')} htmlFor="bankBin" required>
              <NativeSelect
                id="bankBin"
                required
                value={account.bankBin}
                onChange={(event) =>
                  setAccount((current) => ({ ...current, bankBin: event.target.value }))
                }
                disabled={saveMutation.isPending}
              >
                <option value="">{t('bankPlaceholder')}</option>
                {SUPPORTED_BANKS.map((bank) => (
                  <option key={bank.bin} value={bank.bin}>
                    {bank.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            {account.bankBin && (
              <p className="-mt-2 text-xs text-neutral-500">
                {t('bankSelected', { bank: bankNameFromBin(account.bankBin) })}
              </p>
            )}
            <FormField
              label={t('accountNo')}
              htmlFor="accountNo"
              required
              hint={t('accountNumberHint')}
            >
              <Input
                id="accountNo"
                required
                inputMode="numeric"
                pattern="[0-9]{6,20}"
                maxLength={20}
                autoComplete="off"
                value={account.accountNo}
                onChange={(event) =>
                  setAccount((current) => ({ ...current, accountNo: event.target.value }))
                }
                disabled={saveMutation.isPending}
              />
            </FormField>
            <FormField label={t('accountName')} htmlFor="accountName" required>
              <Input
                id="accountName"
                required
                minLength={2}
                maxLength={100}
                autoComplete="name"
                value={account.accountName}
                onChange={(event) =>
                  setAccount((current) => ({ ...current, accountName: event.target.value }))
                }
                disabled={saveMutation.isPending}
              />
            </FormField>
            <div className="border-t border-neutral-200 pt-3">
              <p className="mb-3 text-xs text-neutral-500">{t('bankAccountSecurityHint')}</p>
              <Button type="submit" loading={saveMutation.isPending} disabled={!accountQuery.isSuccess}>
                <Save aria-hidden="true" />
                {t('saveSettings')}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function CancellationPolicyCard({ venueId }: { venueId: string }) {
  const t = useTranslations('owner');
  const queryClient = useQueryClient();
  const [policy, setPolicy] = React.useState<CancellationPolicyFormState>(
    () => policyFormState(null),
  );
  const [fieldErrors, setFieldErrors] = React.useState<
    Partial<Record<keyof CancellationPolicyFormState, string>>
  >({});
  const policyQuery = useQuery({
    queryKey: ['owner', 'venues', venueId, 'cancellation-policy'],
    queryFn: () => getCancellationPolicy(venueId),
    staleTime: 60_000,
  });

  React.useEffect(() => {
    if (policyQuery.isSuccess) {
      setPolicy(policyFormState(policyQuery.data));
      setFieldErrors({});
    }
  }, [policyQuery.data, policyQuery.isSuccess]);

  const saveMutation = useMutation({
    mutationFn: (input: CancellationPolicy) => updateCancellationPolicy(venueId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['owner', 'venues', venueId, 'cancellation-policy'],
      });
      toast.success(t('savePolicySuccess'));
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('savePolicyFailed'));
    },
  });

  const updateField = (field: keyof CancellationPolicyFormState, value: string) => {
    setPolicy((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submitPolicy = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = cancellationPolicySchema.safeParse({
      cancelBeforeHours: policy.cancelBeforeHours.trim() ? policy.cancelBeforeHours : Number.NaN,
      refundPercent: policy.refundPercent.trim() ? policy.refundPercent : Number.NaN,
      depositPercent: policy.depositPercent.trim() ? policy.depositPercent : Number.NaN,
    });

    if (!parsed.success) {
      const nextErrors: typeof fieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (
          (field === 'cancelBeforeHours' || field === 'refundPercent' || field === 'depositPercent') &&
          !nextErrors[field]
        ) {
          nextErrors[field] = issue.message;
        }
      }
      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});
    saveMutation.mutate(parsed.data);
  };

  return (
    <Card>
      <SettingsCardHeader
        icon={ShieldCheck}
        title={t('cancellationPolicySection')}
        description={t('cancellationPolicyHint')}
        tone="warning"
      />
      <CardContent className="space-y-4 p-4 sm:p-5">
        {policyQuery.isLoading ? (
          <div className="space-y-4" aria-label={t('loadingSettings')}>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : policyQuery.isError ? (
          <ErrorState error={policyQuery.error} onRetry={() => void policyQuery.refetch()} />
        ) : (
          <form className="space-y-3" onSubmit={submitPolicy} noValidate>
            <FormField
              label={t('depositPercent')}
              htmlFor="depositPercent"
              required
              error={fieldErrors.depositPercent}
            >
              <NumberInputWithUnit
                id="depositPercent"
                value={policy.depositPercent}
                min={0}
                max={100}
                error={fieldErrors.depositPercent}
                disabled={saveMutation.isPending}
                unit="%"
                onChange={(value) => updateField('depositPercent', value)}
              />
            </FormField>
            <FormField
              label={t('cancelBeforeHours')}
              htmlFor="cancelBeforeHours"
              required
              error={fieldErrors.cancelBeforeHours}
            >
              <NumberInputWithUnit
                id="cancelBeforeHours"
                value={policy.cancelBeforeHours}
                min={0}
                max={720}
                error={fieldErrors.cancelBeforeHours}
                disabled={saveMutation.isPending}
                unit={t('hoursUnit')}
                onChange={(value) => updateField('cancelBeforeHours', value)}
              />
            </FormField>
            <FormField
              label={t('refundPercent')}
              htmlFor="refundPercent"
              required
              error={fieldErrors.refundPercent}
            >
              <NumberInputWithUnit
                id="refundPercent"
                value={policy.refundPercent}
                min={0}
                max={100}
                error={fieldErrors.refundPercent}
                disabled={saveMutation.isPending}
                unit="%"
                onChange={(value) => updateField('refundPercent', value)}
              />
            </FormField>
            <div className="border-t border-neutral-200 pt-3">
              <Button type="submit" loading={saveMutation.isPending} disabled={!policyQuery.isSuccess}>
                <Save aria-hidden="true" />
                {t('savePolicy')}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function NumberInputWithUnit({
  id,
  value,
  min,
  max,
  error,
  disabled,
  unit,
  onChange,
}: {
  id: string;
  value: string;
  min: number;
  max: number;
  error?: string;
  disabled: boolean;
  unit: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        required
        value={value}
        aria-invalid={Boolean(error)}
        disabled={disabled}
        className="pr-12 tabular-nums"
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-neutral-500">
        {unit}
      </span>
    </div>
  );
}
