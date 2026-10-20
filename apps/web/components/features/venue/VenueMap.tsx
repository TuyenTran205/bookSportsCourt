'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MapContainer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ExternalLink, ImageOff, MapPin, Star } from 'lucide-react';
import type { VenueListItem } from '@bsc/shared';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import { TileResilienceProvider } from './map/TileResilienceContext';
import { ResilientTileLayer } from './map/ResilientTileLayer';
import { MapResilienceControl } from './map/MapResilienceControl';

/** Cập nhật khung nhìn bản đồ tự động theo toạ độ các cơ sở. */
function MapBoundsUpdater({
  venues,
  selectedVenue,
}: {
  venues: VenueListItem[];
  selectedVenue?: VenueListItem | null;
}) {
  const map = useMap();

  React.useEffect(() => {
    // Kích hoạt tính toán lại kích thước container khi chuyển đổi tab / layout
    map.invalidateSize();
  }, [map]);

  React.useEffect(() => {
    if (selectedVenue) {
      map.flyTo([selectedVenue.lat, selectedVenue.lng], 15, { duration: 1 });
      return;
    }

    const validPoints = venues
      .filter((v) => typeof v.lat === 'number' && typeof v.lng === 'number' && !isNaN(v.lat) && !isNaN(v.lng))
      .map((v) => [v.lat, v.lng] as [number, number]);

    if (validPoints.length > 0) {
      const bounds = L.latLngBounds(validPoints);
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
    }
  }, [map, venues, selectedVenue]);

  return null;
}

/** Tạo thẻ đánh dấu vị trí tuỳ biến theo Design System (Token màu xanh sân cỏ). */
function createMarkerIcon(venue: VenueListItem, isSelected: boolean) {
  const priceLabel =
    venue.fromPrice >= 1_000_000
      ? `${(venue.fromPrice / 1_000_000).toFixed(1)}Tr`
      : venue.fromPrice >= 1_000
        ? `${Math.round(venue.fromPrice / 1_000)}k`
        : formatCurrency(venue.fromPrice);

  const html = `
    <div class="bsc-leaflet-marker ${
      isSelected ? 'is-selected' : ''
    }" style="
      background-color: ${isSelected ? '#15803d' : '#16a34a'};
      color: #ffffff;
      padding: 3px 8px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      white-space: nowrap;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
      border: 2px solid #ffffff;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 3px;
      transform: translate(-50%, -50%) ${isSelected ? 'scale(1.15)' : 'scale(1)'};
      transition: all 0.15s ease-in-out;
    ">
      <span>${priceLabel}</span>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-bsc-div-icon',
    iconSize: [40, 24],
    iconAnchor: [20, 12],
    popupAnchor: [0, -14],
  });
}

export interface VenueMapProps {
  venues: VenueListItem[];
  selectedVenueId?: string;
  onSelectVenue?: (venue: VenueListItem) => void;
  className?: string;
}

export function VenueMap({
  venues,
  selectedVenueId,
  onSelectVenue,
  className,
}: VenueMapProps) {
  // Toạ độ mặc định TP. Hồ Chí Minh nếu chưa có danh sách sân
  const defaultCenter: [number, number] = [10.776889, 106.700806];

  const selectedVenue = React.useMemo(
    () => venues.find((v) => v.id === selectedVenueId) ?? null,
    [venues, selectedVenueId],
  );

  // Cơ chế tự phục hồi tile khi gặp sự cố DNS hoặc lỗi máy chủ tile
  return (
    <TileResilienceProvider>
      <div
        className={cn(
          'relative isolate z-0 size-full overflow-hidden rounded-card border border-neutral-200 bg-neutral-100',
          className,
        )}
      >
        <MapContainer
          center={venues[0] ? [venues[0].lat, venues[0].lng] : defaultCenter}
          zoom={13}
          maxZoom={19}
          scrollWheelZoom
          className="size-full"
          style={{ minHeight: '100%', width: '100%' }}
        >
          <ResilientTileLayer />

          <MapBoundsUpdater venues={venues} selectedVenue={selectedVenue} />

          {venues.map((venue) => {
            if (
              typeof venue.lat !== 'number' ||
              typeof venue.lng !== 'number' ||
              isNaN(venue.lat) ||
              isNaN(venue.lng)
            ) {
              return null;
            }

            const isSelected = venue.id === selectedVenueId;

            return (
              <Marker
                key={venue.id}
                position={[venue.lat, venue.lng]}
                icon={createMarkerIcon(venue, isSelected)}
                eventHandlers={{
                  click: () => onSelectVenue?.(venue),
                }}
              >
                <Popup className="bsc-custom-popup" closeButton minWidth={240} maxWidth={280}>
                  <div className="flex flex-col gap-2 p-1 text-neutral-900">
                    {/* Ảnh thu nhỏ */}
                    <div className="relative aspect-video w-full overflow-hidden rounded-md bg-neutral-100">
                      {venue.coverUrl ? (
                        <Image
                          src={venue.coverUrl}
                          alt={venue.name}
                          fill
                          unoptimized={venue.coverUrl.startsWith('data:')}
                          sizes="240px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center text-neutral-400">
                          <ImageOff className="size-6" aria-hidden="true" />
                        </div>
                      )}
                    </div>

                    {/* Thông tin cơ sở */}
                    <div className="flex flex-col gap-1">
                      <h4
                        className="line-clamp-1 text-sm font-bold text-neutral-900"
                        title={venue.name}
                      >
                        {venue.name}
                      </h4>

                      <p className="flex items-center gap-1 text-xs text-neutral-600">
                        <MapPin className="size-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
                        <span className="line-clamp-1">
                          {venue.district?.name ?? venue.province?.name ?? venue.address}
                        </span>
                      </p>

                      <div className="mt-1 flex items-center justify-between gap-1 text-xs">
                        <span className="font-semibold text-primary-700">
                          từ {formatCurrency(venue.fromPrice)}
                        </span>

                        {venue.reviewCount > 0 ? (
                          <span className="flex items-center gap-0.5 text-neutral-700">
                            <Star
                              className="size-3 fill-amber-400 text-amber-400"
                              aria-hidden="true"
                            />
                            <span className="font-medium">{venue.ratingAvg.toFixed(1)}</span>
                            <span className="text-[10px] text-neutral-400">
                              ({formatNumber(venue.reviewCount)})
                            </span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-neutral-400">Chưa có đánh giá</span>
                        )}
                      </div>
                    </div>

                    {/* Nút xem chi tiết & đặt sân */}
                    <Link
                      href={`/venues/${venue.slug}`}
                      className={cn(
                        buttonVariants({ variant: 'primary', size: 'sm' }),
                        'mt-1 w-full gap-1 text-xs font-medium',
                      )}
                    >
                      <span>Xem chi tiết & đặt</span>
                      <ExternalLink className="size-3" aria-hidden="true" />
                    </Link>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        <MapResilienceControl />
      </div>
    </TileResilienceProvider>
  );
}
