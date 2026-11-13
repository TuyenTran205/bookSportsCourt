'use client';

import * as React from 'react';
import { Marker, type MapMouseEvent } from 'maplibre-gl';
import { Loader2, LocateFixed } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { TileResilienceProvider } from './map/TileResilienceContext';
import { MapLibreCanvas, ResilientTileLayer, useMapLibre } from './map/ResilientTileLayer';
import { MapResilienceControl } from './map/MapResilienceControl';
import { VietnamMaritimeLayer } from './map/VietnamMaritimeLayer';

/** Cặp toạ độ `[lat, lng]` chuẩn theo giao diện cũ để không phá vỡ caller */
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

function MapClickHandler({ onPlacePin }: Pick<VenueLocationMapProps, 'onPlacePin'>) {
  const map = useMapLibre();
  const onPlacePinRef = React.useRef(onPlacePin);
  React.useEffect(() => {
    onPlacePinRef.current = onPlacePin;
  }, [onPlacePin]);

  React.useEffect(() => {
    if (!map) return undefined;

    const handleClick = (event: MapMouseEvent) => {
      onPlacePinRef.current?.([event.lngLat.lat, event.lngLat.lng]);
    };

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [map]);

  return null;
}

function MapViewport({ center, marker }: Pick<VenueLocationMapProps, 'center' | 'marker'>) {
  const map = useMapLibre();
  const centerLat = center[0];
  const centerLng = center[1];
  const markerLat = marker?.[0];
  const markerLng = marker?.[1];

  React.useEffect(() => {
    if (!map) return;

    const hasMarker = markerLat !== undefined && markerLng !== undefined;
    const targetLngLat: [number, number] = hasMarker
      ? [markerLng, markerLat]
      : [centerLng, centerLat];

    map.flyTo({
      center: targetLngLat,
      zoom: hasMarker ? 16 : 13,
      duration: 500,
    });
  }, [centerLat, centerLng, map, markerLat, markerLng]);

  return null;
}

function LocationPinMarker({ marker }: Pick<VenueLocationMapProps, 'marker'>) {
  const map = useMapLibre();
  const markerLat = marker?.[0];
  const markerLng = marker?.[1];

  React.useEffect(() => {
    if (!map || markerLat === undefined || markerLng === undefined) {
      return undefined;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'bsc-venue-location-icon pointer-events-none';
    const pin = document.createElement('span');
    pin.className = 'bsc-venue-location-pin';
    pin.setAttribute('aria-hidden', 'true');
    wrapper.appendChild(pin);

    const mapMarker = new Marker({ element: wrapper, anchor: 'bottom' })
      .setLngLat([markerLng, markerLat])
      .addTo(map);

    return () => {
      mapMarker.remove();
    };
  }, [map, markerLat, markerLng]);

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
  const initialCoords = marker ?? center;
  // Đảo [lat, lng] sang [lng, lat] cho MapLibre
  const initialCenterLngLat: [number, number] = [initialCoords[1], initialCoords[0]];

  return (
    <TileResilienceProvider>
      <div
        className={cn(
          'relative isolate z-0 size-full overflow-hidden rounded-btn bg-neutral-50',
          onPlacePin && 'cursor-crosshair [&_canvas]:cursor-crosshair',
          className,
        )}
      >
        <MapLibreCanvas
          center={initialCenterLngLat}
          zoom={marker ? 16 : 13}
          maxZoom={19}
          scrollWheelZoom={scrollWheelZoom}
          className="size-full"
        >
          <ResilientTileLayer />
          <VietnamMaritimeLayer />
          <MapViewport center={center} marker={marker} />
          <MapClickHandler onPlacePin={onPlacePin} />
          <LocationPinMarker marker={marker} />
        </MapLibreCanvas>

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
