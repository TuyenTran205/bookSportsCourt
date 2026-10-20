// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

import { ResilientTileLayer } from './ResilientTileLayer';
import { TileResilienceProvider } from './TileResilienceContext';
import { MapResilienceControl } from './MapResilienceControl';
import { MapResilienceBar } from './MapResilienceBar';
import { FALLBACK_ERROR_TILE_URL, TILE_PROVIDERS } from '@/lib/map/tile-providers';

/**
 * Cấu trúc mock Leaflet động: mỗi lần L.tileLayer() được gọi sẽ tạo một layer
 * riêng biệt lưu trữ handlers tương ứng, hỗ trợ emit sự kiện chính xác trên layer mới nhất.
 */
interface LayerRecord {
  url: string;
  options: Record<string, unknown>;
  handlers: Record<string, Set<() => void>>;
  layerObj: {
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    addTo: ReturnType<typeof vi.fn>;
  };
}

let activeLayerRecords: LayerRecord[] = [];

const mapMock = {
  hasLayer: vi.fn(() => true),
  removeLayer: vi.fn(),
  addLayer: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
};

const tileLayerMock = vi.fn((url: string, options: Record<string, unknown>) => {
  const handlers: Record<string, Set<() => void>> = {};

  const layerObj = {
    on: vi.fn((event: string, cb: () => void) => {
      (handlers[event] ??= new Set()).add(cb);
      return layerObj;
    }),
    off: vi.fn((event: string, cb: () => void) => {
      handlers[event]?.delete(cb);
      return layerObj;
    }),
    addTo: vi.fn(() => layerObj),
  };

  activeLayerRecords.push({ url, options, handlers, layerObj });
  return layerObj;
});

function emitLayerEvent(event: string) {
  const current = activeLayerRecords[activeLayerRecords.length - 1];
  if (!current) return;
  const set = current.handlers[event];
  if (set) {
    // Tạo bản sao mảng để an toàn khi handler thay đổi trong quá trình lặp
    Array.from(set).forEach((cb) => cb());
  }
}

vi.mock('leaflet', () => ({
  default: { tileLayer: (...args: [string, Record<string, unknown>]) => tileLayerMock(...args) },
}));

vi.mock('react-leaflet', () => ({
  useMap: () => mapMock,
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    if (values && typeof values.name === 'string') {
      return `${key}:${values.name}`;
    }
    return key;
  },
}));

describe('ResilientTileLayer & MapResilienceControl (SPEC-MAP-003)', () => {
  beforeEach(() => {
    activeLayerRecords = [];
    tileLayerMock.mockClear();
    mapMock.hasLayer.mockClear();
    mapMock.hasLayer.mockReturnValue(true);
    mapMock.removeLayer.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  describe('WT-MAP-01: Render component trong môi trường DOM với leaflet mock', () => {
    it('render trong TileResilienceProvider không ném lỗi runtime và gắn layer vào map', () => {
      expect(() => {
        render(
          <TileResilienceProvider>
            <div data-testid="map-container">
              <ResilientTileLayer />
            </div>
          </TileResilienceProvider>,
        );
      }).not.toThrow();

      expect(tileLayerMock).toHaveBeenCalledTimes(1);
      const current = activeLayerRecords[0]!;
      expect(current.layerObj.addTo).toHaveBeenCalledWith(mapMock);
      expect(screen.getByTestId('map-container')).toBeTruthy();
    });

    it('render độc lập (self-contained) khi không có TileResilienceProvider vẫn hoạt động bình thường', () => {
      expect(() => {
        render(<ResilientTileLayer />);
      }).not.toThrow();

      expect(tileLayerMock).toHaveBeenCalledTimes(1);
      expect(activeLayerRecords[0]!.url).toBe(TILE_PROVIDERS['esri-world-street'].url);
    });
  });

  describe('WT-MAP-02: Thiết lập đúng các thuộc tính chống ô trắng cho Leaflet layer', () => {
    it('L.tileLayer nhận đúng url, attribution, maxZoom, maxNativeZoom, keepBuffer=4, updateWhenIdle=false', () => {
      render(<ResilientTileLayer />);

      expect(tileLayerMock).toHaveBeenCalledTimes(1);
      const [url, options] = tileLayerMock.mock.calls[0] as [string, Record<string, unknown>];

      expect(url).toBe(TILE_PROVIDERS['esri-world-street'].url);
      expect(options.attribution).toBe(TILE_PROVIDERS['esri-world-street'].attribution);
      expect(options.subdomains).toBe(TILE_PROVIDERS['esri-world-street'].subdomains ?? 'abc');
      expect(options.maxZoom).toBe(19);
      expect(options.maxNativeZoom).toBe(18);
      expect(options.keepBuffer).toBe(4);
      expect(options.updateWhenIdle).toBe(false);
      expect(options.crossOrigin).toBe(true);
      expect(options.opacity).toBe(1);
      // errorTileUrl trỏ về SVG Data URI Slate trung tính
      expect(options.errorTileUrl).toBe(FALLBACK_ERROR_TILE_URL);
      expect(String(options.errorTileUrl).startsWith('data:image/svg+xml')).toBe(true);
    });

    it('cho phép ghi đè keepBuffer, updateWhenIdle, errorTileUrl và detectRetina qua props', () => {
      render(
        <ResilientTileLayer
          keepBuffer={6}
          updateWhenIdle
          errorTileUrl="data:image/svg+xml;custom"
          detectRetina
          opacity={0.8}
        />,
      );

      const [, options] = tileLayerMock.mock.calls[0] as [string, Record<string, unknown>];
      expect(options.keepBuffer).toBe(6);
      expect(options.updateWhenIdle).toBe(true);
      expect(options.errorTileUrl).toBe('data:image/svg+xml;custom');
      expect(options.detectRetina).toBe(true);
      expect(options.opacity).toBe(0.8);
    });
  });

  describe('WT-MAP-03: Bắt sự kiện tileerror trên Leaflet layer và tự động chuyển nguồn', () => {
    it('lắng nghe tileerror và kích hoạt chuyển sang provider kế tiếp khi đủ 6 lỗi', () => {
      render(<ResilientTileLayer />);

      expect(tileLayerMock).toHaveBeenCalledTimes(1);
      expect(activeLayerRecords[0]!.url).toBe(TILE_PROVIDERS['esri-world-street'].url);

      // Kích hoạt 6 lỗi tileerror liên tiếp
      act(() => {
        for (let i = 0; i < 6; i++) {
          emitLayerEvent('tileerror');
        }
      });

      // Layer cũ đã được gỡ bỏ và layer mới được tạo với OSM France Humanitarian
      expect(tileLayerMock).toHaveBeenCalledTimes(2);
      expect(mapMock.removeLayer).toHaveBeenCalled();
      const current = activeLayerRecords[1]!;
      expect(current.url).toBe(TILE_PROVIDERS['osm-france-hot'].url);
      expect(current.options.attribution).toBe(TILE_PROVIDERS['osm-france-hot'].attribution);
    });

    it('dưới ngưỡng 6 lỗi không chuyển đổi layer', () => {
      render(<ResilientTileLayer />);

      act(() => {
        for (let i = 0; i < 5; i++) {
          emitLayerEvent('tileerror');
        }
      });

      expect(tileLayerMock).toHaveBeenCalledTimes(1);
      expect(mapMock.removeLayer).not.toHaveBeenCalled();
    });

    it('chuyển tiếp sự kiện tới callbacks onTileError, onTileLoad, onLoadingChange', () => {
      const onTileError = vi.fn();
      const onTileLoad = vi.fn();
      const onLoadingChange = vi.fn();

      render(
        <ResilientTileLayer
          onTileError={onTileError}
          onTileLoad={onTileLoad}
          onLoadingChange={onLoadingChange}
        />,
      );

      act(() => {
        emitLayerEvent('tileerror');
        emitLayerEvent('tileload');
        emitLayerEvent('loading');
        emitLayerEvent('load');
      });

      expect(onTileError).toHaveBeenCalledTimes(1);
      expect(onTileLoad).toHaveBeenCalledTimes(1);
      expect(onLoadingChange).toHaveBeenCalledWith(true);
      expect(onLoadingChange).toHaveBeenCalledWith(false);
    });

    it('khi unmount component, gỡ sạch sự kiện và huỷ layer khỏi map', () => {
      const { unmount } = render(<ResilientTileLayer />);
      const current = activeLayerRecords[0]!;

      unmount();

      expect(current.layerObj.off).toHaveBeenCalledWith('tileerror', expect.any(Function));
      expect(current.layerObj.off).toHaveBeenCalledWith('tileload', expect.any(Function));
      expect(current.layerObj.off).toHaveBeenCalledWith('loading', expect.any(Function));
      expect(current.layerObj.off).toHaveBeenCalledWith('load', expect.any(Function));
      expect(mapMock.hasLayer).toHaveBeenCalled();
      expect(mapMock.removeLayer).toHaveBeenCalledWith(current.layerObj);
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

      const statusEl = screen.getByRole('status');
      expect(statusEl.textContent).toContain('allProvidersFailed');

      const retryBtn = screen.getByRole('button', { name: /retryAction/ });
      expect(retryBtn).toBeTruthy();
      expect(retryBtn.className).toContain('min-h-11');
      expect(retryBtn.className).toContain('min-w-11');

      act(() => {
        fireEvent.click(retryBtn);
      });
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('ở trạng thái ready (ổn định bình thường), control tự ẩn (không render DOM)', () => {
      const { container } = render(<MapResilienceControl status="ready" />);
      expect(container.firstChild).toBeNull();
    });

    it('MapResilienceBar là bí danh tương thích 100% của MapResilienceControl', () => {
      expect(MapResilienceBar).toBe(MapResilienceControl);
    });
  });
});
