// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VenueLocationMap } from './VenueLocationMap';

const { markerRemoveMock, markerSetLngLatMock, mapHandlers, mapFlyToMock } = vi.hoisted(() => ({
  markerRemoveMock: vi.fn(),
  markerSetLngLatMock: vi.fn(),
  mapHandlers: new Map<string, (e: { lngLat: { lat: number; lng: number } }) => void>(),
  mapFlyToMock: vi.fn(),
}));

const fakeMap = {
  on: (evt: string, cb: (e: { lngLat: { lat: number; lng: number } }) => void) => {
    mapHandlers.set(evt, cb);
  },
  off: (evt: string) => {
    mapHandlers.delete(evt);
  },
  flyTo: mapFlyToMock,
};

vi.mock('maplibre-gl', () => {
  class MockMarker {
    setLngLat(coords: [number, number]) {
      markerSetLngLatMock(coords);
      return this;
    }
    addTo() {
      return this;
    }
    remove() {
      markerRemoveMock();
    }
  }
  return { Marker: MockMarker };
});

vi.mock('./map/TileResilienceContext', () => ({
  TileResilienceProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./map/ResilientTileLayer', () => ({
  MapLibreCanvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="maplibre-canvas">{children}</div>
  ),
  ResilientTileLayer: () => null,
  useMapLibre: () => fakeMap,
}));

vi.mock('./map/MapResilienceControl', () => ({
  MapResilienceControl: () => <div data-testid="map-resilience-control" />,
}));

vi.mock('./map/VietnamMaritimeLayer', () => ({
  VietnamMaritimeLayer: () => null,
}));

describe('VenueLocationMap (GST-03, P2 Map Interaction)', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    mapHandlers.clear();
  });

  it('cắm ghim khi click bản đồ, flyTo đúng toạ độ [lng, lat] và kích hoạt nút định vị tôi', () => {
    const onPlacePin = vi.fn();
    const onLocateMe = vi.fn();

    const { unmount } = render(
      <VenueLocationMap
        center={[21.0285, 105.8542]}
        marker={[21.03, 105.8]}
        onPlacePin={onPlacePin}
        onLocateMe={onLocateMe}
      />,
    );

    expect(markerSetLngLatMock).toHaveBeenCalledWith([105.8, 21.03]);
    expect(mapFlyToMock).toHaveBeenCalledWith(
      expect.objectContaining({ center: [105.8, 21.03], zoom: 16 }),
    );

    // Giả lập click trên MapLibre map
    const clickHandler = mapHandlers.get('click');
    expect(clickHandler).toBeDefined();
    clickHandler?.({ lngLat: { lat: 21.05, lng: 105.82 } });
    expect(onPlacePin).toHaveBeenCalledWith([21.05, 105.82]);

    // Click nút Định vị vị trí của tôi
    fireEvent.click(screen.getByRole('button', { name: 'Định vị vị trí của tôi' }));
    expect(onLocateMe).toHaveBeenCalledTimes(1);

    unmount();
    expect(markerRemoveMock).toHaveBeenCalledTimes(1);
  });
});
