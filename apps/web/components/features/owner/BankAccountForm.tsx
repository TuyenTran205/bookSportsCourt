'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Building2, Save } from 'lucide-react';

import type { BankAccountInfo } from '@bsc/shared';
import { ErrorState } from '@/components/common/ErrorState';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { getBankAccount, listOwnerVenues, updateBankAccount } from '@/lib/api/endpoints/owner';
import { bankNameFromBin, SUPPORTED_BANKS } from '@/lib/utils/payment-qr';

const EMPTY_ACCOUNT: BankAccountInfo = { bankBin: '', accountNo: '', accountName: '' };

export function BankAccountForm() {
  const t = useTranslations('owner');
  const queryClient = useQueryClient();
  const [venueId, setVenueId] = React.useState('');
  const [account, setAccount] = React.useState<BankAccountInfo>(EMPTY_ACCOUNT);

  const venuesQuery = useQuery({
    queryKey: ['owner', 'venues'],
    queryFn: listOwnerVenues,
    staleTime: 60_000,
  });

  React.useEffect(() => {
    if (!venueId && venuesQuery.data?.length) {
      setVenueId(venuesQuery.data[0]!.id);
    }
  }, [venueId, venuesQuery.data]);

  const accountQuery = useQuery({
    queryKey: ['owner', 'venues', venueId, 'payment-account'],
    queryFn: () => getBankAccount(venueId),
    enabled: Boolean(venueId),
  });

  React.useEffect(() => {
    if (accountQuery.isSuccess) {
      setAccount(accountQuery.data ?? EMPTY_ACCOUNT);
    }
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

  const venues = venuesQuery.data ?? [];

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
          {t('settingsTitle')}
        </h1>
        <p className="mt-1 text-sm text-neutral-600">{t('settingsDesc')}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t('bankAccountSection')}</CardTitle>
          <p className="text-sm text-neutral-600">{t('bankAccountVenueHint')}</p>
        </CardHeader>
        <CardContent className="space-y-5">
          {venuesQuery.isLoading ? (
            <div className="space-y-4" aria-label={t('loadingSettings')}>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : venuesQuery.isError ? (
            <ErrorState error={venuesQuery.error} onRetry={() => void venuesQuery.refetch()} />
          ) : venues.length === 0 ? (
            <div className="rounded-card border border-dashed border-neutral-300 bg-neutral-50 p-6">
              <div className="flex items-start gap-3">
                <Building2 className="mt-0.5 size-5 shrink-0 text-neutral-500" aria-hidden="true" />
                <div className="space-y-3">
                  <div>
                    <p className="font-medium text-neutral-900">{t('noVenueForBankTitle')}</p>
                    <p className="mt-1 text-sm text-neutral-600">{t('noVenueForBankDesc')}</p>
                  </div>
                  <Button asChild variant="outline">
                    <Link href="/owner/venues">{t('goToVenues')}</Link>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <FormField label={t('selectVenue')} htmlFor="payment-account-venue" required>
                <NativeSelect
                  id="payment-account-venue"
                  value={venueId}
                  onChange={(event) => {
                    setAccount(EMPTY_ACCOUNT);
                    setVenueId(event.target.value);
                  }}
                  disabled={saveMutation.isPending}
                >
                  {venues.map((venue) => (
                    <option key={venue.id} value={venue.id}>
                      {venue.name}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>

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
                  className="space-y-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    saveMutation.mutate();
                  }}
                >
                  <FormField label={t('bankBin')} htmlFor="bankBin" required>
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
                    <p className="-mt-3 text-xs text-neutral-500">
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
                      maxLength={100}
                      autoComplete="name"
                      value={account.accountName}
                      onChange={(event) =>
                        setAccount((current) => ({ ...current, accountName: event.target.value }))
                      }
                      disabled={saveMutation.isPending}
                    />
                  </FormField>
                  <div className="flex flex-col gap-3 border-t border-neutral-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-neutral-500">{t('bankAccountSecurityHint')}</p>
                    <Button
                      type="submit"
                      loading={saveMutation.isPending}
                      disabled={!accountQuery.isSuccess}
                    >
                      <Save aria-hidden="true" />
                      {t('saveSettings')}
                    </Button>
                  </div>
                </form>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
