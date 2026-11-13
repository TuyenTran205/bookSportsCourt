'use client';

/**
 * Lớp nhãn chủ quyền Biển Đông, Quần đảo Hoàng Sa và Quần đảo Trường Sa cho MapLibre GL (ADR-031).
 *
 * Tự động kiểm tra và gắn lại GeoJSON source + symbol layers mỗi khi style đổi
 * (kể cả khi hệ thống tự động fallback sang Esri / OSM), đảm bảo nhãn chủ quyền
 * tiếng Việt luôn hiển thị rõ nét ở mức zoom tổng quan (zoom <= 10).
 */

import * as React from 'react';
import {
  MARITIME_GEOJSON_DATA,
  MARITIME_GEOJSON_SOURCE_ID,
  createMaritimeLayers,
} from '@/lib/map/vietnam-theme';
import { useMapLibre } from './ResilientTileLayer';

export function VietnamMaritimeLayer() {
  const map = useMapLibre();

  React.useEffect(() => {
    if (!map) return undefined;

    const ensureMaritimeOverlay = () => {
      if (typeof map.isStyleLoaded === 'function' && !map.isStyleLoaded()) {
        return;
      }

      const currentStyle = typeof map.getStyle === 'function' ? map.getStyle() : undefined;
      if (currentStyle && !currentStyle.glyphs) {
        return;
      }

      try {
        if (!map.getSource(MARITIME_GEOJSON_SOURCE_ID)) {
          map.addSource(MARITIME_GEOJSON_SOURCE_ID, {
            type: 'geojson',
            data: MARITIME_GEOJSON_DATA,
          });
        }

        for (const layerSpec of createMaritimeLayers()) {
          if (!map.getLayer(layerSpec.id)) {
            map.addLayer(layerSpec);
          }
        }
      } catch {
        // Bỏ qua nếu style đang chuyển tiếp trong chu kỳ setStyle
      }
    };

    ensureMaritimeOverlay();
    map.on('styledata', ensureMaritimeOverlay);
    map.on('load', ensureMaritimeOverlay);

    return () => {
      map.off('styledata', ensureMaritimeOverlay);
      map.off('load', ensureMaritimeOverlay);
    };
  }, [map]);

  return null;
}
