'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Activity, MapPin, Sparkles } from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { AmenitiesCatalogTab } from '@/components/features/admin/AmenitiesCatalogTab';
import { AreasCatalogTab } from '@/components/features/admin/AreasCatalogTab';
import { SportsCatalogTab } from '@/components/features/admin/SportsCatalogTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function AdminCatalogsScreen() {
  const t = useTranslations('admin');

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t('catalogs')}
        description="Quản trị danh mục môn thể thao, danh mục tiện ích và hệ thống địa bàn Tỉnh/Quận trên toàn sàn."
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
          <TabsTrigger value="areas">
            <MapPin className="size-4" />
            Địa bàn & Khu vực
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sports">
          <SportsCatalogTab />
        </TabsContent>

        <TabsContent value="amenities">
          <AmenitiesCatalogTab />
        </TabsContent>

        <TabsContent value="areas">
          <AreasCatalogTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
