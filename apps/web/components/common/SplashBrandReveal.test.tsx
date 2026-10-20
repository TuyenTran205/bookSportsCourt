// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

import { SplashBrandReveal } from './SplashBrandReveal';

describe('SplashBrandReveal (TC-SPLASH)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    document.body.style.overflow = '';
    window.history.pushState({}, '', '/');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
    sessionStorage.clear();
    document.body.style.overflow = '';
    window.history.pushState({}, '', '/');
  });

  it('TC-SPLASH-01: lần đầu truy cập (sessionStorage trống) hiển thị đầy đủ nhận diện thương hiệu', () => {
    render(<SplashBrandReveal />);

    // Overlay xuất hiện
    const overlay = screen.getByTestId('splash-brand-reveal');
    expect(overlay).not.toBeNull();

    // Có logo thương hiệu
    expect(screen.getByTestId('app-brand-logo')).not.toBeNull();

    // Có tiêu đề "BookSportsCourt"
    expect(screen.getByText('BookSports')).not.toBeNull();
    expect(screen.getByText('Court')).not.toBeNull();

    // Có slogan định vị thương hiệu
    expect(screen.getByText('Đặt sân tức thì • Kết nối đam mê')).not.toBeNull();

    // Có footer badge xác thực hệ thống sân bãi Việt Nam
    expect(screen.getByTestId('splash-footer-badge')).not.toBeNull();
    expect(screen.getByText('Hệ thống sân bãi thể thao Việt Nam')).not.toBeNull();
    expect(screen.getByText('Phiên bản 2.2.0 • Web & Mobile Synchronized')).not.toBeNull();

    // Đã ghi nhận cờ hiển thị vào sessionStorage
    expect(sessionStorage.getItem('bsc_welcome_splash_shown')).toBe('true');
  });

  it('TC-SPLASH-02: lần truy cập tiếp theo trong cùng phiên (đã có cờ) không hiển thị lại splash', () => {
    sessionStorage.setItem('bsc_welcome_splash_shown', 'true');

    render(<SplashBrandReveal />);

    // Không render overlay
    expect(screen.queryByTestId('splash-brand-reveal')).toBeNull();
  });

  it('TC-SPLASH-03: hỗ trợ ép buộc hiển thị (forceShow prop hoặc ?splash=force URL query)', () => {
    sessionStorage.setItem('bsc_welcome_splash_shown', 'true');

    // Trường hợp 1: Sử dụng prop forceShow={true}
    const { unmount } = render(<SplashBrandReveal forceShow={true} />);
    expect(screen.getByTestId('splash-brand-reveal')).not.toBeNull();
    unmount();

    // Trường hợp 2: Sử dụng URL query ?splash=force
    window.history.pushState({}, '', '?splash=force');

    const { unmount: unmountForce } = render(<SplashBrandReveal />);
    expect(screen.getByTestId('splash-brand-reveal')).not.toBeNull();
    unmountForce();

    // Trường hợp 3: Sử dụng URL query ?welcome=1
    window.history.pushState({}, '', '?welcome=1');

    render(<SplashBrandReveal />);
    expect(screen.getByTestId('splash-brand-reveal')).not.toBeNull();

    window.history.pushState({}, '', '/');
  });

  it('TC-SPLASH-04: tự động đóng sau duration mặc định (1850ms) và hoàn tất sau exitDuration mặc định (400ms)', () => {
    vi.useFakeTimers();
    const onFinished = vi.fn();

    render(
      <SplashBrandReveal
        onFinished={onFinished}
        forceShow={true}
      />
    );

    const overlay = screen.getByTestId('splash-brand-reveal');
    expect(overlay.classList.contains('opacity-100')).toBe(true);
    expect(onFinished).not.toHaveBeenCalled();

    // Tiến hành trôi qua 1850ms duration mặc định
    act(() => {
      vi.advanceTimersByTime(1850);
    });

    // Kích hoạt hiệu ứng fade-out: opacity-0 và pointer-events-none
    expect(overlay.classList.contains('opacity-0')).toBe(true);
    expect(overlay.classList.contains('pointer-events-none')).toBe(true);

    // Tiến hành trôi tiếp 400ms exitDuration mặc định
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Callback onFinished được gọi sau khi unmount
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it('TC-SPLASH-05: bấm nút "Bỏ qua" lập tức bắt đầu đóng splash mà không cần chờ hết duration', () => {
    vi.useFakeTimers();
    const onFinished = vi.fn();

    render(
      <SplashBrandReveal
        duration={1850}
        exitDuration={400}
        onFinished={onFinished}
        forceShow={true}
      />
    );

    const skipButton = screen.getByTestId('splash-skip-button');
    expect(skipButton).not.toBeNull();

    // Bấm nút bỏ qua ở thời điểm 200ms
    act(() => {
      vi.advanceTimersByTime(200);
    });
    fireEvent.click(skipButton);

    const overlay = screen.getByTestId('splash-brand-reveal');
    expect(overlay.classList.contains('opacity-0')).toBe(true);

    // Chờ 400ms chuyển tiếp
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it('TC-SPLASH-06: nhấn phím Escape lập tức đóng splash screen', () => {
    vi.useFakeTimers();
    const onFinished = vi.fn();

    render(
      <SplashBrandReveal
        duration={1850}
        exitDuration={400}
        onFinished={onFinished}
        forceShow={true}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });

    const overlay = screen.getByTestId('splash-brand-reveal');
    expect(overlay.classList.contains('opacity-0')).toBe(true);

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it('TC-SPLASH-07: chế độ prefers-reduced-motion tắt radar pulse ring', () => {
    // Giả lập media query prefers-reduced-motion: reduce
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(<SplashBrandReveal forceShow={true} />);

    // Radar pulse ring không được render khi người dùng yêu cầu giảm chuyển động
    expect(screen.queryByTestId('radar-pulse-ring')).toBeNull();
  });

  it('TC-SPLASH-08: chống xô lệch layout (fixed inset-0 z-[100]) và quản lý khóa cuộn body an toàn', () => {
    const { unmount } = render(<SplashBrandReveal forceShow={true} />);

    const overlay = screen.getByTestId('splash-brand-reveal');
    expect(overlay.classList.contains('fixed')).toBe(true);
    expect(overlay.classList.contains('inset-0')).toBe(true);
    expect(overlay.classList.contains('z-[100]')).toBe(true);

    // Khi splash hiển thị, body bị khóa cuộn
    expect(document.body.style.overflow).toBe('hidden');

    // Khi unmount, body được mở khóa lại bình thường
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('TC-SPLASH-09: phối hợp isAppReady giữ splash kèm progress bar và đóng ngay khi app sẵn sàng', () => {
    vi.useFakeTimers();
    const onFinished = vi.fn();

    const { rerender } = render(
      <SplashBrandReveal
        duration={1850}
        exitDuration={400}
        onFinished={onFinished}
        forceShow={true}
        isAppReady={false}
      />
    );

    const overlay = screen.getByTestId('splash-brand-reveal');

    // Có progress bar chỉ báo nạp dữ liệu
    expect(screen.getByRole('progressbar')).not.toBeNull();

    // Hết 1850ms hoạt cảnh nhưng isAppReady vẫn false -> chưa đóng
    act(() => {
      vi.advanceTimersByTime(1850);
    });
    expect(overlay.classList.contains('opacity-100')).toBe(true);
    expect(onFinished).not.toHaveBeenCalled();

    // Cập nhật isAppReady = true
    rerender(
      <SplashBrandReveal
        duration={1850}
        exitDuration={400}
        onFinished={onFinished}
        forceShow={true}
        isAppReady={true}
      />
    );

    // Kích hoạt ngay fade-out
    expect(overlay.classList.contains('opacity-0')).toBe(true);

    // Sau exitDuration (400ms) kết thúc hoàn toàn
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it('TC-SPLASH-10: watchdog safety timeout (4000ms) tự động đóng splash chống kẹt vô hạn', () => {
    vi.useFakeTimers();
    const onFinished = vi.fn();

    render(
      <SplashBrandReveal
        duration={1850}
        exitDuration={400}
        onFinished={onFinished}
        forceShow={true}
        isAppReady={false}
      />
    );

    const overlay = screen.getByTestId('splash-brand-reveal');

    // Tại 3999ms chưa đóng do isAppReady=false
    act(() => {
      vi.advanceTimersByTime(3999);
    });
    expect(overlay.classList.contains('opacity-100')).toBe(true);

    // Chạm mốc 4000ms watchdog
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(overlay.classList.contains('opacity-0')).toBe(true);

    // Sau exitDuration (400ms)
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(onFinished).toHaveBeenCalledTimes(1);
  });
});
