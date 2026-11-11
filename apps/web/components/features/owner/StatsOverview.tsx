import * as React from 'react';
import { useTranslations } from 'next-intl';
import { DollarSign, Calendar, Shield, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/common/StatCard';
import { formatCurrency } from '@/lib/utils/format';

export interface StatsOverviewProps {
  totalRevenue: number;
  totalBookings: number;
  occupancyRate: number;
  pendingPayments: number;
}

export function StatsOverview({ totalRevenue, totalBookings, occupancyRate, pendingPayments }: StatsOverviewProps) {
  const t = useTranslations('owner');

  return (
    <Card className="borderrounded-lg p-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="size-4" aria-hidden="true" />
          {t('revenueStats')}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <StatCard
          label={t('totalRevenue')}
          value={formatCurrency(totalRevenue)}
          icon={DollarSign}
        />
        <StatCard
          label={t('totalBookings')}
          value={`${totalBookings} lịch`}
          icon={Calendar}
        />
        <StatCard
          label={t('occupancyRate')}
          value={`${Math.round(occupancyRate)}%`}
          icon={Shield}
        />
        <StatCard
          label={t('pendingPayments')}
          value={`${pendingPayments} chờ duyệt`}
          icon={Users}
        />
      </CardContent>
    </Card>
  );
}