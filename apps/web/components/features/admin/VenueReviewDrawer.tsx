'use client';

import * as React from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Building2, MapPin } from 'lucide-react';
import type { AdminVenueRow } from '@/lib/api/endpoints/admin';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/components/ui/status-badge';

export interface VenueReviewDrawerProps {
  venue: AdminVenueRow | null;
  open: boolean;
  onClose: () => void;
}

export function VenueReviewDrawer({ venue, open, onClose }: VenueReviewDrawerProps) {
  const tCommon = useTranslations('common');

  if (!venue) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg">{venue.name}</DialogTitle>
            <StatusBadge kind="venue" status={venue.status} />
          </div>
          <DialogDescription>
            Chủ sở hữu: <strong>{venue.ownerName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Ảnh bìa */}
          <div className="relative h-48 w-full overflow-hidden rounded-card bg-neutral-100">
            {venue.coverUrl ? (
              <Image
                src={venue.coverUrl}
                alt={venue.name}
                fill
                unoptimized={venue.coverUrl.startsWith('data:')}
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center text-neutral-400">
                <Building2 className="size-12" aria-hidden="true" />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 text-xs">
            <div className="flex items-start gap-1.5 text-neutral-700">
              <MapPin className="size-4 shrink-0 text-neutral-400" />
              <span>
                {venue.address}
                {venue.district ? `, ${venue.district.name}` : ''}
                {venue.province ? `, ${venue.province.name}` : ''}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="font-semibold text-neutral-700">Môn thể thao:</span>
              {venue.sports.map((s) => (
                <span
                  key={s.id}
                  className="rounded-btn bg-neutral-100 px-2 py-0.5 font-medium text-neutral-700"
                >
                  {s.name}
                </span>
              ))}
            </div>

            <div className="mt-2 rounded-card bg-neutral-50 p-3 text-neutral-600">
              <p>Mã định danh (ID): <span className="font-mono">{venue.id}</span></p>
              <p className="mt-1">Điểm đánh giá: <strong>{venue.ratingAvg.toFixed(1)}</strong> ({venue.reviewCount} lượt)</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {tCommon('close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
