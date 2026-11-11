'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Activity, Sparkles } from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { AmenitiesCatalogTab } from '@/components/features/admin/AmenitiesCatalogTab';
import { SportsCatalogTab } from '@/components/features/admin/SportsCatalogTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function AdminCatalogsScreen() {
  const t = useTranslations('admin');

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t('catalogs')}
        description="Quản trị danh mục môn thể thao và danh mục tiện ích cơ sở trên toàn sàn."
      />

      <Tabs defaultValue="sports" className="mt-6">
        <TabsList className="mb-6">
          <TabsTrigger value="sports">
            <Activity className="size-4" />
            Môn thể thao
          </TabsTrigger>
          <TabsTrigger value="amenities">
            <Sparkles className="size-4" />
            Tiện ích cơ sở
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sports">
          <SportsCatalogTab />
        </TabsContent>

        <TabsContent value="amenities">
          <AmenitiesCatalogTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
