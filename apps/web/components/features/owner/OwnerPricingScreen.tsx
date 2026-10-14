'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Building2, Clock, DollarSign } from 'lucide-react';

import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { OpeningHoursTab } from '@/components/features/owner/OpeningHoursTab';
import { PricingRulesTab } from '@/components/features/owner/PricingRulesTab';
import { NativeSelect } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOwnerVenuesList } from '@/lib/hooks/useOwnerVenuesManager';

export function OwnerPricingScreen() {
  const t = useTranslations('owner');

  const venuesQuery = useOwnerVenuesList();
  const venues = React.useMemo(() => venuesQuery.data ?? [], [venuesQuery.data]);

  const [selectedVenueId, setSelectedVenueId] = React.useState<string>('');

  React.useEffect(() => {
    if (venues.length > 0 && !selectedVenueId) {
      setSelectedVenueId(venues[0]!.id);
    }
  }, [venues, selectedVenueId]);

  if (venuesQuery.isPending) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Skeleton className="mb-6 h-10 w-64" />
        <Skeleton className="mb-6 h-12 w-full" />
        <Skeleton className="h-96 w-full rounded-card" />
      </div>
    );
  }

  if (venues.length === 0) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <PageHeader title={t('pricingTitle')} description={t('pricingDesc')} />
        <EmptyState
          icon={Building2}
          title="Chưa có cơ sở thể thao nào"
          description="Bạn cần tạo cơ sở thể thao trước khi cấu hình giờ mở cửa và bảng giá."
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader title={t('pricingTitle')} description={t('pricingDesc')} />

        {/* Bộ chọn cơ sở */}
        <div className="w-full sm:w-72">
          <NativeSelect
            value={selectedVenueId}
            onChange={(e) => setSelectedVenueId(e.target.value)}
            className="h-10 text-sm font-medium"
          >
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="mt-6">
        <Tabs defaultValue="hours">
          <TabsList className="mb-6">
            <TabsTrigger value="hours" className="gap-2">
              <Clock className="size-4" aria-hidden="true" />
              {t('openingHoursTab')}
            </TabsTrigger>
            <TabsTrigger value="pricing" className="gap-2">
              <DollarSign className="size-4" aria-hidden="true" />
              {t('pricingRulesTab')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hours">
            {selectedVenueId ? (
              <OpeningHoursTab venueId={selectedVenueId} />
            ) : null}
          </TabsContent>

          <TabsContent value="pricing">
            {selectedVenueId ? (
              <PricingRulesTab venueId={selectedVenueId} />
            ) : null}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
