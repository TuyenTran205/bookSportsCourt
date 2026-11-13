/**
 * Danh mục nhà cung cấp tile bản đồ và logic chọn nguồn dự phòng (SPEC-MAP-002)
 */

import type { TileProviderConfig, MapProviderId } from './types';

/**
 * Fallback SVG Data URI nền Slate trung tính với lưới mỏng 1px chống ô trắng.
 * Dung lượng 338 bytes (dưới ngưỡng 400 bytes trong đặc tả), không phát sinh request HTTP.
 * Nền #f8fafc, lưới #e2e8f0, điểm toạ độ mờ #cbd5e1.
 */
export const FALLBACK_ERROR_TILE_URL =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNTYiIGhlaWdodD0iMjU2Ij48cmVjdCB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgZmlsbD0iI2Y4ZmFmYyIvPjxwYXRoIGQ9Ik0wIDg1aDI1Nk0wIDE3MGgyNTZNODUgMHYyNTZNMTcwIDB2MjU2IiBzdHJva2U9IiNlMmU4ZjAiLz48Y2lyY2xlIGN4PSIxMjgiIGN5PSIxMjgiIHI9IjUiIGZpbGw9IiNjYmQ1ZTEiLz48L3N2Zz4=';

/** Danh mục cấu hình gốc của các nhà cung cấp tile */
export const TILE_PROVIDERS: Record<MapProviderId, TileProviderConfig> = {
  'vietnam-pmtiles': {
    id: 'vietnam-pmtiles',
    name: 'Bản đồ Việt Nam (PMTiles)',
    label: 'Bản đồ Việt Nam (BookSportsCourt)',
    url: '{pmtilesUrl}',
    attribution:
      '&copy; BookSportsCourt &middot; &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> &middot; <a href="https://protomaps.com" target="_blank" rel="noopener noreferrer">Protomaps</a>',
    maxZoom: 19,
    maxNativeZoom: 14,
    maxDataZoom: 14,
    format: 'pmtiles',
    requiresKey: true,
    keyEnvVar: 'NEXT_PUBLIC_VIETNAM_PMTILES_URL',
    priority: -1,
    supportsRetina: true,
  },
  'carto-voyager': {
    id: 'carto-voyager',
    name: 'CARTO Voyager',
    label: 'CARTO Voyager',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key={apiKey}',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>',
    subdomains: ['a', 'b', 'c', 'd'],
    maxZoom: 19,
    maxNativeZoom: 18,
    requiresKey: true,
    keyEnvVar: 'NEXT_PUBLIC_CARTO_API_KEY',
    priority: 0,
    supportsRetina: true,
  },
  'esri-world-street': {
    id: 'esri-world-street',
    name: 'Esri World Street Map',
    label: 'Esri World Street Map',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution:
      '&copy; <a href="https://www.esri.com/" target="_blank" rel="noopener noreferrer">Esri</a>, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom',
    maxZoom: 19,
    maxNativeZoom: 18,
    requiresKey: false,
    priority: 1,
    supportsRetina: false,
  },
  'osm-france-hot': {
    id: 'osm-france-hot',
    name: 'OSM France Humanitarian',
    label: 'OSM France Humanitarian',
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/" target="_blank" rel="noopener noreferrer">HOT</a>',
    subdomains: ['a', 'b'],
    maxZoom: 19,
    maxNativeZoom: 18,
    requiresKey: false,
    priority: 2,
    supportsRetina: false,
  },
  opentopomap: {
    id: 'opentopomap',
    name: 'OpenTopoMap',
    label: 'OpenTopoMap',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution:
      'Map data: &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org" target="_blank" rel="noopener noreferrer">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org" target="_blank" rel="noopener noreferrer">OpenTopoMap</a>',
    subdomains: ['a', 'b', 'c'],
    maxZoom: 17,
    maxNativeZoom: 17,
    requiresKey: false,
    priority: 3,
    supportsRetina: false,
  },
  'osm-standard': {
    id: 'osm-standard',
    name: 'OpenStreetMap Standard',
    label: 'OpenStreetMap Standard',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    subdomains: ['a', 'b', 'c'],
    maxZoom: 19,
    maxNativeZoom: 18,
    requiresKey: false,
    priority: 4,
    supportsRetina: false,
  },
  'maptiler-streets': {
    id: 'maptiler-streets',
    name: 'MapTiler Streets',
    label: 'MapTiler Streets',
    url: 'https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key={apiKey}',
    attribution:
      '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener noreferrer">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    maxZoom: 19,
    maxNativeZoom: 19,
    requiresKey: true,
    keyEnvVar: 'NEXT_PUBLIC_MAPTILER_API_KEY',
    priority: 0,
    supportsRetina: true,
  },
  'stadia-smooth': {
    id: 'stadia-smooth',
    name: 'Stadia Alidade Smooth',
    label: 'Stadia Alidade Smooth',
    url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key={apiKey}',
    attribution:
      '&copy; <a href="https://stadiamaps.com/" target="_blank" rel="noopener noreferrer">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    maxZoom: 20,
    maxNativeZoom: 18,
    requiresKey: true,
    keyEnvVar: 'NEXT_PUBLIC_STADIA_API_KEY',
    priority: 0,
    supportsRetina: true,
  },
  'geoapify-osm-bright': {
    id: 'geoapify-osm-bright',
    name: 'Geoapify OSM Bright',
    label: 'Geoapify OSM Bright',
    url: 'https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey={apiKey}',
    attribution:
      '&copy; <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">Geoapify</a>, &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    maxZoom: 19,
    maxNativeZoom: 18,
    requiresKey: true,
    keyEnvVar: 'NEXT_PUBLIC_GEOAPIFY_API_KEY',
    priority: 0,
    supportsRetina: false,
  },
  'thunderforest-transport': {
    id: 'thunderforest-transport',
    name: 'Thunderforest Transport',
    label: 'Thunderforest Transport',
    url: 'https://{s}.tile.thunderforest.com/transport/{z}/{x}/{y}.png?apikey={apiKey}',
    attribution:
      '&copy; <a href="https://www.thunderforest.com/" target="_blank" rel="noopener noreferrer">Thunderforest</a>, &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    subdomains: ['a', 'b', 'c'],
    maxZoom: 19,
    maxNativeZoom: 18,
    requiresKey: true,
    keyEnvVar: 'NEXT_PUBLIC_THUNDERFOREST_API_KEY',
    priority: 0,
    supportsRetina: false,
  },
};

/** URL font glyphs (.pbf) mặc định hỗ trợ tiếng Việt cho MapLibre GL JS (miễn phí, hỗ trợ CORS) */
export const DEFAULT_MAP_GLYPHS_URL =
  'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf';

/** Cấu hình biến môi trường hỗ trợ */
export interface MapEnvConfig {
  NEXT_PUBLIC_VIETNAM_PMTILES_URL?: string;
  NEXT_PUBLIC_MAP_GLYPHS_URL?: string;
  NEXT_PUBLIC_CARTO_API_KEY?: string;
  NEXT_PUBLIC_MAPTILER_API_KEY?: string;
  NEXT_PUBLIC_STADIA_API_KEY?: string;
  NEXT_PUBLIC_GEOAPIFY_API_KEY?: string;
  NEXT_PUBLIC_THUNDERFOREST_API_KEY?: string;
  NEXT_PUBLIC_DEFAULT_MAP_PROVIDER?: string;
}

/**
 * Đọc tĩnh các biến môi trường NEXT_PUBLIC_* tại build time.
 * Chú ý: Next.js chỉ inline biến môi trường tĩnh khi truy cập trực tiếp process.env.NEXT_PUBLIC_*.
 */
function readStaticEnv(): MapEnvConfig {
  return {
    NEXT_PUBLIC_VIETNAM_PMTILES_URL: process.env.NEXT_PUBLIC_VIETNAM_PMTILES_URL,
    NEXT_PUBLIC_MAP_GLYPHS_URL: process.env.NEXT_PUBLIC_MAP_GLYPHS_URL,
    NEXT_PUBLIC_CARTO_API_KEY: process.env.NEXT_PUBLIC_CARTO_API_KEY,
    NEXT_PUBLIC_MAPTILER_API_KEY: process.env.NEXT_PUBLIC_MAPTILER_API_KEY,
    NEXT_PUBLIC_STADIA_API_KEY: process.env.NEXT_PUBLIC_STADIA_API_KEY,
    NEXT_PUBLIC_GEOAPIFY_API_KEY: process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY,
    NEXT_PUBLIC_THUNDERFOREST_API_KEY: process.env.NEXT_PUBLIC_THUNDERFOREST_API_KEY,
    NEXT_PUBLIC_DEFAULT_MAP_PROVIDER: process.env.NEXT_PUBLIC_DEFAULT_MAP_PROVIDER,
  };
}

/**
 * Lấy URL font glyphs (.pbf) cho MapLibre GL JS.
 * Ưu tiên `NEXT_PUBLIC_MAP_GLYPHS_URL` (trỏ tới R2/CDN riêng), mặc định dùng Protomaps basemaps-assets.
 */
export function getMapGlyphsUrl(customEnv?: Partial<MapEnvConfig>): string {
  const configured = (customEnv?.NEXT_PUBLIC_MAP_GLYPHS_URL ?? readStaticEnv().NEXT_PUBLIC_MAP_GLYPHS_URL)?.trim();
  return configured && configured.length > 0 ? configured : DEFAULT_MAP_GLYPHS_URL;
}

/**
 * Mở rộng mẫu URL raster chứa `{s}` (subdomains) và `{r}` (retina `@2x`) thành danh sách URL
 * tương thích với `tiles` array trong MapLibre `raster` source.
 */
export function expandRasterTileUrls(
  provider: TileProviderConfig,
  detectRetina?: boolean,
): string[] {
  const useRetina = Boolean(detectRetina ?? provider.supportsRetina);
  const retinaSuffix = useRetina && provider.supportsRetina ? '@2x' : '';
  const urlWithRetina = provider.url.replace('{r}', retinaSuffix);

  if (!urlWithRetina.includes('{s}')) {
    return [urlWithRetina];
  }

  const rawSubdomains = provider.subdomains ?? ['a', 'b', 'c'];
  const subdomainList = Array.isArray(rawSubdomains)
    ? rawSubdomains
    : rawSubdomains.split('').filter(Boolean);

  if (subdomainList.length === 0) {
    return [urlWithRetina.replace('{s}', 'a')];
  }

  return subdomainList.map((subdomain) => urlWithRetina.replace('{s}', subdomain));
}

/**
 * Ánh xạ tên biến môi trường tới giá trị tương ứng trong MapEnvConfig.
 */
function resolveConfigValue(env: MapEnvConfig, keyEnvVar?: string): string | undefined {
  switch (keyEnvVar) {
    case 'NEXT_PUBLIC_VIETNAM_PMTILES_URL':
      return env.NEXT_PUBLIC_VIETNAM_PMTILES_URL;
    case 'NEXT_PUBLIC_CARTO_API_KEY':
      return env.NEXT_PUBLIC_CARTO_API_KEY;
    case 'NEXT_PUBLIC_MAPTILER_API_KEY':
      return env.NEXT_PUBLIC_MAPTILER_API_KEY;
    case 'NEXT_PUBLIC_STADIA_API_KEY':
      return env.NEXT_PUBLIC_STADIA_API_KEY;
    case 'NEXT_PUBLIC_GEOAPIFY_API_KEY':
      return env.NEXT_PUBLIC_GEOAPIFY_API_KEY;
    case 'NEXT_PUBLIC_THUNDERFOREST_API_KEY':
      return env.NEXT_PUBLIC_THUNDERFOREST_API_KEY;
    default:
      return undefined;
  }
}

/**
 * Lấy danh sách các nhà cung cấp tile khả dụng đã sắp xếp theo độ ưu tiên.
 * Hàm thuần (pure function), không side-effect, dễ dàng kiểm thử bằng cách truyền customEnv.
 *
 * Thứ tự ưu tiên mặc định:
 * Bản đồ Việt Nam PMTiles (-1, nếu cấu hình URL) -> Provider có API key (0) -> Esri World Street (1)
 * -> OSM France HOT (2) -> OpenTopoMap (3) -> OSM Standard (4).
 * Nếu NEXT_PUBLIC_DEFAULT_MAP_PROVIDER được chỉ định, provider đó sẽ được đưa lên vị trí đầu tiên.
 */
export function getTileProviders(customEnv?: Partial<MapEnvConfig>): TileProviderConfig[] {
  const env: MapEnvConfig = {
    ...readStaticEnv(),
    ...customEnv,
  };

  const available: TileProviderConfig[] = [];

  for (const provider of Object.values(TILE_PROVIDERS)) {
    if (!provider.requiresKey) {
      available.push({ ...provider });
      continue;
    }

    const trimmedValue = resolveConfigValue(env, provider.keyEnvVar)?.trim();
    if (trimmedValue && trimmedValue.length > 0) {
      const resolvedUrl = provider.url
        .replace('{pmtilesUrl}', trimmedValue)
        .replace('{apiKey}', trimmedValue)
        .replace('{key}', trimmedValue);
      available.push({
        ...provider,
        url: resolvedUrl,
      });
    }
  }

  // Sắp xếp theo priority tăng dần (số nhỏ hơn đứng trước: 0 -> 1 -> 2 -> 3 -> 4 -> 5)
  available.sort((a, b) => a.priority - b.priority);

  // Tôn trọng cấu hình NEXT_PUBLIC_DEFAULT_MAP_PROVIDER nếu có
  const defaultProviderId = env.NEXT_PUBLIC_DEFAULT_MAP_PROVIDER?.trim();
  if (defaultProviderId) {
    const targetIndex = available.findIndex((p) => p.id === defaultProviderId);
    if (targetIndex > 0) {
      const [preferred] = available.splice(targetIndex, 1);
      if (preferred) {
        available.unshift(preferred);
      }
    }
  }

  return available;
}
