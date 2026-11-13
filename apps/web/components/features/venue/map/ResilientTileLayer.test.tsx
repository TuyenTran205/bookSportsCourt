// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

import {
  MapLibreCanvas,
  MapLibreContext,
  ResilientTileLayer,
} from './ResilientTileLayer';
import { TileResilienceProvider } from './TileResilienceContext';
import { MapResilienceControl } from './MapResilienceControl';
import { MapResilienceBar } from './MapResilienceBar';
import { TILE_PROVIDERS } from '@/lib/map/tile-providers';
import { resetPmTilesProtocolForTests } from '@/lib/map/pmtiles-protocol';
import { RASTER_FALLBACK_SOURCE_ID } from '@/lib/map/vietnam-theme';

interface MockMapRecord {
  handlers: Record<string, Set<(event?: Record<string, unknown>) => void>>;
  setStyle: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  addControl: ReturnType<typeof vi.fn>;
  resize: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  getCanvas: ReturnType<typeof vi.fn>;
  scrollZoom: { enable: ReturnType<typeof vi.fn>; disable: ReturnType<typeof vi.fn> };
}

const {
  pmtilesHeaderMock,
  pmtilesGetZxyMock,
  addProtocolMock,
  setWorkerUrlMock,
  mapConstructorMock,
  navigationControlMock,
} = vi.hoisted(() => ({
  pmtilesHeaderMock: vi.fn(async () => ({ minZoom: 0, maxZoom: 14 })),
  pmtilesGetZxyMock: vi.fn(async () => undefined),
  addProtocolMock: vi.fn(),
  setWorkerUrlMock: vi.fn(),
  mapConstructorMock: vi.fn(),
  navigationControlMock: vi.fn(),
}));

let mapRecords: MockMapRecord[] = [];

function createMockMapRecord(): MockMapRecord {
  const handlers: Record<string, Set<(event?: Record<string, unknown>) => void>> = {};
  const canvas = document.createElement('canvas');

  const record: MockMapRecord = {
    handlers,
    setStyle: vi.fn(),
    on: vi.fn((event: string, cb: (event?: Record<string, unknown>) => void) => {
      (handlers[event] ??= new Set()).add(cb);
    }),
    off: vi.fn((event: string, cb: (event?: Record<string, unknown>) => void) => {
      handlers[event]?.delete(cb);
    }),
    addControl: vi.fn(),
    resize: vi.fn(),
    remove: vi.fn(),
    getCanvas: vi.fn(() => canvas),
    scrollZoom: {
      enable: vi.fn(),
      disable: vi.fn(),
    },
  };

  mapRecords.push(record);
  return record;
}

function emitMapEvent(record: MockMapRecord, event: string, payload?: Record<string, unknown>) {
  const listeners = record.handlers[event];
  if (!listeners) return;
  Array.from(listeners).forEach((cb) => cb(payload));
}

vi.mock('maplibre-gl', () => ({
  addProtocol: addProtocolMock,
  setWorkerUrl: setWorkerUrlMock,
  Map: mapConstructorMock.mockImplementation(() => createMockMapRecord()),
  NavigationControl: navigationControlMock.mockImplementation(() => ({})),
}));

vi.mock('pmtiles', () => ({
  SharedPromiseCache: vi.fn().mockImplementation((maxEntries: number) => ({ maxEntries })),
  Protocol: vi.fn().mockImplementation(() => ({
    add: vi.fn(),
    tile: vi.fn(),
  })),
  PMTiles: vi.fn().mockImplementation((url: string) => ({
    source: { getKey: () => url },
    getHeader: () => pmtilesHeaderMock(),
    getZxy: pmtilesGetZxyMock,
  })),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    if (values && typeof values.name === 'string') {
      return `${key}:${values.name}`;
    }
    return key;
  },
}));

describe('ResilientTileLayer & MapLibreCanvas (SPEC-MAP-003 / ADR-031)', () => {
  beforeEach(() => {
    mapRecords = [];
    resetPmTilesProtocolForTests();
    addProtocolMock.mockClear();
    setWorkerUrlMock.mockClear();
    mapConstructorMock.mockClear();
    navigationControlMock.mockClear();
    pmtilesHeaderMock.mockReset();
    pmtilesHeaderMock.mockResolvedValue({ minZoom: 0, maxZoom: 14 });
  });

  afterEach(() => {
    cleanup();
  });

  describe('WT-MAP-01: Render MapLibreCanvas & ResilientTileLayer trong môi trường DOM với maplibre-gl mock', () => {
    it('render trong MapLibreCanvas + TileResilienceProvider không ném lỗi và gắn style lên map', () => {
      expect(() => {
        render(
          <TileResilienceProvider>
            <MapLibreCanvas>
              <ResilientTileLayer />
            </MapLibreCanvas>
          </TileResilienceProvider>,
        );
      }).not.toThrow();

      expect(setWorkerUrlMock).toHaveBeenCalledWith('/maplibre-gl-worker.js');
      expect(mapConstructorMock).toHaveBeenCalledTimes(1);
      expect(navigationControlMock).toHaveBeenCalledWith({ showCompass: false });
      const current = mapRecords[0]!;
      expect(current.setStyle).toHaveBeenCalledTimes(1);
    });

    it('render độc lập (self-contained) với map context mock vẫn hoạt động bình thường', () => {
      const mockMap = createMockMapRecord();

      expect(() => {
        render(
          <MapLibreContext.Provider value={mockMap as never}>
            <ResilientTileLayer />
          </MapLibreContext.Provider>,
        );
      }).not.toThrow();

      expect(mockMap.setStyle).toHaveBeenCalledTimes(1);
      const styleArg = mockMap.setStyle.mock.calls[0]![0] as {
        sources: Record<string, { tiles?: string[] }>;
      };
      expect(styleArg.sources[RASTER_FALLBACK_SOURCE_ID]?.tiles).toEqual([
        TILE_PROVIDERS['esri-world-street'].url,
      ]);
    });
  });

  describe('WT-MAP-02: Thiết lập đúng MapLibre Raster Fallback Style theo provider', () => {
    it('buildRasterFallbackStyle áp đúng url, attribution, minzoom, maxzoom, raster-opacity', () => {
      const mockMap = createMockMapRecord();

      render(
        <MapLibreContext.Provider value={mockMap as never}>
          <ResilientTileLayer opacity={0.85} />
        </MapLibreContext.Provider>,
      );

      const styleArg = mockMap.setStyle.mock.calls[0]![0] as {
        sources: Record<
          string,
          { tiles: string[]; attribution: string; maxzoom: number; tileSize: number }
        >;
        layers: Array<{ id: string; maxzoom?: number; paint?: Record<string, unknown> }>;
      };

      const source = styleArg.sources[RASTER_FALLBACK_SOURCE_ID]!;
      expect(source.tiles).toEqual([TILE_PROVIDERS['esri-world-street'].url]);
      expect(source.attribution).toBe(TILE_PROVIDERS['esri-world-street'].attribution);
      expect(source.maxzoom).toBe(18);
      expect(source.tileSize).toBe(256);

      const rasterLayer = styleArg.layers.find((l) => l.id === 'raster-basemap');
      expect(rasterLayer?.maxzoom).toBe(19);
      expect(rasterLayer?.paint?.['raster-opacity']).toBe(0.85);
    });
  });

  describe('WT-MAP-03: Bắt sự kiện error trên MapLibre và tự động chuyển nguồn', () => {
    it('lắng nghe error từ active source và chuyển sang OSM France Humanitarian khi đủ 6 lỗi', () => {
      const mockMap = createMockMapRecord();

      render(
        <MapLibreContext.Provider value={mockMap as never}>
          <ResilientTileLayer />
        </MapLibreContext.Provider>,
      );

      expect(mockMap.setStyle).toHaveBeenCalledTimes(1);

      act(() => {
        for (let i = 0; i < 6; i++) {
          emitMapEvent(mockMap, 'error', { sourceId: RASTER_FALLBACK_SOURCE_ID });
        }
      });

      expect(mockMap.setStyle).toHaveBeenCalledTimes(2);
      const nextStyle = mockMap.setStyle.mock.calls[1]![0] as {
        sources: Record<string, { tiles: string[]; attribution: string }>;
      };
      expect(nextStyle.sources[RASTER_FALLBACK_SOURCE_ID]?.tiles).toEqual([
        'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
      ]);
      expect(nextStyle.sources[RASTER_FALLBACK_SOURCE_ID]?.attribution).toBe(
        TILE_PROVIDERS['osm-france-hot'].attribution,
      );
    });

    it('dưới ngưỡng 6 lỗi không chuyển đổi provider', () => {
      const mockMap = createMockMapRecord();

      render(
        <MapLibreContext.Provider value={mockMap as never}>
          <ResilientTileLayer />
        </MapLibreContext.Provider>,
      );

      act(() => {
        for (let i = 0; i < 5; i++) {
          emitMapEvent(mockMap, 'error', { sourceId: RASTER_FALLBACK_SOURCE_ID });
        }
      });

      expect(mockMap.setStyle).toHaveBeenCalledTimes(1);
    });

    it('chuyển tiếp sự kiện tới callbacks onTileError, onTileLoad, onLoadingChange', () => {
      const mockMap = createMockMapRecord();
      const onTileError = vi.fn();
      const onTileLoad = vi.fn();
      const onLoadingChange = vi.fn();

      render(
        <MapLibreContext.Provider value={mockMap as never}>
          <ResilientTileLayer
            onTileError={onTileError}
            onTileLoad={onTileLoad}
            onLoadingChange={onLoadingChange}
          />
        </MapLibreContext.Provider>,
      );

      act(() => {
        emitMapEvent(mockMap, 'error', { sourceId: RASTER_FALLBACK_SOURCE_ID });
        emitMapEvent(mockMap, 'sourcedata', {
          sourceId: RASTER_FALLBACK_SOURCE_ID,
          isSourceLoaded: true,
        });
        emitMapEvent(mockMap, 'dataloading');
        emitMapEvent(mockMap, 'idle');
      });

      expect(onTileError).toHaveBeenCalledTimes(1);
      expect(onTileLoad).toHaveBeenCalledTimes(1);
      expect(onLoadingChange).toHaveBeenCalledWith(true);
      expect(onLoadingChange).toHaveBeenCalledWith(false);
    });

    it('khi unmount component, gỡ sạch toàn bộ listener trên map', () => {
      const mockMap = createMockMapRecord();
      const { unmount } = render(
        <MapLibreContext.Provider value={mockMap as never}>
          <ResilientTileLayer />
        </MapLibreContext.Provider>,
      );

      unmount();

      expect(mockMap.off).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockMap.off).toHaveBeenCalledWith('sourcedata', expect.any(Function));
      expect(mockMap.off).toHaveBeenCalledWith('dataloading', expect.any(Function));
      expect(mockMap.off).toHaveBeenCalledWith('idle', expect.any(Function));
      expect(mockMap.off).toHaveBeenCalledWith('load', expect.any(Function));
    });
  });

  describe('WT-MAP-04: Render MapResilienceControl tuân thủ a11y và thao tác Thử lại', () => {
    it('ở trạng thái degraded render thanh thông báo với role="status" và aria-live="polite"', () => {
      render(
        <MapResilienceControl
          status="degraded"
          activeProvider={TILE_PROVIDERS['esri-world-street']}
        />,
      );

      const statusEl = screen.getByRole('status');
      expect(statusEl).toBeTruthy();
      expect(statusEl.getAttribute('aria-live')).toBe('polite');
      expect(statusEl.textContent).toContain('providerSwitched');
    });

    it('ở trạng thái failed render thông báo lỗi kèm nút "Thử lại" đạt touch target 44px', () => {
      const onRetry = vi.fn();
      render(<MapResilienceControl status="failed" onRetry={onRetry} />);

      const retryBtn = screen.getByRole('button', { name: /retryAction/ });
      expect(retryBtn.className).toContain('min-h-11');
      expect(retryBtn.className).toContain('min-w-11');

      act(() => {
        fireEvent.click(retryBtn);
      });
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('ở trạng thái ready (ổn định bình thường), control tự ẩn', () => {
      const { container } = render(<MapResilienceControl status="ready" />);
      expect(container.firstChild).toBeNull();
    });

    it('MapResilienceBar là bí danh tương thích 100% của MapResilienceControl', () => {
      expect(MapResilienceBar).toBe(MapResilienceControl);
    });
  });

  describe('WT-MAP-05: Tích hợp PMTiles bản đồ Việt Nam qua MapLibre GL và tự fallback khi R2 lỗi', () => {
    const pmTilesProvider = {
      ...TILE_PROVIDERS['vietnam-pmtiles'],
      url: 'https://map.booksportscourt.id.vn/map/vietnam.pmtiles',
    };

    it('đăng ký pmtiles protocol và gắn style vector tiếng Việt khi nguồn là vietnam-pmtiles', () => {
      const mockMap = createMockMapRecord();

      render(
        <MapLibreContext.Provider value={mockMap as never}>
          <TileResilienceProvider
            options={{
              providers: [pmTilesProvider, TILE_PROVIDERS['esri-world-street']],
            }}
          >
            <ResilientTileLayer />
          </TileResilienceProvider>
        </MapLibreContext.Provider>,
      );

      expect(addProtocolMock).toHaveBeenCalledWith('pmtiles', expect.any(Function));
      expect(mockMap.setStyle).toHaveBeenCalledTimes(1);

      const styleArg = mockMap.setStyle.mock.calls[0]![0] as {
        sources: Record<string, { type: string; url: string; maxzoom?: number }>;
        layers: Array<{ id: string }>;
      };
      expect(styleArg.sources.protomaps?.type).toBe('vector');
      expect(styleArg.sources.protomaps?.url).toBe(
        'pmtiles://https://map.booksportscourt.id.vn/map/vietnam.pmtiles',
      );
      expect(styleArg.sources.protomaps?.maxzoom).toBe(14);
      expect(styleArg.layers.some((l) => l.id === 'bsc-sports-areas')).toBe(true);
    });

    it('tự động chuyển sang Esri dự phòng ngay khi PMTiles.getHeader() thất bại', async () => {
      const mockMap = createMockMapRecord();
      pmtilesHeaderMock.mockRejectedValue(new Error('403 Forbidden / CORS blocked'));
      const onTileError = vi.fn();

      render(
        <MapLibreContext.Provider value={mockMap as never}>
          <TileResilienceProvider
            options={{
              providers: [pmTilesProvider, TILE_PROVIDERS['esri-world-street']],
            }}
          >
            <ResilientTileLayer onTileError={onTileError} />
          </TileResilienceProvider>
        </MapLibreContext.Provider>,
      );

      expect(mockMap.setStyle).toHaveBeenCalledTimes(1);

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(onTileError).toHaveBeenCalled();
      expect(mockMap.setStyle).toHaveBeenCalledTimes(2);
      const fallbackStyle = mockMap.setStyle.mock.calls[1]![0] as {
        sources: Record<string, { tiles?: string[] }>;
      };
      expect(fallbackStyle.sources[RASTER_FALLBACK_SOURCE_ID]?.tiles).toEqual([
        TILE_PROVIDERS['esri-world-street'].url,
      ]);
    });
  });
});
