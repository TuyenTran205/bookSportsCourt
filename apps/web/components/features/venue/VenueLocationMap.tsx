'use client';

import * as React from 'react';
import L from 'leaflet';
import type { LeafletMouseEvent } from 'leaflet';
import { MapContainer, Marker, useMap, useMapEvents } from 'react-leaflet';
import { cn } from '@/lib/utils/cn';
import { TileResilienceProvider } from './map/TileResilienceContext';
import { ResilientTileLayer } from './map/ResilientTileLayer';
import { MapResilienceControl } from './map/MapResilienceControl';

export type MapCoordinates = [number, number];

interface VenueLocationMapProps {
  center: MapCoordinates;
  marker: MapCoordinates | null;
  onPlacePin?: (coordinates: MapCoordinates) => void;
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
  scrollWheelZoom = false,
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

        <MapResilienceControl />
      </div>
    </TileResilienceProvider>
  );
}
