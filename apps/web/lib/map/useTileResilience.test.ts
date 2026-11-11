// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import {
  DEFAULT_ERROR_THRESHOLD,
  createInitialResilienceState,
  tileResilienceReducer,
  useTileResilience,
} from './useTileResilience';
import { TILE_PROVIDERS } from './tile-providers';
import type { TileProviderConfig } from './types';
import type { TileResilienceReducerState } from './useTileResilience';

describe('useTileResilience hook (SPEC-MAP-003)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      vi.clearAllTimers();
    });
    vi.useRealTimers();
  });

  describe('UT-RES-01: Khởi tạo ban đầu với provider ưu tiên số 1 (esri-world-street)', () => {
    it('khởi tạo với provider đầu tiên là esri-world-street, không degraded, không failed, bộ đếm lỗi bằng 0', () => {
      const { result } = renderHook(() => useTileResilience());

      expect(result.current.currentProviderIndex).toBe(0);
      expect(result.current.providerIndex).toBe(0);
      expect(result.current.activeProvider.id).toBe('esri-world-street');
      expect(result.current.isSwitching).toBe(false);
      expect(result.current.isAllFailed).toBe(false);
      expect(result.current.errorCount).toBe(0);
      expect(result.current.status).not.toBe('degraded');
      expect(result.current.status).not.toBe('failed');
      expect(result.current.availableProviders.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('UT-RES-02: Lỗi dưới ngưỡng và sliding window không kích hoạt chuyển đổi', () => {
    it('3 lỗi rải rác trong 1 giây (dưới ngưỡng 6) không làm chuyển provider', () => {
      const { result } = renderHook(() => useTileResilience());

      act(() => {
        result.current.reportTileError();
        result.current.reportTileError();
        result.current.reportTileError();
      });

      expect(result.current.errorCount).toBe(3);
      expect(result.current.currentProviderIndex).toBe(0);
      expect(result.current.activeProvider.id).toBe('esri-world-street');
      expect(result.current.isSwitching).toBe(false);
      expect(result.current.isAllFailed).toBe(false);
    });

    it('5 lỗi rải rác ngoài cửa sổ 3000ms không kích hoạt chuyển provider (sliding window đúng)', () => {
      const { result } = renderHook(() => useTileResilience());

      // 4 lỗi tại thời điểm ban đầu
      act(() => {
        result.current.reportTileError();
        result.current.reportTileError();
        result.current.reportTileError();
        result.current.reportTileError();
      });
      expect(result.current.errorCount).toBe(4);

      // Tua thời gian vượt qua cửa sổ 3000ms (3500ms) để các lỗi cũ hết hạn
      act(() => {
        vi.advanceTimersByTime(3500);
      });

      // Thêm 2 lỗi nữa sau khi cửa sổ cũ đã trôi qua
      act(() => {
        result.current.reportTileError();
        result.current.reportTileError();
      });

      // Tổng lỗi trong cửa sổ hiện tại chỉ là 2, không vượt ngưỡng 6
      expect(result.current.errorCount).toBe(2);
      expect(result.current.currentProviderIndex).toBe(0);
      expect(result.current.activeProvider.id).toBe('esri-world-street');
      expect(result.current.status).not.toBe('degraded');
    });
  });

  describe('UT-RES-03: Đạt ngưỡng lỗi liên tiếp kích hoạt chuyển sang provider kế tiếp', () => {
    it('6 lỗi liên tiếp trong 3000ms chuyển sang provider kế tiếp (osm-france-hot), isDegraded=true', () => {
      const { result } = renderHook(() => useTileResilience());

      act(() => {
        for (let i = 0; i < DEFAULT_ERROR_THRESHOLD; i++) {
          result.current.reportTileError();
        }
      });

      // Chuyển sang provider số 1 (OSM France Humanitarian)
      expect(result.current.currentProviderIndex).toBe(1);
      expect(result.current.activeProvider.id).toBe('osm-france-hot');
      expect(result.current.status).toBe('degraded');
      expect(result.current.isSwitching).toBe(true);
      expect(result.current.isAllFailed).toBe(false);
      // Bộ đếm lỗi được reset về 0 để theo dõi provider mới
      expect(result.current.errorCount).toBe(0);
      expect(result.current.statusMessage).toContain('OSM France Humanitarian');
    });
  });

  describe('UT-RES-04: Provider kế tiếp tải thành công chuyển về ready và giữ nguyên', () => {
    it('khi provider mới tải tile thành công, status chuyển về ready và không quay về provider cũ', () => {
      const { result } = renderHook(() => useTileResilience());

      // Kích hoạt lỗi để chuyển sang provider 1 (osm-france-hot)
      act(() => {
        for (let i = 0; i < DEFAULT_ERROR_THRESHOLD; i++) {
          result.current.reportTileError();
        }
      });
      expect(result.current.currentProviderIndex).toBe(1);
      expect(result.current.status).toBe('degraded');

      // Báo một tile tải thành công
      act(() => {
        result.current.reportTileLoad();
      });

      // Trạng thái trở về ready
      expect(result.current.status).toBe('ready');
      expect(result.current.isSwitching).toBe(false);
      // Provider vẫn được giữ ở vị trí 1, không bị giật về 0
      expect(result.current.currentProviderIndex).toBe(1);
      expect(result.current.activeProvider.id).toBe('osm-france-hot');
    });
  });

  describe('UT-RES-05: Toàn bộ provider đều lỗi kích hoạt isAllFailed=true và dừng chuyển đổi', () => {
    it('duyệt hết danh sách provider chuyển sang status=failed và chống vòng lặp vô hạn', () => {
      // Dùng 2 provider tuỳ biến để kiểm tra nhanh chu trình duyệt cạn kiệt
      const customProviders: TileProviderConfig[] = [
        TILE_PROVIDERS['esri-world-street'],
        TILE_PROVIDERS['osm-france-hot'],
      ];

      const { result } = renderHook(() =>
        useTileResilience({
          providers: customProviders,
          errorThreshold: 3,
          windowMs: 3000,
        }),
      );

      // Lỗi trên provider 0 -> chuyển sang provider 1
      act(() => {
        for (let i = 0; i < 3; i++) {
          result.current.reportTileError();
        }
      });
      expect(result.current.currentProviderIndex).toBe(1);
      expect(result.current.status).toBe('degraded');

      // Lỗi trên provider 1 (provider cuối cùng) -> chuyển sang failed
      act(() => {
        for (let i = 0; i < 3; i++) {
          result.current.reportTileError();
        }
      });

      expect(result.current.isAllFailed).toBe(true);
      expect(result.current.status).toBe('failed');
      expect(result.current.isSwitching).toBe(false);
      expect(result.current.statusMessage).toContain('Không thể tải bản đồ');

      // Gọi thêm lỗi khi đã failed không gây vòng lặp vô hạn hay thay đổi provider index
      act(() => {
        result.current.reportTileError();
        result.current.reportTileError();
      });

      expect(result.current.isAllFailed).toBe(true);
      expect(result.current.status).toBe('failed');
      expect(result.current.currentProviderIndex).toBe(1);
    });
  });

  describe('UT-RES-06: Thao tác retry() khôi phục lại trạng thái ban đầu', () => {
    it('gọi retry() từ trạng thái failed reset về provider 0 và xoá cờ lỗi', () => {
      const customProviders: TileProviderConfig[] = [
        TILE_PROVIDERS['esri-world-street'],
        TILE_PROVIDERS['osm-france-hot'],
      ];

      const { result } = renderHook(() =>
        useTileResilience({
          providers: customProviders,
          errorThreshold: 2,
        }),
      );

      // Gây lỗi đến khi failed hoàn toàn
      act(() => {
        for (let i = 0; i < 4; i++) {
          result.current.reportTileError();
        }
      });
      expect(result.current.isAllFailed).toBe(true);
      expect(result.current.status).toBe('failed');

      // Gọi retry()
      act(() => {
        result.current.retry();
      });

      expect(result.current.currentProviderIndex).toBe(0);
      expect(result.current.activeProvider.id).toBe('esri-world-street');
      expect(result.current.isAllFailed).toBe(false);
      expect(result.current.errorCount).toBe(0);
      expect(result.current.status).toBe('loading');
    });

    it('hàm switchToNextProvider đổi thủ công sang provider tiếp theo', () => {
      const { result } = renderHook(() => useTileResilience());

      expect(result.current.currentProviderIndex).toBe(0);

      act(() => {
        result.current.switchToNextProvider();
      });

      expect(result.current.currentProviderIndex).toBe(1);
      expect(result.current.status).toBe('degraded');
      expect(result.current.isSwitching).toBe(true);
    });
  });

  describe('Kiểm tra trực tiếp reducer thuần tileResilienceReducer', () => {
    it('hàm reducer thuần phản hồi đúng các action cơ bản', () => {
      const context = {
        providers: [TILE_PROVIDERS['esri-world-street'], TILE_PROVIDERS['osm-france-hot']],
        errorThreshold: 3,
        windowMs: 3000,
      };

      let state: TileResilienceReducerState = createInitialResilienceState();

      // 1 lỗi: errorTimestamps có 1 phần tử
      state = tileResilienceReducer(state, { type: 'tile-error', now: 1000 }, context);
      expect(state.errorTimestamps).toEqual([1000]);

      // 2 lỗi: errorTimestamps có 2 phần tử
      state = tileResilienceReducer(state, { type: 'tile-error', now: 2000 }, context);
      expect(state.errorTimestamps).toEqual([1000, 2000]);

      // 3 lỗi (đạt ngưỡng): chuyển providerIndex sang 1
      state = tileResilienceReducer(state, { type: 'tile-error', now: 2500 }, context);
      expect(state.providerIndex).toBe(1);
      expect(state.status).toBe('degraded');
      expect(state.isSwitching).toBe(true);
      expect(state.errorTimestamps).toEqual([]);
    });
  });
});
