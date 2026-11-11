'use client';

/**
 * Lớp tile bản đồ tự phục hồi (SPEC-MAP-002).
 *
 * Thay thế trực tiếp `<TileLayer />` của react-leaflet:
 *  - Dựng `L.TileLayer` trên `useMap()` để kiểm soát trọn vẹn vòng đời layer.
 *  - Lắng nghe `tileerror` / `tileload` cấp thấp để đếm lỗi trong cửa sổ trượt.
 *  - Chống ô trắng khi zoom sâu: `maxNativeZoom`, `keepBuffer`, `updateWhenIdle: false`.
 *  - Cập nhật `attribution` theo provider đang hoạt động (bắt buộc về bản quyền).
 *  - Đổi provider sẽ dựng lại layer, xoá sạch tile lỗi của nguồn cũ.
 */

import * as React from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';

import type { TileProviderConfig } from '@/lib/map/types';
import { FALLBACK_ERROR_TILE_URL, TILE_PROVIDERS } from '@/lib/map/tile-providers';
import type { UseTileResilienceReturn } from '@/lib/map/useTileResilience';
import { useTileResilience } from '@/lib/map/useTileResilience';
import { useOptionalTileResilience } from './TileResilienceContext';

export interface ResilientTileLayerProps {
  /** Ghi đè provider đang hiển thị (mặc định lấy từ trạng thái tự phục hồi) */
  activeProvider?: TileProviderConfig;
  /** Callback tuỳ biến khi một tile lỗi (chạy song song với báo cáo nội bộ) */
  onTileError?: () => void;
  /** Callback tuỳ biến khi một tile tải xong (chạy song song với báo cáo nội bộ) */
  onTileLoad?: () => void;
  /** Báo trạng thái tải tile của cả khung nhìn (bắt đầu / kết thúc) */
  onLoadingChange?: (isLoading: boolean) => void;
  /** Số hàng/cột tile giữ đệm ngoài khung nhìn để chống nhấp nháy (mặc định 4) */
  keepBuffer?: number;
  /** Tải liên tục trong lúc rê/zoom thay vì chờ thao tác kết thúc (mặc định false) */
  updateWhenIdle?: boolean;
  /** Ảnh thay thế khi tile lỗi (mặc định lưới Slate trung tính) */
  errorTileUrl?: string;
  /** Bật tile @2x cho màn hình retina (mặc định theo provider) */
  detectRetina?: boolean;
  /** Độ mờ của lớp tile (0–1) */
  opacity?: number;
}

interface ControlledTileLayerProps extends ResilientTileLayerProps {
  resilience: UseTileResilienceReturn;
}

function ControlledTileLayer({
  resilience,
  activeProvider,
  onTileError,
  onTileLoad,
  onLoadingChange,
  keepBuffer = 4,
  updateWhenIdle = false,
  errorTileUrl = FALLBACK_ERROR_TILE_URL,
  detectRetina,
  opacity = 1,
}: ControlledTileLayerProps) {
  const map = useMap();
  const provider = activeProvider ?? resilience.activeProvider;
  const shouldDetectRetina = detectRetina ?? Boolean(provider.supportsRetina);

  // Giữ callback mới nhất trong ref để không phải dựng lại layer mỗi lần render
  const handlersRef = React.useRef({ onTileError, onTileLoad, onLoadingChange });
  React.useEffect(() => {
    handlersRef.current = { onTileError, onTileLoad, onLoadingChange };
  }, [onTileError, onTileLoad, onLoadingChange]);

  const reportErrorRef = React.useRef(resilience.reportTileError);
  const reportLoadRef = React.useRef(resilience.reportTileLoad);
  React.useEffect(() => {
    reportErrorRef.current = resilience.reportTileError;
    reportLoadRef.current = resilience.reportTileLoad;
  }, [resilience.reportTileError, resilience.reportTileLoad]);

  React.useEffect(() => {
    const layer = L.tileLayer(provider.url, {
      attribution: provider.attribution,
      subdomains: provider.subdomains ?? 'abc',
      maxZoom: provider.maxZoom,
      maxNativeZoom: provider.maxNativeZoom,
      minZoom: provider.minZoom,
      keepBuffer,
      updateWhenIdle,
      errorTileUrl,
      detectRetina: shouldDetectRetina,
      opacity,
      crossOrigin: true,
    });

    const handleTileError = () => {
      reportErrorRef.current();
      handlersRef.current.onTileError?.();
    };

    const handleTileLoad = () => {
      reportLoadRef.current();
      handlersRef.current.onTileLoad?.();
    };

    const handleLoading = () => {
      handlersRef.current.onLoadingChange?.(true);
    };

    const handleLoad = () => {
      handlersRef.current.onLoadingChange?.(false);
    };

    layer.on('tileerror', handleTileError);
    layer.on('tileload', handleTileLoad);
    layer.on('loading', handleLoading);
    layer.on('load', handleLoad);

    layer.addTo(map);

    return () => {
      layer.off('tileerror', handleTileError);
      layer.off('tileload', handleTileLoad);
      layer.off('loading', handleLoading);
      layer.off('load', handleLoad);
      if (map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    };
  }, [
    map,
    provider.id,
    provider.url,
    provider.attribution,
    provider.subdomains,
    provider.maxZoom,
    provider.maxNativeZoom,
    provider.minZoom,
    keepBuffer,
    updateWhenIdle,
    errorTileUrl,
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

  // Context là dữ liệu, không phải hook ⇒ rẽ nhánh ở đây vẫn đúng Rules of Hooks.
  if (shared) {
    return <ControlledTileLayer {...props} resilience={shared} />;
  }

  return <SelfContainedTileLayer {...props} />;
}

/** Provider mặc định dùng khi không xác định được nguồn nào khả dụng */
export const DEFAULT_MAP_PROVIDER: TileProviderConfig = TILE_PROVIDERS['esri-world-street'];

export { ControlledTileLayer };
