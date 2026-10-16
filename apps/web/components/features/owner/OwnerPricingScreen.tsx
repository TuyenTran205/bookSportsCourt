'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Clock3, DollarSign, Plus, Trash2 } from 'lucide-react';
import type { OpeningHour, PricingRule } from '@bsc/shared';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  createPricingRule,
  deletePricingRule,
  getOpeningHours,
  listOwnerVenues,
  listPricingRules,
  replaceOpeningHours,
} from '@/lib/api/endpoints/owner';
import { formatCurrency } from '@/lib/utils/format';
import { PricingRuleDialog } from './PricingRuleDialog';

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];
type PricingTab = 'hours' | 'prices';

export function OwnerPricingScreen() {
  const t = useTranslations('owner');
  const queryClient = useQueryClient();
  const [selectedVenueId, setSelectedVenueId] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<PricingTab>('hours');
  const [hoursDraft, setHoursDraft] = React.useState<OpeningHour[]>([]);
  const [hoursError, setHoursError] = React.useState('');
  const [ruleDialogOpen, setRuleDialogOpen] = React.useState(false);
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null);

  const venuesQuery = useQuery({
    queryKey: ['owner', 'venues'],
    queryFn: listOwnerVenues,
    staleTime: 30_000,
  });
  const venues = venuesQuery.data ?? [];
  const selectedVenue = venues.find((venue) => venue.id === selectedVenueId);

  React.useEffect(() => {
    if (!venuesQuery.data) return;
    if (!selectedVenueId || !venuesQuery.data.some((venue) => venue.id === selectedVenueId)) {
      setSelectedVenueId(venuesQuery.data[0]?.id ?? '');
    }
  }, [selectedVenueId, venuesQuery.data]);

  const hoursQuery = useQuery({
    queryKey: ['owner', 'opening-hours', selectedVenueId],
    queryFn: () => getOpeningHours(selectedVenueId),
    enabled: Boolean(selectedVenueId),
  });
  const rulesQuery = useQuery({
    queryKey: ['owner', 'pricing-rules', selectedVenueId],
    queryFn: () => listPricingRules(selectedVenueId),
    enabled: Boolean(selectedVenueId),
  });

  React.useEffect(() => {
    if (!selectedVenueId || !hoursQuery.data) return;
    const currentHours = hoursQuery.data.filter(
      (hour) => hour.venueId === selectedVenueId && hour.courtId === null,
    );
    setHoursDraft(
      WEEKDAYS.map((weekday) => {
        const existing = currentHours.find((hour) => hour.weekday === weekday);
        return (
          existing ?? {
            id: `new-${selectedVenueId}-${weekday}`,
            venueId: selectedVenueId,
            courtId: null,
            weekday,
            openTime: '06:00',
            closeTime: '22:00',
            isClosed: false,
          }
        );
      }),
    );
    setHoursError('');
  }, [hoursQuery.data, selectedVenueId]);

  const saveHoursMutation = useMutation({
    mutationFn: () =>
      replaceOpeningHours(
        selectedVenueId,
        hoursDraft.map(({ weekday, openTime, closeTime, isClosed }) => ({
          courtId: null,
          weekday,
          openTime,
          closeTime,
          isClosed,
        })),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['owner', 'opening-hours', selectedVenueId],
      });
      toast.success(t('saveOpeningHoursSuccess'));
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t('saveOpeningHoursFailed')),
  });

  const createRuleMutation = useMutation({
    mutationFn: (input: Omit<PricingRule, 'id' | 'venueId'>) =>
      createPricingRule(selectedVenueId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['owner', 'pricing-rules', selectedVenueId],
      });
      await queryClient.invalidateQueries({ queryKey: ['owner', 'venues'] });
      setRuleDialogOpen(false);
      toast.success(t('createPricingRuleSuccess'));
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t('createPricingRuleFailed')),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: deletePricingRule,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['owner', 'pricing-rules', selectedVenueId],
      });
      await queryClient.invalidateQueries({ queryKey: ['owner', 'venues'] });
      setPendingDeleteId(null);
      toast.success(t('deletePricingRuleSuccess'));
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t('deletePricingRuleFailed')),
  });

  const rules = rulesQuery.data ?? [];
  const weekdayLabels: Record<number, string> = {
    1: t('weekday1'),
    2: t('weekday2'),
    3: t('weekday3'),
    4: t('weekday4'),
    5: t('weekday5'),
    6: t('weekday6'),
    0: t('weekday0'),
  };

  const updateHour = (weekday: number, patch: Partial<OpeningHour>) => {
    setHoursDraft((current) =>
      current.map((hour) => (hour.weekday === weekday ? { ...hour, ...patch } : hour)),
    );
  };

  const saveHours = () => {
    const invalid = hoursDraft.some(
      (hour) => !hour.isClosed && (!hour.openTime || !hour.closeTime || hour.openTime >= hour.closeTime),
    );
    if (invalid || hoursDraft.length !== 7) {
      setHoursError(t('openingHoursInvalid'));
      return;
    }
    setHoursError('');
    saveHoursMutation.mutate();
  };

  if (venuesQuery.isLoading) {
    return (
      <main className="max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <Skeleton className="h-10 w-64" />
        </div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-72 w-full" />
      </main>
    );
  }

  if (venuesQuery.isError) {
    return (
      <main className="max-w-7xl p-4 sm:p-6 lg:p-8">
        <ErrorState error={venuesQuery.error} onRetry={() => void venuesQuery.refetch()} />
      </main>
    );
  }

  if (venues.length === 0) {
    return (
      <main className="max-w-7xl p-4 sm:p-6 lg:p-8">
        <EmptyState
          icon={Clock3}
          title={t('noVenuesForPricingTitle')}
          description={t('noVenuesForPricingDescription')}
          action={
            <Button asChild size="sm">
              <Link href="/owner/venues">{t('goToVenueManagement')}</Link>
            </Button>
          }
        />
      </main>
    );
  }

  return (
    <main className="max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">{t('pricingTitle')}</h1>
          <p className="mt-1 text-sm text-neutral-500">{t('pricingDesc')}</p>
        </div>
        <label className="w-full space-y-1 sm:w-64">
          <span className="sr-only">{t('selectPricingVenue')}</span>
          <NativeSelect
            value={selectedVenueId}
            onChange={(event) => {
              setSelectedVenueId(event.target.value);
              setPendingDeleteId(null);
            }}
            aria-label={t('selectPricingVenue')}
          >
            {venues.map((venue) => (
              <option key={venue.id} value={venue.id}>{venue.name}</option>
            ))}
          </NativeSelect>
        </label>
      </header>

      <div className="flex border-b border-neutral-200" role="tablist" aria-label={t('pricingTitle')}>
        <button
          type="button"
          role="tab"
          id="opening-hours-tab"
          aria-selected={activeTab === 'hours'}
          aria-controls="opening-hours-panel"
          onClick={() => setActiveTab('hours')}
          className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 ${
            activeTab === 'hours'
              ? 'border-primary-600 text-primary-700'
              : 'border-transparent text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <Clock3 className="size-4" aria-hidden="true" />
          {t('openingHoursTab')}
        </button>
        <button
          type="button"
          role="tab"
          id="pricing-rules-tab"
          aria-selected={activeTab === 'prices'}
          aria-controls="pricing-rules-panel"
          onClick={() => setActiveTab('prices')}
          className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 ${
            activeTab === 'prices'
              ? 'border-primary-600 text-primary-700'
              : 'border-transparent text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <DollarSign className="size-4" aria-hidden="true" />
          {t('pricingRulesTab')}
        </button>
      </div>

      {activeTab === 'hours' ? (
        <section
          id="opening-hours-panel"
          role="tabpanel"
          aria-labelledby="opening-hours-tab"
        >
          <Card className="overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-neutral-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div>
                <h2 className="text-base font-semibold text-neutral-900">{t('weeklyHoursTitle')}</h2>
                <p className="mt-1 text-xs text-neutral-500">{t('weeklyHoursDescription')}</p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={saveHours}
                loading={saveHoursMutation.isPending}
                disabled={hoursQuery.isLoading || hoursQuery.isError || !selectedVenue}
              >
                <Clock3 aria-hidden="true" />
                {saveHoursMutation.isPending ? t('savingHours') : t('saveHours')}
              </Button>
            </div>

            {hoursQuery.isLoading ? (
              <div className="space-y-3 p-5" aria-label={t('loadingOpeningHours')}>
                {WEEKDAYS.map((day) => <Skeleton key={day} className="h-10 w-full" />)}
              </div>
            ) : hoursQuery.isError ? (
              <div className="p-5">
                <ErrorState error={hoursQuery.error} onRetry={() => void hoursQuery.refetch()} />
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-sm">
                    <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      <tr>
                        <th scope="col" className="px-4 py-3 sm:px-5">{t('weekdayColumn')}</th>
                        <th scope="col" className="px-4 py-3">{t('statusColumn')}</th>
                        <th scope="col" className="px-4 py-3">{t('openTimeColumn')}</th>
                        <th scope="col" className="px-4 py-3 sm:px-5">{t('closeTimeColumn')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {hoursDraft.map((hour) => (
                        <tr key={hour.weekday} className="hover:bg-neutral-50/60">
                          <th scope="row" className="whitespace-nowrap px-4 py-3 text-left font-medium text-neutral-800 sm:px-5">
                            {weekdayLabels[hour.weekday]}
                          </th>
                          <td className="px-4 py-3">
                            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-xs text-neutral-600">
                              <input
                                type="checkbox"
                                checked={!hour.isClosed}
                                onChange={(event) => updateHour(hour.weekday, { isClosed: !event.target.checked })}
                                className="size-4 accent-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                                aria-label={t('openDayLabel', { day: weekdayLabels[hour.weekday] })}
                              />
                              {hour.isClosed ? t('closedDay') : t('openDay')}
                            </label>
                          </td>
                          <td className="px-4 py-3">
                            <Input
                              type="time"
                              value={hour.openTime}
                              disabled={hour.isClosed}
                              onChange={(event) => updateHour(hour.weekday, { openTime: event.target.value })}
                              aria-label={t('openTimeForDay', { day: weekdayLabels[hour.weekday] })}
                              className="h-9 max-w-40 tabular-nums"
                            />
                          </td>
                          <td className="px-4 py-3 sm:px-5">
                            <Input
                              type="time"
                              value={hour.closeTime}
                              disabled={hour.isClosed}
                              onChange={(event) => updateHour(hour.weekday, { closeTime: event.target.value })}
                              aria-label={t('closeTimeForDay', { day: weekdayLabels[hour.weekday] })}
                              className="h-9 max-w-40 tabular-nums"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {hoursError && <p role="alert" className="px-5 pb-4 text-sm text-danger">{hoursError}</p>}
              </>
            )}
          </Card>
        </section>
      ) : (
        <section
          id="pricing-rules-panel"
          role="tabpanel"
          aria-labelledby="pricing-rules-tab"
        >
          <Card className="overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-neutral-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div>
                <h2 className="text-base font-semibold text-neutral-900">{t('pricingRulesTitle')}</h2>
                <p className="mt-1 text-xs text-neutral-500">{t('pricingRulesDescription')}</p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => setRuleDialogOpen(true)}
                disabled={!selectedVenue}
              >
                <Plus aria-hidden="true" />
                {t('addPricingRule')}
              </Button>
            </div>

            {rulesQuery.isLoading ? (
              <div className="space-y-3 p-5" aria-label={t('loadingPricingRules')}>
                {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}
              </div>
            ) : rulesQuery.isError ? (
              <div className="p-5">
                <ErrorState error={rulesQuery.error} onRetry={() => void rulesQuery.refetch()} />
              </div>
            ) : rules.length === 0 ? (
              <div className="p-4 sm:p-5">
                <EmptyState
                  icon={DollarSign}
                  title={t('noPricingRulesTitle')}
                  description={t('noPricingRules')}
                  action={
                    <Button type="button" size="sm" onClick={() => setRuleDialogOpen(true)}>
                      <Plus aria-hidden="true" />
                      {t('addPricingRule')}
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    <tr>
                      <th scope="col" className="px-4 py-3 sm:px-5">{t('ruleLabel')}</th>
                      <th scope="col" className="px-4 py-3">{t('ruleWeekdays')}</th>
                      <th scope="col" className="px-4 py-3">{t('ruleTimeRange')}</th>
                      <th scope="col" className="px-4 py-3 text-right">{t('pricePerBlockColumn')}</th>
                      <th scope="col" className="px-4 py-3 text-right">{t('pricePerHourColumn')}</th>
                      <th scope="col" className="px-4 py-3 text-right">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {rules.map((rule) => (
                      <tr key={rule.id} className="hover:bg-neutral-50/60">
                        <th scope="row" className="px-4 py-3 text-left font-semibold text-neutral-800 sm:px-5">
                          {rule.label}
                        </th>
                        <td className="px-4 py-3">
                          <div className="flex max-w-64 flex-wrap gap-1">
                            {WEEKDAYS.filter((day) => rule.weekdays.includes(day)).map((day) => (
                              <span key={day} className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-600">
                                {weekdayLabels[day]}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs tabular-nums text-neutral-700">
                          {rule.startTime} – {rule.endTime}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-neutral-900">
                          {formatCurrency(rule.pricePerSlot)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-primary-700">
                          {formatCurrency(rule.pricePerSlot * 2)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {pendingDeleteId === rule.id ? (
                            <div className="inline-flex items-center gap-2">
                              <span className="text-xs text-neutral-600">{t('deleteRuleConfirm')}</span>
                              <Button
                                type="button"
                                variant="danger"
                                size="sm"
                                loading={deleteRuleMutation.isPending}
                                onClick={() => deleteRuleMutation.mutate(rule.id)}
                              >
                                {t('confirmDeleteRule')}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={deleteRuleMutation.isPending}
                                onClick={() => setPendingDeleteId(null)}
                              >
                                {t('cancelAction')}
                              </Button>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={t('deletePricingRuleNamed', { name: rule.label })}
                              onClick={() => setPendingDeleteId(rule.id)}
                            >
                              <Trash2 className="text-danger" aria-hidden="true" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </section>
      )}

      <PricingRuleDialog
        open={ruleDialogOpen}
        saving={createRuleMutation.isPending}
        onOpenChange={setRuleDialogOpen}
        onSubmit={(rule) => createRuleMutation.mutate(rule)}
      />
    </main>
  );
}
