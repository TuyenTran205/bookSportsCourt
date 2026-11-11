'use client';

import dynamic from 'next/dynamic';
import type { MapCoordinates, VenueLocationMapProps } from './VenueLocationMap';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils/cn';

export type { MapCoordinates, VenueLocationMapProps } from './VenueLocationMap';

const DynamicVenueLocationMap = dynamic(
  () => import('./VenueLocationMap').then((module) => module.VenueLocationMap),
  {
    ssr: false,
    loading: () => <Skeleton className="size-full rounded-btn" aria-label="Đang tải bản đồ" />,
  },
);

export function VenueLocationMapWrapper({
  className,
  ...props
}: VenueLocationMapProps) {
  return (
    <div className={cn('h-56 w-full', className)}>
      <DynamicVenueLocationMap {...props} className="size-full" />
    </div>
  );
}
