'use client';

/**
 * Context chia sẻ trạng thái tự phục hồi tile giữa `ResilientTileLayer` và
 * `MapResilienceControl` trong cùng một `MapContainer` (SPEC-MAP-002).
 *
 * Nếu không bọc Provider, `ResilientTileLayer` sẽ tự khởi tạo hook nội bộ để
 * component vẫn hoạt động độc lập trong các ngữ cảnh nhúng riêng lẻ.
 */

import * as React from 'react';
import { useTileResilience } from '@/lib/map/useTileResilience';
import type { UseTileResilienceOptions, UseTileResilienceReturn } from '@/lib/map/useTileResilience';

const TileResilienceContext = React.createContext<UseTileResilienceReturn | null>(null);

export interface TileResilienceProviderProps {
  children: React.ReactNode;
  /** Tuỳ chọn khởi tạo hook (providers, errorThreshold, windowMs) */
  options?: UseTileResilienceOptions;
}

export function TileResilienceProvider({
  children,
  options,
}: TileResilienceProviderProps) {
  const value = useTileResilience(options);
  return (
    <TileResilienceContext.Provider value={value}>
      {children}
    </TileResilienceContext.Provider>
  );
}

/**
 * Đọc trạng thái từ context gần nhất. Trả về `null` khi không có Provider
 * để component gọi được tự khởi tạo hook nội bộ.
 */
export function useOptionalTileResilience(): UseTileResilienceReturn | null {
  return React.useContext(TileResilienceContext);
}
