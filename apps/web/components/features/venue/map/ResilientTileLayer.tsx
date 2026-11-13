'use client';

/**
 * Thành phần bản đồ MapLibre GL JS (WebGL 60fps) & tự phục hồi nguồn tile (SPEC-MAP-002, ADR-031).
 *
 * - `MapLibreCanvas`: Khởi tạo `maplibregl.Map`, `NavigationControl`, `ResizeObserver`,
 *   trạng thái skeleton khi tải và fallback UI nếu thiết bị không hỗ trợ / mất WebGL.
 * - `ResilientTileLayer`: Áp dụng style `vietnam.pmtiles` hoặc raster fallback qua
 *   `map.setStyle()`, sử dụng `PMTiles` Singleton (`SharedPromiseCache(1000)` + RAM LRU),
 *   và lắng nghe lỗi nguồn dữ liệu để tự chuyển provider không làm mất góc nhìn.
 */

import * as React from 'react';
import {
  Map as MapLibreMap,
  NavigationControl,
  setWorkerUrl,
  type StyleSpecification,
} from 'maplibre-gl';
import { RefreshCw } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { ensurePmTilesProtocolRegistered, getOrCreatePmTiles } from '@/lib/map/pmtiles-protocol';
import { TILE_PROVIDERS, getMapGlyphsUrl } from '@/lib/map/tile-providers';
import type { TileProviderConfig } from '@/lib/map/types';
import { useTileResilience, type UseTileResilienceReturn } from '@/lib/map/useTileResilience';
import {
  RASTER_FALLBACK_SOURCE_ID,
  VIETNAM_MAP_MAX_BOUNDS,
  VIETNAM_PMTILES_BACKGROUND,
  buildRasterFallbackStyle,
  buildVietnamMapStyle,
} from '@/lib/map/vietnam-theme';
import { cn } from '@/lib/utils/cn';
import { useOptionalTileResilience } from './TileResilienceContext';

const DEFAULT_CENTER_LNGLAT: [number, number] = [106.700806, 10.776889];

/**
 * WebWorker tĩnh của `maplibre-gl@6.18.0` (chép từ `maplibre-gl/dist/maplibre-gl-worker.mjs`).
 * Cần thiết vì Webpack 5 trong Next.js 14 đóng gói `import.meta.url` thành `file:///...`,
 * khiến worker mặc định của MapLibre bị trả về chuỗi rỗng và canvas hiển thị trắng.
 */
export const MAPLIBRE_WORKER_URL = '/maplibre-gl-worker.js';

const INITIAL_BLANK_STYLE: StyleSpecification = {
  version: 8,
  glyphs: getMapGlyphsUrl(),
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: {
        'background-color': VIETNAM_PMTILES_BACKGROUND,
      },
    },
  ],
};

export const MapLibreContext = React.createContext<MapLibreMap | null>(null);

/** Lấy instance `maplibregl.Map` từ `MapLibreCanvas` gần nhất (hoặc `null` nếu chưa sẵn sàng). */
export function useMapLibre(): MapLibreMap | null {
  return React.useContext(MapLibreContext);
}

export interface MapLibreCanvasProps {
  /** Tâm bản đồ ban đầu theo `[lng, lat]` */
  center?: [number, number];
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  maxBounds?: [[number, number], [number, number]];
  scrollWheelZoom?: boolean;
  showNavigationControl?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export function MapLibreCanvas({
  center = DEFAULT_CENTER_LNGLAT,
  zoom = 13,
  minZoom = 4,
  maxZoom = 19,
  maxBounds = VIETNAM_MAP_MAX_BOUNDS,
  scrollWheelZoom = true,
  showNavigationControl = true,
  className,
  style,
  children,
}: MapLibreCanvasProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const initialCenterRef = React.useRef(center);
  const initialZoomRef = React.useRef(zoom);

  const [mapInstance, setMapInstance] = React.useState<MapLibreMap | null>(null);
  const [isMapReady, setIsMapReady] = React.useState(false);
  const [webglError, setWebglError] = React.useState<string | null>(null);
  const [mountNonce, setMountNonce] = React.useState(0);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let map: MapLibreMap;
    try {
      if (typeof setWorkerUrl === 'function') {
        setWorkerUrl(MAPLIBRE_WORKER_URL);
      }
      ensurePmTilesProtocolRegistered();
      map = new MapLibreMap({
        container,
        style: INITIAL_BLANK_STYLE,
        center: initialCenterRef.current,
        zoom: initialZoomRef.current,
        minZoom,
        maxZoom,
        maxBounds,
        scrollZoom: scrollWheelZoom,
        attributionControl: { compact: true },
      });
    } catch {
      setWebglError('Trình duyệt hoặc thiết bị hiện chưa hỗ trợ hiển thị bản đồ WebGL.');
      return undefined;
    }

    if (showNavigationControl) {
      map.addControl(new NavigationControl({ showCompass: false }), 'top-left');
    }

    const markReady = () => {
      setIsMapReady(true);
    };

    const handleWebglContextLost = (event: Event) => {
      event.preventDefault();
      setWebglError('Kết nối đồ họa WebGL tạm thời bị gián đoạn.');
    };

    const handleWebglContextRestored = () => {
      setWebglError(null);
      map.resize();
    };

    map.on('styledata', markReady);
    map.on('sourcedata', markReady);
    map.on('load', markReady);
    map.on('idle', markReady);

    const canvas = typeof map.getCanvas === 'function' ? map.getCanvas() : null;
    canvas?.addEventListener('webglcontextlost', handleWebglContextLost);
    canvas?.addEventListener('webglcontextrestored', handleWebglContextRestored);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        map.resize();
      });
      resizeObserver.observe(container);
    }

    setWebglError(null);
    setIsMapReady(true);
    setMapInstance(map);

    return () => {
      resizeObserver?.disconnect();
      canvas?.removeEventListener('webglcontextlost', handleWebglContextLost);
      canvas?.removeEventListener('webglcontextrestored', handleWebglContextRestored);
      map.off('styledata', markReady);
      map.off('sourcedata', markReady);
      map.off('load', markReady);
      map.off('idle', markReady);
      map.remove();
      setMapInstance(null);
      setIsMapReady(false);
    };
  }, [maxBounds, maxZoom, minZoom, mountNonce, scrollWheelZoom, showNavigationControl]);

  React.useEffect(() => {
    if (!mapInstance) return;
    if (scrollWheelZoom) {
      mapInstance.scrollZoom.enable();
    } else {
      mapInstance.scrollZoom.disable();
    }
  }, [mapInstance, scrollWheelZoom]);

  const handleRetryWebgl = React.useCallback(() => {
    setWebglError(null);
    setMountNonce((value) => value + 1);
  }, []);

  return (
    <MapLibreContext.Provider value={mapInstance}>
      <div className={cn('relative size-full overflow-hidden', className)} style={style}>
        {/* Container rỗng dành riêng cho MapLibre quản lý DOM canvas */}
        <div ref={containerRef} className="size-full" />

        {!isMapReady && !webglError && (
          <div
            aria-label="Đang tải bản đồ"
            className="pointer-events-none absolute inset-0 z-10 bg-neutral-50"
          >
            <Skeleton className="size-full rounded-none" />
          </div>
        )}

        {webglError && (
          <div
            role="alert"
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-neutral-50 p-4 text-center"
          >
            <p className="max-w-xs text-sm font-medium text-neutral-700">{webglError}</p>
            <button
              type="button"
              onClick={handleRetryWebgl}
              className="inline-flex min-h-11 min-w-11 items-center gap-1.5 rounded-btn border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold text-neutral-800 shadow-xs transition hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              <span>Thử tải lại bản đồ</span>
            </button>
          </div>
        )}

        {children}
      </div>
    </MapLibreContext.Provider>
  );
}

export interface ResilientTileLayerProps {
  /** Ghi đè instance MapLibre (tuỳ chọn; mặc định lấy từ `MapLibreCanvas`) */
  map?: MapLibreMap | null;
  /** Ghi đè provider đang hiển thị (mặc định lấy từ trạng thái tự phục hồi) */
  activeProvider?: TileProviderConfig;
  /** Callback tuỳ biến khi một tile/source lỗi (chạy song song với báo cáo nội bộ) */
  onTileError?: () => void;
  /** Callback tuỳ biến khi một tile/source tải xong (chạy song song với báo cáo nội bộ) */
  onTileLoad?: () => void;
  /** Báo trạng thái tải tile của cả khung nhìn (bắt đầu / kết thúc) */
  onLoadingChange?: (isLoading: boolean) => void;
  /** Tuỳ chọn giữ tương thích interface cũ */
  keepBuffer?: number;
  /** Tuỳ chọn giữ tương thích interface cũ */
  updateWhenIdle?: boolean;
  /** Tuỳ chọn giữ tương thích interface cũ */
  errorTileUrl?: string;
  /** Bật tile @2x cho màn hình retina (mặc định theo provider) */
  detectRetina?: boolean;
  /** Độ mờ của lớp tile raster (0–1) */
  opacity?: number;
}

interface ControlledTileLayerProps extends ResilientTileLayerProps {
  resilience: UseTileResilienceReturn;
}

interface MapSourceEventLike {
  sourceId?: string;
  isSourceLoaded?: boolean;
  sourceDataType?: string;
  tile?: unknown;
  error?: { name?: string; message?: string };
}

function ControlledTileLayer({
  map: mapProp,
  resilience,
  activeProvider,
  onTileError,
  onTileLoad,
  onLoadingChange,
  detectRetina,
  opacity = 1,
}: ControlledTileLayerProps) {
  const contextMap = useMapLibre();
  const map = mapProp ?? contextMap;
  const provider = activeProvider ?? resilience.activeProvider;
  const shouldDetectRetina = detectRetina ?? Boolean(provider.supportsRetina);

  const handlersRef = React.useRef({ onTileError, onTileLoad, onLoadingChange });
  React.useEffect(() => {
    handlersRef.current = { onTileError, onTileLoad, onLoadingChange };
  }, [onTileError, onTileLoad, onLoadingChange]);

  const reportErrorRef = React.useRef(resilience.reportTileError);
  const reportLoadRef = React.useRef(resilience.reportTileLoad);
  const switchToNextProviderRef = React.useRef(resilience.switchToNextProvider);
  React.useEffect(() => {
    reportErrorRef.current = resilience.reportTileError;
    reportLoadRef.current = resilience.reportTileLoad;
    switchToNextProviderRef.current = resilience.switchToNextProvider;
  }, [resilience.reportTileError, resilience.reportTileLoad, resilience.switchToNextProvider]);

  React.useEffect(() => {
    if (!map) return undefined;

    let isDisposed = false;
    const isPmTiles = provider.format === 'pmtiles';

    if (isPmTiles) {
      ensurePmTilesProtocolRegistered();
      const pmtilesClient = getOrCreatePmTiles(provider.url);

      // Kiểm tra header ngay khi gắn style: nếu R2 lỗi/chặn CORS/404 sẽ chuyển fallback tức thì
      pmtilesClient.getHeader().catch(() => {
        if (isDisposed) return;
        reportErrorRef.current();
        handlersRef.current.onTileError?.();
        switchToNextProviderRef.current();
      });

      const styleSpec = buildVietnamMapStyle(provider.url, {
        attribution: provider.attribution,
        maxDataZoom: provider.maxDataZoom ?? provider.maxNativeZoom,
      });
      map.setStyle(styleSpec, { diff: false });
    } else {
      const styleSpec = buildRasterFallbackStyle(provider, {
        detectRetina: shouldDetectRetina,
        opacity,
      });
      map.setStyle(styleSpec, { diff: false });
    }

    const activeSourceId = isPmTiles ? 'protomaps' : RASTER_FALLBACK_SOURCE_ID;

    const handleMapError = (event?: MapSourceEventLike) => {
      if (isDisposed) return;
      if (
        event?.error?.name === 'AbortError' ||
        /abort/i.test(event?.error?.message ?? '')
      ) {
        return;
      }
      if (!event?.sourceId || event.sourceId !== activeSourceId) {
        return;
      }
      reportErrorRef.current();
      handlersRef.current.onTileError?.();
    };

    const handleSourceData = (event?: MapSourceEventLike) => {
      if (isDisposed) return;
      if (event?.sourceId && event.sourceId !== activeSourceId) {
        return;
      }
      if (event?.isSourceLoaded || event?.sourceDataType === 'content' || event?.tile) {
        reportLoadRef.current();
        handlersRef.current.onTileLoad?.();
      }
    };

    const handleDataLoading = () => {
      if (isDisposed) return;
      handlersRef.current.onLoadingChange?.(true);
    };

    const handleIdle = () => {
      if (isDisposed) return;
      handlersRef.current.onLoadingChange?.(false);
    };

    const handleLoad = () => {
      if (isDisposed) return;
      reportLoadRef.current();
      handlersRef.current.onTileLoad?.();
      handlersRef.current.onLoadingChange?.(false);
    };

    map.on('error', handleMapError as unknown as () => void);
    map.on('sourcedata', handleSourceData as unknown as () => void);
    map.on('dataloading', handleDataLoading);
    map.on('idle', handleIdle);
    map.on('load', handleLoad);

    return () => {
      isDisposed = true;
      map.off('error', handleMapError as unknown as () => void);
      map.off('sourcedata', handleSourceData as unknown as () => void);
      map.off('dataloading', handleDataLoading);
      map.off('idle', handleIdle);
      map.off('load', handleLoad);
    };
  }, [
    map,
    provider,
    shouldDetectRetina,
    opacity,
  ]);

  return null;
}

/** Biến thể tự quản lý trạng thái khi không nằm trong TileResilienceProvider */
function SelfContainedTileLayer(props: ResilientTileLayerProps) {
  const resilience = useTileResilience();
  return <ControlledTileLayer {...props} resilience={resilience} />;
}

export function ResilientTileLayer(props: ResilientTileLayerProps) {
  const shared = useOptionalTileResilience();

  if (shared) {
    return <ControlledTileLayer {...props} resilience={shared} />;
  }

  return <SelfContainedTileLayer {...props} />;
}

/** Provider mặc định dùng khi không xác định được nguồn nào khả dụng */
export const DEFAULT_MAP_PROVIDER: TileProviderConfig = TILE_PROVIDERS['esri-world-street'];

export { ControlledTileLayer };
