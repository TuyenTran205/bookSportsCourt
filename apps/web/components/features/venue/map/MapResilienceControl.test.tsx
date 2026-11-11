// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

import { MapResilienceControl } from './MapResilienceControl';
import { TileResilienceProvider } from './TileResilienceContext';
import { useOptionalTileResilience } from './TileResilienceContext';
import { TILE_PROVIDERS } from '@/lib/map/tile-providers';

/**
 * Mock next-intl: trả về key làm text, hỗ trợ tham số {name} cho mapProviderLabel.
 */
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    if (values && typeof values.name === 'string') {
      return `${key}:${values.name}`;
    }
    return key;
  },
}));

describe('MapResilienceControl (SPEC-MAP-002)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('WT-MAP-04: Render trạng thái lỗi và nút Thử lại', () => {
    it('hiển thị role="status" aria-live="polite" cùng nút thử lại thao tác được', () => {
      const onRetry = vi.fn();
      render(
        <MapResilienceControl
          status="failed"
          activeProvider={TILE_PROVIDERS['esri-world-street']}
          onRetry={onRetry}
        />,
      );

      const status = screen.getByRole('status');
      expect(status).toBeTruthy();
      expect(status.getAttribute('aria-live')).toBe('polite');
      expect(status.textContent).toContain('allProvidersFailed');

      const retryButton = screen.getByRole('button', { name: /retryAction/ });
      expect(retryButton).toBeTruthy();
      expect(retryButton.hasAttribute('disabled')).toBe(false);
      expect(retryButton.getAttribute('type')).toBe('button');

      // Vùng chạm tối thiểu 44px theo chuẩn a11y (min-h-11 / min-w-11)
      expect(retryButton.className).toContain('min-h-11');
      expect(retryButton.className).toContain('min-w-11');
      // Có focus ring cho điều hướng bàn phím
      expect(retryButton.className).toContain('focus-visible:ring-2');
    });

    it('click nút Thử lại gọi đúng callback onRetry một lần', () => {
      const onRetry = vi.fn();
      render(<MapResilienceControl status="failed" onRetry={onRetry} />);

      const retryButton = screen.getByRole('button', { name: /retryAction/ });
      act(() => {
        fireEvent.click(retryButton);
      });

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('kích hoạt nút Thử lại bằng bàn phím (Enter) cũng gọi onRetry', () => {
      const onRetry = vi.fn();
      render(<MapResilienceControl status="failed" onRetry={onRetry} />);

      const retryButton = screen.getByRole('button', { name: /retryAction/ });
      act(() => {
        retryButton.focus();
        fireEvent.keyDown(retryButton, { key: 'Enter', code: 'Enter' });
        fireEvent.keyUp(retryButton, { key: 'Enter', code: 'Enter' });
        fireEvent.click(retryButton);
      });

      expect(document.activeElement).toBe(retryButton);
      expect(onRetry).toHaveBeenCalled();
    });

    it('không render nút Thử lại khi không có handler retry', () => {
      render(<MapResilienceControl status="failed" />);

      expect(screen.getByRole('status')).toBeTruthy();
      expect(screen.queryByRole('button')).toBeNull();
    });
  });

  describe('WT-MAP-05: Trì hoãn chỉ báo loading 600ms chống nhấp nháy', () => {
    it('chưa hiện gì trong 599ms đầu, hiện sau 600ms', () => {
      const { container } = render(<MapResilienceControl status="loading" />);

      // 599ms: chưa có chỉ báo
      act(() => {
        vi.advanceTimersByTime(599);
      });
      expect(container.firstChild).toBeNull();

      // 600ms: chỉ báo loading xuất hiện
      act(() => {
        vi.advanceTimersByTime(1);
      });

      const status = screen.getByRole('status');
      expect(status.textContent).toContain('mapLoading');
      expect(status.getAttribute('aria-live')).toBe('polite');
    });

    it('loading kết thúc nhanh trước 600ms thì không hiện chỉ báo', () => {
      const { container, rerender } = render(<MapResilienceControl status="loading" />);

      act(() => {
        vi.advanceTimersByTime(300);
      });
      rerender(<MapResilienceControl status="ready" />);

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(container.firstChild).toBeNull();
    });

    it('trạng thái degraded hiển thị thông báo chuyển nguồn dự phòng ngay lập tức', () => {
      render(
        <MapResilienceControl
          status="degraded"
          activeProvider={TILE_PROVIDERS['esri-world-street']}
        />,
      );

      const status = screen.getByRole('status');
      expect(status.textContent).toContain('providerSwitched');
      expect(status.getAttribute('aria-live')).toBe('polite');
    });

    it('trạng thái ready không hiển thị gì khi chưa từng suy giảm', () => {
      const { container } = render(<MapResilienceControl status="ready" />);

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(container.firstChild).toBeNull();
    });
  });

  describe('WT-MAP-06: Thông báo phục hồi hiển thị 2 giây rồi tự ẩn', () => {
    it('chuyển degraded -> ready hiện tên provider, tự ẩn sau 2000ms', () => {
      const { container, rerender } = render(
        <MapResilienceControl
          status="degraded"
          activeProvider={TILE_PROVIDERS['esri-world-street']}
        />,
      );

      expect(screen.getByRole('status').textContent).toContain('providerSwitched');

      // Provider mới tải thành công
      rerender(
        <MapResilienceControl
          status="ready"
          activeProvider={TILE_PROVIDERS['esri-world-street']}
        />,
      );

      const recovered = screen.getByRole('status');
      expect(recovered.textContent).toContain('mapProviderLabel');
      expect(recovered.textContent).toContain('Esri World Street Map');

      // 1999ms: vẫn còn hiển thị
      act(() => {
        vi.advanceTimersByTime(1999);
      });
      expect(screen.getByRole('status')).toBeTruthy();

      // 2000ms: tự ẩn
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(container.firstChild).toBeNull();
    });
  });

  describe('WT-MAP-07: Đồng bộ trạng thái qua TileResilienceProvider', () => {
    function Probe() {
      const resilience = useOptionalTileResilience();
      if (!resilience) return null;
      return (
        <button type="button" onClick={() => resilience.reportTileError()}>
          emit-error
        </button>
      );
    }

    it('control đọc trạng thái chia sẻ và hiện degraded khi vượt ngưỡng lỗi', () => {
      render(
        <TileResilienceProvider options={{ errorThreshold: 2 }}>
          <MapResilienceControl />
          <Probe />
        </TileResilienceProvider>,
      );

      // Ban đầu status = loading nhưng chưa qua 600ms nên chưa render gì
      expect(screen.queryByRole('status')).toBeNull();

      act(() => {
        fireEvent.click(screen.getByText('emit-error'));
        fireEvent.click(screen.getByText('emit-error'));
      });

      const status = screen.getByRole('status');
      expect(status.textContent).toContain('providerSwitched');
    });
  });
});
