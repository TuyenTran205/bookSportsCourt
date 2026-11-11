'use client';

import * as React from 'react';
import L from 'leaflet';
import type { LeafletMouseEvent } from 'leaflet';
import { MapContainer, Marker, useMap, useMapEvents } from 'react-leaflet';
import { Loader2, LocateFixed } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { TileResilienceProvider } from './map/TileResilienceContext';
import { ResilientTileLayer } from './map/ResilientTileLayer';
import { MapResilienceControl } from './map/MapResilienceControl';

export type MapCoordinates = [number, number];

export interface VenueLocationMapProps {
  center: MapCoordinates;
  marker: MapCoordinates | null;
  onPlacePin?: (coordinates: MapCoordinates) => void;
  onLocateMe?: () => void;
  isLocatingMe?: boolean;
  scrollWheelZoom?: boolean;
  className?: string;
}

const locationPinIcon = L.divIcon({
  className: 'bsc-venue-location-icon',
  html: '<span class="bsc-venue-location-pin" aria-hidden="true"></span>',
  iconSize: [28, 36],
  iconAnchor: [14, 34],
});

function MapClickHandler({ onPlacePin }: Pick<VenueLocationMapProps, 'onPlacePin'>) {
  useMapEvents({
    click(event: LeafletMouseEvent) {
      onPlacePin?.([event.latlng.lat, event.latlng.lng]);
    },
  });

  return null;
}

function MapViewport({ center, marker }: Pick<VenueLocationMapProps, 'center' | 'marker'>) {
  const map = useMap();
  const centerLat = center[0];
  const centerLng = center[1];
  const markerLat = marker?.[0];
  const markerLng = marker?.[1];

  React.useEffect(() => {
    const hasMarker = markerLat !== undefined && markerLng !== undefined;
    const position: MapCoordinates = hasMarker
      ? [markerLat, markerLng]
      : [centerLat, centerLng];
    map.flyTo(position, hasMarker ? 16 : 13, { duration: 0.5 });
  }, [centerLat, centerLng, map, markerLat, markerLng]);

  React.useEffect(() => {
    map.invalidateSize();
  }, [map]);

  return null;
}

export function VenueLocationMap({
  center,
  marker,
  onPlacePin,
  onLocateMe,
  isLocatingMe = false,
  scrollWheelZoom = true,
  className,
}: VenueLocationMapProps) {
  return (
    <TileResilienceProvider>
      <div
        className={cn(
          'relative isolate z-0 size-full overflow-hidden rounded-btn',
          onPlacePin && 'cursor-crosshair',
          className,
        )}
      >
        <MapContainer
          center={marker ?? center}
          zoom={marker ? 16 : 13}
          maxZoom={19}
          scrollWheelZoom={scrollWheelZoom}
          className="size-full"
        >
          <ResilientTileLayer />
          <MapViewport center={center} marker={marker} />
          <MapClickHandler onPlacePin={onPlacePin} />
          {marker && <Marker position={marker} icon={locationPinIcon} />}
        </MapContainer>

        {onLocateMe && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onLocateMe();
            }}
            disabled={isLocatingMe}
            className="absolute bottom-3 right-3 z-[1000] flex size-9 items-center justify-center rounded-btn border border-neutral-300 bg-white/95 backdrop-blur-xs shadow-md text-neutral-700 transition hover:bg-neutral-50 hover:text-primary-700 hover:border-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 disabled:opacity-50"
            title="Định vị vị trí của tôi"
            aria-label="Định vị vị trí của tôi"
          >
            {isLocatingMe ? (
              <Loader2 className="size-4 animate-spin text-primary-600" />
            ) : (
              <LocateFixed className="size-4 text-primary-700" />
            )}
          </button>
        )}

        <MapResilienceControl />
      </div>
    </TileResilienceProvider>
  );
}
