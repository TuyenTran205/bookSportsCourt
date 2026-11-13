/**
 * Chủ đề bản đồ tự decor cho BookSportsCourt trên MapLibre GL JS (ADR-031).
 *
 * Bảng màu đồng bộ với Design System (nền Slate trung tính, khu thể thao/công viên
 * xanh sân cỏ #16a34a/#dcfce7, đường giao thông sáng sạch, ưu tiên nhãn tiếng Việt,
 * tích hợp nhãn chủ quyền Biển Đông, Quần đảo Hoàng Sa và Quần đảo Trường Sa).
 */

import { layers, type Flavor } from '@protomaps/basemaps';
import type {
  GeoJSONSourceSpecification,
  LayerSpecification,
  StyleSpecification,
} from 'maplibre-gl';

import { expandRasterTileUrls, getMapGlyphsUrl } from './tile-providers';
import type { TileProviderConfig } from './types';
import maritimeGeoJson from './vietnam-islands.json';

export type MapFlavor = Flavor;

export const MARITIME_GEOJSON_SOURCE_ID = 'vietnam-islands';
export const RASTER_FALLBACK_SOURCE_ID = 'raster-tiles';

const SPORTS_LANDUSE_KINDS = [
  'pitch',
  'sports_centre',
  'stadium',
  'recreation_ground',
  'track',
  'golf_course',
] as const;

const VIETNAM_SPORTS_FLAVOR: Flavor = {
  background: '#f8fafc',
  earth: '#f8fafc',
  park_a: '#dcfce7',
  park_b: '#bbf7d0',
  hospital: '#fee2e2',
  industrial: '#f1f5f9',
  school: '#fef9c3',
  wood_a: '#dcfce7',
  wood_b: '#bbf7d0',
  pedestrian: '#f1f5f9',
  scrub_a: '#f0fdf4',
  scrub_b: '#dcfce7',
  glacier: '#ffffff',
  sand: '#fef3c7',
  beach: '#fef3c7',
  aerodrome: '#f1f5f9',
  runway: '#cbd5e1',
  water: '#dbeafe',
  zoo: '#ecfdf5',
  military: '#f1f5f9',
  tunnel_other_casing: '#cbd5e1',
  tunnel_minor_casing: '#cbd5e1',
  tunnel_link_casing: '#f59e0b',
  tunnel_major_casing: '#cbd5e1',
  tunnel_highway_casing: '#f59e0b',
  tunnel_other: '#f1f5f9',
  tunnel_minor: '#f8fafc',
  tunnel_link: '#fef3c7',
  tunnel_major: '#f8fafc',
  tunnel_highway: '#fde68a',
  pier: '#e2e8f0',
  buildings: '#e2e8f0',
  minor_service_casing: '#e2e8f0',
  minor_casing: '#cbd5e1',
  link_casing: '#f59e0b',
  major_casing_late: '#cbd5e1',
  highway_casing_late: '#f59e0b',
  other: '#f1f5f9',
  minor_service: '#ffffff',
  minor_a: '#ffffff',
  minor_b: '#ffffff',
  link: '#fef3c7',
  major_casing_early: '#cbd5e1',
  major: '#ffffff',
  highway_casing_early: '#f59e0b',
  highway: '#fde68a',
  railway: '#94a3b8',
  boundaries: '#94a3b8',
  bridges_other_casing: '#cbd5e1',
  bridges_minor_casing: '#cbd5e1',
  bridges_link_casing: '#f59e0b',
  bridges_major_casing: '#cbd5e1',
  bridges_highway_casing: '#f59e0b',
  bridges_other: '#f1f5f9',
  bridges_minor: '#ffffff',
  bridges_link: '#fef3c7',
  bridges_major: '#ffffff',
  bridges_highway: '#fde68a',
  roads_label_minor: '#475569',
  roads_label_minor_halo: '#ffffff',
  roads_label_major: '#1e293b',
  roads_label_major_halo: '#ffffff',
  ocean_label: '#0284c7',
  subplace_label: '#475569',
  subplace_label_halo: '#ffffff',
  city_label: '#0f172a',
  city_label_halo: '#ffffff',
  state_label: '#334155',
  state_label_halo: '#ffffff',
  country_label: '#0f172a',
  address_label: '#64748b',
  address_label_halo: '#ffffff',
  regular: 'Noto Sans Regular',
  bold: 'Noto Sans Medium',
  italic: 'Noto Sans Italic',
  pois: {
    blue: '#0284c7',
    green: '#16a34a',
    lapis: '#1d4ed8',
    pink: '#db2777',
    red: '#dc2626',
    slategray: '#475569',
    tangerine: '#ea580c',
    turquoise: '#0d9488',
  },
  landcover: {
    barren: '#f1f5f9',
    farmland: '#f0fdf4',
    forest: '#bbf7d0',
    glacier: '#ffffff',
    grassland: '#dcfce7',
    scrub: '#ecfdf5',
    urban_area: '#f1f5f9',
  },
};

export const BSC_VIETNAM_FLAVOR: Flavor = VIETNAM_SPORTS_FLAVOR;
export const VIETNAM_PMTILES_BACKGROUND = VIETNAM_SPORTS_FLAVOR.background;

/** Khung toạ độ chuẩn `[south, west], [north, east]` bao phủ Việt Nam, Hoàng Sa và Trường Sa */
export const VIETNAM_PMTILES_BOUNDS: [[number, number], [number, number]] = [
  [6.5, 102.0],
  [23.5, 118.0],
];

/** Giới hạn kéo bản đồ cho MapLibre theo thứ tự `[lng, lat]` */
export const VIETNAM_MAP_MAX_BOUNDS: [[number, number], [number, number]] = [
  [100.0, 5.0],
  [120.0, 25.0],
];

export const MARITIME_GEOJSON_DATA = maritimeGeoJson as GeoJSONSourceSpecification['data'];

/** Tạo danh sách các layer nhãn chủ quyền Biển Đông, Hoàng Sa, Trường Sa cho MapLibre */
export function createMaritimeLayers(): LayerSpecification[] {
  return [
    {
      id: 'bsc-maritime-sea-labels',
      type: 'symbol',
      source: MARITIME_GEOJSON_SOURCE_ID,
      maxzoom: 10,
      filter: ['==', ['get', 'kind'], 'sea'],
      layout: {
        'text-field': [
          'case',
          ['has', 'subtitle'],
          ['concat', ['get', 'name'], '\n', ['get', 'subtitle']],
          ['get', 'name'],
        ],
        'text-font': ['Noto Sans Medium'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 4, 11, 8, 13],
        'text-letter-spacing': 0.14,
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#475569',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5,
      },
    },
    {
      id: 'bsc-maritime-archipelago-labels',
      type: 'symbol',
      source: MARITIME_GEOJSON_SOURCE_ID,
      maxzoom: 10,
      filter: ['==', ['get', 'kind'], 'archipelago'],
      layout: {
        'text-field': [
          'case',
          ['has', 'subtitle'],
          ['concat', ['get', 'name'], '\n', ['get', 'subtitle']],
          ['get', 'name'],
        ],
        'text-font': ['Noto Sans Medium'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 4, 10, 8, 12],
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#1e293b',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5,
      },
    },
  ];
}

export interface BuildVietnamMapStyleOptions {
  glyphsUrl?: string;
  attribution?: string;
  maxDataZoom?: number;
}

/**
 * Tạo MapLibre Style Specification hoàn chỉnh cho `vietnam.pmtiles`,
 * nhấn mạnh các cụm sân thể thao, ưu tiên nhãn tiếng Việt và lớp chủ quyền biển đảo.
 */
export function buildVietnamMapStyle(
  pmtilesUrl: string,
  options?: BuildVietnamMapStyleOptions,
): StyleSpecification {
  const normalizedUrl = pmtilesUrl.startsWith('pmtiles://')
    ? pmtilesUrl
    : `pmtiles://${pmtilesUrl}`;
  const glyphsUrl = options?.glyphsUrl ?? getMapGlyphsUrl();

  const rawLayers = layers('protomaps', VIETNAM_SPORTS_FLAVOR, {
    lang: 'vi',
  }) as unknown as LayerSpecification[];

  // Ẩn nhãn tên biển mặc định từ tile quốc tế để thay bằng nhãn chủ quyền tiếng Việt
  const filteredLayers = rawLayers.filter((layer) => {
    const sourceLayer = 'source-layer' in layer ? layer['source-layer'] : undefined;
    return !(sourceLayer === 'water' && layer.type === 'symbol');
  });

  const sportsAreasLayer: LayerSpecification = {
    id: 'bsc-sports-areas',
    type: 'fill',
    source: 'protomaps',
    'source-layer': 'landuse',
    minzoom: 11,
    filter: ['in', ['get', 'kind'], ['literal', [...SPORTS_LANDUSE_KINDS]]],
    paint: {
      'fill-color': '#dcfce7',
      'fill-outline-color': '#16a34a',
      'fill-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.65, 13, 0.9],
    },
  };

  // Chèn lớp highlight thể thao ngay trước lớp đường giao thông đầu tiên
  const firstRoadIndex = filteredLayers.findIndex(
    (layer) => 'source-layer' in layer && layer['source-layer'] === 'roads',
  );

  const layersWithSports =
    firstRoadIndex >= 0
      ? [
          ...filteredLayers.slice(0, firstRoadIndex),
          sportsAreasLayer,
          ...filteredLayers.slice(firstRoadIndex),
        ]
      : [...filteredLayers, sportsAreasLayer];

  const sportsPoiLabelsLayer: LayerSpecification = {
    id: 'bsc-sports-poi-labels',
    type: 'symbol',
    source: 'protomaps',
    'source-layer': 'pois',
    minzoom: 13,
    filter: ['in', ['get', 'kind'], ['literal', [...SPORTS_LANDUSE_KINDS]]],
    layout: {
      'text-field': ['coalesce', ['get', 'name:vi'], ['get', 'name']],
      'text-font': ['Noto Sans Medium'],
      'text-size': 11,
      'text-max-width': 10,
      'text-padding': 4,
    },
    paint: {
      'text-color': '#15803d',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.5,
    },
  };

  return {
    version: 8,
    sprite: 'https://protomaps.github.io/basemaps-assets/sprites/v4/light',
    glyphs: glyphsUrl,
    sources: {
      protomaps: {
        type: 'vector',
        url: normalizedUrl,
        ...(options?.maxDataZoom !== undefined ? { maxzoom: options.maxDataZoom } : {}),
        attribution:
          options?.attribution ??
          '&copy; BookSportsCourt &middot; &copy; OpenStreetMap &middot; Protomaps',
      },
      [MARITIME_GEOJSON_SOURCE_ID]: {
        type: 'geojson',
        data: MARITIME_GEOJSON_DATA,
      },
    },
    layers: [...layersWithSports, sportsPoiLabelsLayer, ...createMaritimeLayers()],
  };
}

export interface BuildRasterFallbackStyleOptions {
  glyphsUrl?: string;
  detectRetina?: boolean;
  opacity?: number;
}

/**
 * Tạo MapLibre Style cho các nhà cung cấp tile raster dự phòng (Esri, OSM, CARTO...),
 * vẫn nhúng sẵn lớp GeoJSON chủ quyền biển đảo Việt Nam.
 */
export function buildRasterFallbackStyle(
  provider: TileProviderConfig,
  options?: BuildRasterFallbackStyleOptions,
): StyleSpecification {
  const glyphsUrl = options?.glyphsUrl ?? getMapGlyphsUrl();
  const tiles = expandRasterTileUrls(provider, options?.detectRetina);
  const opacity = options?.opacity ?? 1;

  return {
    version: 8,
    glyphs: glyphsUrl,
    sources: {
      [RASTER_FALLBACK_SOURCE_ID]: {
        type: 'raster',
        tiles,
        tileSize: 256,
        minzoom: provider.minZoom ?? 0,
        maxzoom: provider.maxNativeZoom,
        attribution: provider.attribution,
      },
      [MARITIME_GEOJSON_SOURCE_ID]: {
        type: 'geojson',
        data: MARITIME_GEOJSON_DATA,
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': VIETNAM_PMTILES_BACKGROUND,
        },
      },
      {
        id: 'raster-basemap',
        type: 'raster',
        source: RASTER_FALLBACK_SOURCE_ID,
        minzoom: provider.minZoom ?? 0,
        maxzoom: provider.maxZoom,
        paint: {
          'raster-opacity': opacity,
        },
      },
      ...createMaritimeLayers(),
    ],
  };
}
