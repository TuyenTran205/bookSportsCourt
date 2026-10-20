import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAppRouter } from '@/lib/navigation/navigate';
import { Building2, Plus } from 'lucide-react';

export function VenueManagement() {
  const t = useTranslations('owner');
  const router = useAppRouter();

  return (
    <Card className="p-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="size-4" aria-hidden="true" />
          {t('venueManagement')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Button
          variant="primary"
          onClick={() => router.push('/owner/venues/new')}
          className="mb-4"
        >
          <Plus className="size-4 mr-2" aria-hidden="true" />
          {t('createVenue')}
        </Button>
        <p className="text-sm text-neutral-600">
          {t('venueManagementDescription')}
        </p>
      </CardContent>
    </Card>
  );
}