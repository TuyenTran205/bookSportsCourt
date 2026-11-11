'use client';

import * as React from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Building2, MapPin, Layers, Pencil, Trash2 } from 'lucide-react';
import type { AdminVenueRow } from '@/lib/api/endpoints/admin';
import { cn } from '@/lib/utils/cn';

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
import { useSportsList } from '@/lib/hooks/useAdminCatalogs';

export interface VenueReviewDrawerProps {
  venue: AdminVenueRow | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (venue: AdminVenueRow) => void;
  onDelete?: (venue: AdminVenueRow) => void;
}

export function VenueReviewDrawer({ venue, open, onClose, onEdit, onDelete }: VenueReviewDrawerProps) {
  const tCommon = useTranslations('common');
  const sportsQuery = useSportsList();

  const sportsMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const sport of sportsQuery.data ?? []) {
      map.set(sport.id, sport.name);
    }
    return map;
  }, [sportsQuery.data]);

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
                {venue.ward?.name ? `, ${venue.ward.name}` : venue.district ? `, ${venue.district.name}` : ''}
                {venue.province ? `, ${venue.province.name}` : ''}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="font-semibold text-neutral-700">Môn thể thao:</span>
              {(venue.sports ?? []).length > 0 ? (
                venue.sports.map((s) => {
                  const resolvedName = sportsMap.get(s.id) || (s.name && s.name !== 'Sân thể thao' && !s.name.includes('-') ? s.name : sportsMap.get(s.id) || 'Môn thể thao');
                  return (
                    <span
                      key={s.id}
                      className="rounded-btn bg-neutral-100 px-2 py-0.5 font-medium text-neutral-700"
                    >
                      {resolvedName}
                    </span>
                  );
                })
              ) : (
                <span className="text-xs text-neutral-400">Chưa cập nhật</span>
              )}
            </div>

            {/* Danh sách sân con */}
            <div className="mt-2 flex flex-col gap-1.5">
              <span className="font-semibold text-neutral-700">
                Danh sách sân con ({venue.courts?.length ?? 0}):
              </span>
              {(venue.courts ?? []).length > 0 ? (
                <div className="max-h-44 overflow-y-auto rounded-card border border-neutral-200 divide-y divide-neutral-100 bg-white">
                  {venue.courts!.map((court) => {
                    const sportName = court.sportId ? sportsMap.get(court.sportId) : null;
                    return (
                      <div key={court.id} className="flex items-center justify-between p-2 hover:bg-neutral-50/60">
                        <div className="flex flex-col">
                          <p className="font-medium text-neutral-900">{court.name}</p>
                          {court.description && (
                            <p className="text-[11px] text-neutral-500 line-clamp-1">{court.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {sportName && (
                            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-neutral-600">
                              {sportName}
                            </span>
                          )}
                          <span
                            className={cn(
                              "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold",
                              court.status === 'active'
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-neutral-100 text-neutral-600 border border-neutral-200"
                            )}
                          >
                            {court.status === 'active' ? 'Hoạt động' : 'Tạm khóa'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-neutral-200 p-3 text-center text-neutral-400">
                  <Layers className="size-5 mb-1 text-neutral-300" aria-hidden="true" />
                  <p className="text-xs">Cơ sở này chưa tạo sân con nào</p>
                </div>
              )}
            </div>

            <div className="mt-2 rounded-card bg-neutral-50 p-3 text-neutral-600">
              <p>Mã định danh (ID): <span className="font-mono">{venue.id}</span></p>
              <p className="mt-1">
                Điểm đánh giá: <strong>{(venue.ratingAvg ?? 0).toFixed(1)}</strong> ({venue.reviewCount ?? 0} lượt)
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
          <div>
            {onDelete && (
              <Button
                variant="ghost"
                onClick={() => {
                  onClose();
                  onDelete(venue);
                }}
                className="text-danger hover:bg-danger/10 hover:text-danger text-xs"
              >
                <Trash2 className="mr-1.5 size-3.5" />
                Xóa mềm cơ sở
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <Button
                variant="outline"
                onClick={() => {
                  onClose();
                  onEdit(venue);
                }}
                className="text-xs"
              >
                <Pencil className="mr-1.5 size-3.5" />
                Chỉnh sửa
              </Button>
            )}
            <Button variant="outline" onClick={onClose} className="text-xs">
              {tCommon('close')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
