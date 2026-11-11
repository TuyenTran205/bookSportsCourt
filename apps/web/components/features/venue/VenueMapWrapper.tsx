'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import type { VenueMapProps } from './VenueMap';

const DynamicMap = dynamic(
  () => import('./VenueMap').then((mod) => mod.VenueMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex size-full min-h-[400px] flex-col items-center justify-center gap-3 rounded-card border border-neutral-200 bg-neutral-100 p-8 text-neutral-500">
        <Skeleton className="size-full rounded-card" />
      </div>
    ),
  },
);

export function VenueMapWrapper(props: VenueMapProps) {
  return <DynamicMap {...props} />;
}
