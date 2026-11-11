'use client';

/**
 * Hook quản lý máy trạng thái tự phục hồi nguồn tile bản đồ (SPEC-MAP-002).
 *
 * Toàn bộ chuyển trạng thái nằm trong một reducer thuần (pure reducer) nên:
 *  - Không có side-effect lồng trong state updater (an toàn với React StrictMode).
 *  - Kiểm thử được bằng Vitest với fake timers mà không cần DOM.
 *
 * Quy tắc nghiệp vụ:
 *  - 6 lỗi tile trong cửa sổ trượt 3.000ms ⇒ tự động chuyển sang provider kế tiếp.
 *  - Duyệt hết danh sách vẫn lỗi ⇒ `isAllFailed = true` để hiện nút "Thử lại".
 *  - Mỗi tile tải thành công làm giảm bộ đếm lỗi, tránh đổi nguồn khi mạng chập chờn.
 */

import * as React from 'react';

import type {
  TileProviderConfig,
  MapResilienceState,
  MapResilienceActions,
  MapResilienceStatus,
} from './types';
import { getTileProviders, TILE_PROVIDERS } from './tile-providers';

/** Ngưỡng số lỗi tile liên tiếp để kích hoạt đổi provider */
export const DEFAULT_ERROR_THRESHOLD = 6;
/** Độ dài cửa sổ trượt tính bằng mili-giây */
export const DEFAULT_WINDOW_MS = 3000;

export interface UseTileResilienceOptions {
  /** Danh sách nhà cung cấp tile tuỳ biến (dùng cho unit test / mocking) */
  providers?: TileProviderConfig[];
  /** Ngưỡng số lỗi tile liên tiếp để chuyển provider (mặc định 6) */
  errorThreshold?: number;
  /** Độ dài cửa sổ trượt tính bằng mili-giây (mặc định 3000ms) */
  windowMs?: number;
}

export type UseTileResilienceReturn = MapResilienceState & MapResilienceActions;

/** Trạng thái nội bộ của reducer */
export interface TileResilienceReducerState {
  providerIndex: number;
  status: MapResilienceStatus;
  isSwitching: boolean;
  isAllFailed: boolean;
  statusMessage: string | null;
  /** Mốc thời gian (ms) của các lỗi còn nằm trong cửa sổ trượt */
  errorTimestamps: number[];
}

export type TileResilienceAction =
  | { type: 'tile-error'; now: number }
  | { type: 'tile-load'; now: number }
  | { type: 'prune'; now: number }
  | { type: 'next-provider' }
  | { type: 'retry' };

export interface TileResilienceContext {
  providers: TileProviderConfig[];
  errorThreshold: number;
  windowMs: number;
}

export function createInitialResilienceState(): TileResilienceReducerState {
  return {
    providerIndex: 0,
    status: 'loading',
    isSwitching: false,
    isAllFailed: false,
    statusMessage: null,
    errorTimestamps: [],
  };
}

function pruneTimestamps(timestamps: number[], now: number, windowMs: number): number[] {
  return timestamps.filter((timestamp) => now - timestamp < windowMs);
}

/**
 * Reducer thuần, không side-effect: được export để kiểm thử trực tiếp.
 */
export function tileResilienceReducer(
  state: TileResilienceReducerState,
  action: TileResilienceAction,
  context: TileResilienceContext,
): TileResilienceReducerState {
  const { providers, errorThreshold, windowMs } = context;
  const providerCount = providers.length;

  switch (action.type) {
    case 'tile-error': {
      // Đã cạn toàn bộ nguồn: bỏ qua để chống bão sự kiện tileerror từ Leaflet
      if (state.isAllFailed) return state;

      const timestamps = pruneTimestamps(state.errorTimestamps, action.now, windowMs);
      timestamps.push(action.now);

      if (timestamps.length < errorThreshold) {
        return { ...state, errorTimestamps: timestamps };
      }

      const nextIndex = state.providerIndex + 1;
      const nextProvider = providers[nextIndex];

      if (nextProvider) {
        return {
          providerIndex: nextIndex,
          status: 'degraded',
          isSwitching: true,
          isAllFailed: false,
          statusMessage: `Đang chuyển sang nguồn bản đồ dự phòng: ${nextProvider.name}`,
          errorTimestamps: [],
        };
      }

      return {
        ...state,
        status: 'failed',
        isSwitching: false,
        isAllFailed: true,
        statusMessage: 'Không thể tải bản đồ từ các nguồn khả dụng.',
        errorTimestamps: [],
      };
    }

    case 'tile-load': {
      // Mỗi tile thành công loại bỏ lỗi cũ nhất để tránh chuyển nguồn nhầm
      const timestamps = pruneTimestamps(state.errorTimestamps, action.now, windowMs);
      return {
        ...state,
        status: state.isAllFailed ? 'failed' : 'ready',
        isSwitching: state.isAllFailed ? state.isSwitching : false,
        statusMessage: state.isAllFailed ? state.statusMessage : null,
        errorTimestamps: timestamps.slice(1),
      };
    }

    case 'prune': {
      const remaining = pruneTimestamps(state.errorTimestamps, action.now, windowMs);
      if (remaining.length === state.errorTimestamps.length) return state;
      return { ...state, errorTimestamps: remaining };
    }

    case 'next-provider': {
      if (providerCount === 0) return state;
      const nextIndex = (state.providerIndex + 1) % providerCount;
      const nextProvider = providers[nextIndex];
      return {
        ...state,
        providerIndex: nextIndex,
        status: 'degraded',
        isSwitching: true,
        isAllFailed: false,
        statusMessage: nextProvider
          ? `Đang chuyển sang nguồn bản đồ: ${nextProvider.name}`
          : 'Đang chuyển nguồn bản đồ',
        errorTimestamps: [],
      };
    }

    case 'retry':
      return createInitialResilienceState();

    default:
      return state;
  }
}

export function useTileResilience(
  options?: UseTileResilienceOptions,
): UseTileResilienceReturn {
  const errorThreshold = options?.errorThreshold ?? DEFAULT_ERROR_THRESHOLD;
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
  const customProviders = options?.providers;

  // Danh sách provider khả dụng (đã lọc provider thiếu API key, sắp theo priority)
  const availableProviders = React.useMemo<TileProviderConfig[]>(() => {
    if (customProviders && customProviders.length > 0) {
      return customProviders;
    }
    const detected = getTileProviders();
    return detected.length > 0 ? detected : [TILE_PROVIDERS['esri-world-street']];
  }, [customProviders]);

  const context = React.useMemo<TileResilienceContext>(
    () => ({ providers: availableProviders, errorThreshold, windowMs }),
    [availableProviders, errorThreshold, windowMs],
  );

  const [state, dispatch] = React.useReducer(
    (current: TileResilienceReducerState, action: TileResilienceAction) =>
      tileResilienceReducer(current, action, context),
    undefined,
    createInitialResilienceState,
  );

  const safeIndex = Math.min(
    Math.max(0, state.providerIndex),
    Math.max(0, availableProviders.length - 1),
  );
  const activeProvider = availableProviders[safeIndex] ?? TILE_PROVIDERS['esri-world-street'];

  // Dọn bộ đếm lỗi sau khi cửa sổ trượt trôi qua mà không có lỗi mới
  const errorTimestampCount = state.errorTimestamps.length;
  React.useEffect(() => {
    if (errorTimestampCount === 0) return undefined;

    const timer = setTimeout(() => {
      dispatch({ type: 'prune', now: Date.now() });
    }, windowMs);

    return () => clearTimeout(timer);
  }, [errorTimestampCount, windowMs]);

  const switchToNextProvider = React.useCallback(() => {
    dispatch({ type: 'next-provider' });
  }, []);

  const retryFromStart = React.useCallback(() => {
    dispatch({ type: 'retry' });
  }, []);

  const reportTileError = React.useCallback(() => {
    dispatch({ type: 'tile-error', now: Date.now() });
  }, []);

  const reportTileLoad = React.useCallback(() => {
    dispatch({ type: 'tile-load', now: Date.now() });
  }, []);

  return {
    // Trạng thái
    currentProviderIndex: safeIndex,
    providerIndex: safeIndex,
    activeProvider,
    availableProviders,
    errorCount: state.errorTimestamps.length,
    isSwitching: state.isSwitching,
    isAllFailed: state.isAllFailed,
    status: state.status,
    statusMessage: state.statusMessage,

    // Hành động
    switchToNextProvider,
    retryFromStart,
    retry: retryFromStart,
    reportTileError,
    reportTileSuccess: reportTileLoad,
    reportTileLoad,
  };
}
