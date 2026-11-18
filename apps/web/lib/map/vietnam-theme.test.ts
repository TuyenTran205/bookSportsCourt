import { describe, expect, it } from 'vitest';

import maritimeGeoJson from './vietnam-islands.json';
import { TILE_PROVIDERS } from './tile-providers';
import {
  BSC_VIETNAM_FLAVOR,
  MARITIME_GEOJSON_SOURCE_ID,
  RASTER_FALLBACK_SOURCE_ID,
  VIETNAM_MAP_MAX_BOUNDS,
  VIETNAM_PMTILES_BACKGROUND,
  VIETNAM_PMTILES_BOUNDS,
  buildRasterFallbackStyle,
  buildVietnamMapStyle,
} from './vietnam-theme';

describe('vietnam-theme MapLibre Style & GeoJSON chủ quyền biển đảo (ADR-031)', () => {
  it('buildVietnamMapStyle chèn bsc-sports-areas trước roads, ẩn water symbols quốc tế và ưu tiên name:vi', () => {
    const style = buildVietnamMapStyle('https://map.booksportscourt.id.vn/map/vietnam.pmtiles', {
      glyphsUrl: 'https://map.booksportscourt.id.vn/map/fonts/{fontstack}/{range}.pbf',
      maxDataZoom: 14,
    });

    expect(style.version).toBe(8);
    expect(style.glyphs).toBe(
      'https://map.booksportscourt.id.vn/map/fonts/{fontstack}/{range}.pbf',
    );
    expect(VIETNAM_PMTILES_BACKGROUND).toBe(BSC_VIETNAM_FLAVOR.background);

    const protomapsSource = style.sources.protomaps as { type: string; url: string; maxzoom?: number };
    expect(protomapsSource.type).toBe('vector');
    expect(protomapsSource.url).toBe('pmtiles://https://map.booksportscourt.id.vn/map/vietnam.pmtiles');
    expect(protomapsSource.maxzoom).toBe(14);

    const sportsIndex = style.layers.findIndex((layer) => layer.id === 'bsc-sports-areas');
    const firstRoadIndex = style.layers.findIndex(
      (layer) => 'source-layer' in layer && layer['source-layer'] === 'roads',
    );
    expect(sportsIndex).toBeGreaterThanOrEqual(0);
    expect(firstRoadIndex).toBeGreaterThan(sportsIndex);

    // Ẩn toàn bộ water symbol layers quốc tế để nhường chỗ cho nhãn chủ quyền Việt Nam
    const waterSymbols = style.layers.filter(
      (layer) =>
        'source-layer' in layer &&
        layer['source-layer'] === 'water' &&
        layer.type === 'symbol',
    );
    expect(waterSymbols).toHaveLength(0);

    // Nhãn POI thể thao ưu tiên name:vi
    const sportsPoiLayer = style.layers.find((layer) => layer.id === 'bsc-sports-poi-labels');
    expect(sportsPoiLayer).toBeDefined();
    expect(JSON.stringify(sportsPoiLayer)).toContain('name:vi');

    // Nhúng nguồn GeoJSON và layer Biển Đông / Hoàng Sa / Trường Sa
    expect(style.sources[MARITIME_GEOJSON_SOURCE_ID]).toBeDefined();
    expect(style.layers.some((layer) => layer.id === 'bsc-maritime-sea-labels')).toBe(true);
    expect(style.layers.some((layer) => layer.id === 'bsc-maritime-archipelago-labels')).toBe(
      true,
    );
  });

  it('buildRasterFallbackStyle tạo raster source và vẫn giữ lớp chủ quyền biển đảo Việt Nam', () => {
    const style = buildRasterFallbackStyle(TILE_PROVIDERS['osm-standard'], {
      opacity: 0.9,
    });

    expect(style.version).toBe(8);
    expect(style.sources[RASTER_FALLBACK_SOURCE_ID]).toBeDefined();
    const rasterSource = style.sources[RASTER_FALLBACK_SOURCE_ID] as {
      type: string;
      tiles: string[];
    };
    expect(rasterSource.type).toBe('raster');
    expect(rasterSource.tiles).toEqual([
      'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
      'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
      'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
    ]);

    expect(style.sources[MARITIME_GEOJSON_SOURCE_ID]).toBeDefined();
    expect(style.layers.some((layer) => layer.id === 'raster-basemap')).toBe(true);
    expect(style.layers.some((layer) => layer.id === 'bsc-maritime-sea-labels')).toBe(true);
    expect(style.layers.some((layer) => layer.id === 'bsc-maritime-archipelago-labels')).toBe(
      true,
    );
  });

  it('bounds PMTiles & maxBounds MapLibre bao phủ trọn vẹn đất liền Việt Nam, Hoàng Sa và Trường Sa', () => {
    const [[south, west], [north, east]] = VIETNAM_PMTILES_BOUNDS;
    expect(south).toBeLessThanOrEqual(8.5);
    expect(north).toBeGreaterThanOrEqual(23.4);
    expect(west).toBeLessThanOrEqual(102.1);
    expect(east).toBeGreaterThanOrEqual(117.0);

    const [[minLng, minLat], [maxLng, maxLat]] = VIETNAM_MAP_MAX_BOUNDS;
    expect(minLng).toBeLessThanOrEqual(102.0);
    expect(maxLng).toBeGreaterThanOrEqual(117.0);
    expect(minLat).toBeLessThanOrEqual(8.0);
    expect(maxLat).toBeGreaterThanOrEqual(23.5);
  });

  it('vietnam-islands.geojson có đầy đủ Quần đảo Hoàng Sa, Quần đảo Trường Sa và BIỂN ĐÔNG', () => {
    const names = maritimeGeoJson.features.map((f) => f.properties.name);
    expect(names).toContain('Quần đảo Hoàng Sa');
    expect(names).toContain('Quần đảo Trường Sa');
    expect(names).toContain('BIỂN ĐÔNG');
  });
});
