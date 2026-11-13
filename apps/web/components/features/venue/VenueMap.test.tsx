// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { VenueListItem } from '@bsc/shared';

import { VenueMap } from './VenueMap';

interface FakeMap {
  handlers: Record<string, Set<(e?: unknown) => void>>;
  flyTo: ReturnType<typeof vi.fn>;
  fitBounds: ReturnType<typeof vi.fn>;
  getCenter: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
}

const { markerInstances, createdMaps, currentMapCenter } = vi.hoisted(() => ({
  markerInstances: [] as Array<{
    element: HTMLElement;
    lngLat?: [number, number];
  }>,
  createdMaps: [] as FakeMap[],
  currentMapCenter: { lng: 105.79, lat: 21.03 },
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => (
    <span role="img" aria-label={String(props.alt ?? '')} />
  ),
}));

vi.mock('maplibre-gl', () => {
  class FakeLngLatBounds {
    points: Array<[number, number]> = [];
    extend(pt: [number, number]) {
      this.points.push(pt);
      return this;
    }
  }
  class FakeMarker {
    element: HTMLElement;
    lngLat?: [number, number];
    constructor(opts: { element: HTMLElement }) {
      this.element = opts.element;
      markerInstances.push(this);
    }
    setLngLat(pt: [number, number]) {
      this.lngLat = pt;
      return this;
    }
    addTo() {
      return this;
    }
    remove() {
      return this;
    }
  }
  class FakePopup {
    setLngLat() {
      return this;
    }
    setDOMContent() {
      return this;
    }
    addTo() {
      return this;
    }
    on() {
      return this;
    }
    remove() {
      return this;
    }
  }
  return {
    LngLatBounds: FakeLngLatBounds,
    Marker: FakeMarker,
    Popup: FakePopup,
  };
});

const MapCtx = React.createContext<FakeMap | null>(null);

vi.mock('./map/ResilientTileLayer', () => ({
  MapLibreCanvas: ({ children }: { children?: React.ReactNode }) => {
    const [map] = React.useState<FakeMap>(() => {
      const handlers: Record<string, Set<(e?: unknown) => void>> = {};
      const m: FakeMap = {
        handlers,
        flyTo: vi.fn(),
        fitBounds: vi.fn(),
        getCenter: vi.fn(() => ({ ...currentMapCenter })),
        on: vi.fn((ev: string, cb: (e?: unknown) => void) => {
          (handlers[ev] ??= new Set()).add(cb);
        }),
        off: vi.fn((ev: string, cb: (e?: unknown) => void) => {
          handlers[ev]?.delete(cb);
        }),
      };
      createdMaps.push(m);
      return m;
    });
    return (
      <MapCtx.Provider value={map}>
        <div data-testid="fake-map-canvas">{children}</div>
      </MapCtx.Provider>
    );
  },
  ResilientTileLayer: () => null,
  useMapLibre: () => React.useContext(MapCtx),
}));

vi.mock('./map/VietnamMaritimeLayer', () => ({
  VietnamMaritimeLayer: () => null,
}));

const SAMPLE_VENUES: VenueListItem[] = [
  {
    id: 'v1',
    name: 'Sân Cầu Lông Cầu Giấy',
    slug: 'san-cau-giay',
    address: 'Cầu Giấy, Hà Nội',
    province: null,
    ward: null,
    district: null,
    lat: 21.036,
    lng: 105.79,
    status: 'approved',
    coverUrl: null,
    ratingAvg: 4.9,
    reviewCount: 5,
    fromPrice: 120000,
    sports: [{ id: 's1', name: 'Cầu lông', slug: 'cau-long', icon: 'badminton' }],
  },
  {
    id: 'v2',
    name: 'Sân Quận 7',
    slug: 'san-quan-7',
    address: 'Quận 7, TP.HCM',
    province: null,
    ward: null,
    district: null,
    lat: 10.73,
    lng: 106.72,
    status: 'approved',
    coverUrl: null,
    ratingAvg: 4.5,
    reviewCount: 2,
    fromPrice: 150000,
    sports: [{ id: 's2', name: 'Bóng đá', slug: 'bong-da', icon: 'football' }],
  },
];

describe('VenueMap — Định vị vị trí hiện tại & nút quay về vị trí', () => {
  beforeEach(() => {
    markerInstances.length = 0;
    createdMaps.length = 0;
    currentMapCenter.lng = 105.79;
    currentMapCenter.lat = 21.03;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('tự động định vị vị trí người dùng khi mở bản đồ và gắn chấm vị trí hiện tại', () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: { latitude: 21.03, longitude: 105.79 },
      } as GeolocationPosition);
    });

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });

    render(<VenueMap venues={SAMPLE_VENUES} />);

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    const map = createdMaps[0]!;
    expect(map.flyTo).toHaveBeenCalledWith({
      center: [105.79, 21.03],
      zoom: 13.5,
      duration: 750,
    });

    const userDotMarker = markerInstances.find(
      (m) => m.element.getAttribute('aria-label') === 'Vị trí hiện tại của bạn',
    );
    expect(userDotMarker).toBeDefined();
    expect(userDotMarker?.lngLat).toEqual([105.79, 21.03]);
  });

  it('khi người dùng di map sang chỗ khác, bấm nút icon định vị sẽ bay về lại vị trí hiện tại', () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: { latitude: 21.03, longitude: 105.79 },
      } as GeolocationPosition);
    });

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });

    render(<VenueMap venues={SAMPLE_VENUES} />);

    const map = createdMaps[0]!;
    map.flyTo.mockClear();

    // Mô phỏng người dùng kéo map sang TP.HCM (lệch > 200m so với Hà Nội)
    currentMapCenter.lng = 106.7;
    currentMapCenter.lat = 10.77;
    act(() => {
      map.handlers.dragstart?.forEach((cb) => cb());
      map.handlers.moveend?.forEach((cb) => cb());
    });

    const locateBtn = screen.getByRole('button', { name: 'Về vị trí hiện tại của tôi' });
    fireEvent.click(locateBtn);

    expect(map.flyTo).toHaveBeenCalledWith({
      center: [105.79, 21.03],
      zoom: 14,
      duration: 750,
    });
  });

  it('khi trình duyệt từ chối định vị sẽ fallback về fitBounds các sân và thử lại khi bấm nút định vị', () => {
    const getCurrentPosition = vi.fn((_success: PositionCallback, error?: PositionErrorCallback) => {
      error?.({ code: 1, message: 'User denied' } as GeolocationPositionError);
    });

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });

    render(<VenueMap venues={SAMPLE_VENUES} />);

    const map = createdMaps[0]!;
    expect(map.fitBounds).toHaveBeenCalled();

    const locateBtn = screen.getByRole('button', { name: 'Về vị trí hiện tại của tôi' });
    fireEvent.click(locateBtn);

    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
    expect(
      screen.getByText('Không thể truy cập vị trí. Hãy cấp quyền định vị cho trình duyệt.'),
    ).toBeDefined();
  });
});
