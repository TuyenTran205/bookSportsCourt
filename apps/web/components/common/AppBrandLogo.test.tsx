// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { AppBrandLogo } from './AppBrandLogo';

afterEach(cleanup);

describe('AppBrandLogo (TC-LOGO)', () => {
  it('TC-LOGO-01: render với kích thước mặc định 80px, bo góc và bóng đổ nhận diện', () => {
    const { container } = render(<AppBrandLogo />);

    const logo = container.querySelector('[data-testid="app-brand-logo"]');
    expect(logo).not.toBeNull();

    const element = logo as HTMLElement;
    expect(element.style.width).toBe('80px');
    expect(element.style.height).toBe('80px');
    expect(element.style.borderRadius).toBe('20px');
    expect(element.style.boxShadow).toContain('rgba(21, 128, 61, 0.22)');

    // Mặc định nạp ảnh img
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('alt')).toBe('BookSportsCourt Logo');
  });

  it('TC-LOGO-02: kích hoạt forceFallback=true hiển thị vector sân cỏ và quả bóng, không render img', () => {
    const { container } = render(<AppBrandLogo forceFallback={true} />);

    // Kiểm tra container mang màu nền cỏ sân vận động
    const logo = container.querySelector('[data-testid="app-brand-logo"]');
    expect(logo?.classList.contains('bg-primary-700')).toBe(true);

    // Không render thẻ img
    const img = container.querySelector('img');
    expect(img).toBeNull();

    // Hiển thị đầy đủ các chi tiết vector: vòng tròn giữa sân, vạch sân, quả bóng
    expect(container.querySelector('[data-testid="app-brand-logo-fallback"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="pitch-center-circle"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="pitch-center-line"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="sports-ball-icon"]')).not.toBeNull();
  });

  it('TC-LOGO-03: nhận props tuỳ biến size=120 và borderRadius=28', () => {
    const { container } = render(<AppBrandLogo size={120} borderRadius={28} showShadow={false} />);

    const logo = container.querySelector('[data-testid="app-brand-logo"]') as HTMLElement;
    expect(logo).not.toBeNull();
    expect(logo.style.width).toBe('120px');
    expect(logo.style.height).toBe('120px');
    expect(logo.style.borderRadius).toBe('28px');
    // showShadow=false thì không có boxShadow
    expect(logo.style.boxShadow).toBe('');
  });

  it('TC-LOGO-04: tự động chuyển sang vector fallback khi ảnh tải thất bại (onError event)', () => {
    const { container } = render(<AppBrandLogo />);

    const img = container.querySelector('img');
    expect(img).not.toBeNull();

    // Giả lập sự kiện ảnh bị lỗi mạng
    fireEvent.error(img!);

    // Sau khi lỗi, chuyển sang vector fallback sân cỏ
    const fallback = container.querySelector('[data-testid="app-brand-logo-fallback"]');
    expect(fallback).not.toBeNull();
    expect(container.querySelector('[data-testid="sports-ball-icon"]')).not.toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });
});
