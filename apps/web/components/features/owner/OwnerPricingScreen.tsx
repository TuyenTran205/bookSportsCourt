'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Clock, DollarSign, Plus } from 'lucide-react';

import { listOwnerVenues, listPricingRules } from '@/lib/api/endpoints/owner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils/format';

export function OwnerPricingScreen() {
  const t = useTranslations('owner');
  const venuesQuery = useQuery({
    queryKey: ['owner', 'venues'],
    queryFn: listOwnerVenues,
  });

  const [selectedVenueId, setSelectedVenueId] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    if (venuesQuery.data && venuesQuery.data.length > 0 && !selectedVenueId) {
      setSelectedVenueId(venuesQuery.data[0]!.id);
    }
  }, [venuesQuery.data, selectedVenueId]);

  const pricingQuery = useQuery({
    queryKey: ['owner', 'pricing-rules', selectedVenueId],
    queryFn: () => listPricingRules(selectedVenueId!),
    enabled: Boolean(selectedVenueId),
  });

  const rules = pricingQuery.data ?? [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            {t('pricingTitle')}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {t('pricingDesc')}
          </p>
        </div>

        {venuesQuery.data && venuesQuery.data.length > 1 && (
          <select
            value={selectedVenueId}
            onChange={(e) => setSelectedVenueId(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-800"
          >
            {venuesQuery.data.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tab Giờ mở cửa */}
        <Card className="p-5 border border-neutral-200 bg-white">
          <CardHeader className="p-0 pb-4 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="size-5 text-teal-600" />
              {t('tabOpeningHours')}
            </CardTitle>
            <Button size="sm" variant="outline">
              {t('saveHours')}
            </Button>
          </CardHeader>
          <CardContent className="p-0 space-y-3">
            {[
              { day: 'Thứ Hai - Thứ Sáu', hours: '06:00 - 22:00' },
              { day: 'Thứ Bảy', hours: '06:00 - 23:00' },
              { day: 'Chủ Nhật', hours: '06:00 - 23:00' },
            ].map((schedule, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-md bg-neutral-50 border border-neutral-100 text-sm">
                <span className="font-medium text-neutral-800">{schedule.day}</span>
                <span className="text-neutral-600 tabular-nums">{schedule.hours}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Tab Khung giá */}
        <Card className="p-5 border border-neutral-200 bg-white">
          <CardHeader className="p-0 pb-4 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <DollarSign className="size-5 text-emerald-600" />
              {t('pricingRulesTitle')}
            </CardTitle>
            <Button size="sm" variant="primary">
              <Plus className="mr-1 size-4" />
              {t('addRule')}
            </Button>
          </CardHeader>
          <CardContent className="p-0 space-y-3">
            {pricingQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : rules.length === 0 ? (
              <p className="text-xs text-neutral-500 py-4 text-center">
                {t('noPricingRules')}
              </p>
            ) : (
              rules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between p-3 rounded-md bg-neutral-50 border border-neutral-100 text-sm">
                  <div>
                    <div className="font-medium text-neutral-900">{rule.label}</div>
                    <div className="text-xs text-neutral-500 tabular-nums mt-0.5">
                      {rule.startTime} - {rule.endTime} (Thứ {rule.weekdays.join(', ')})
                    </div>
                  </div>
                  <div className="font-semibold text-neutral-900 tabular-nums">
                    {formatCurrency(rule.pricePerSlot)}
                    <span className="text-xs font-normal text-neutral-500"> /30p</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
