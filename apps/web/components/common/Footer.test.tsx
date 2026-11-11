// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { Footer } from './Footer';

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => {
    if (namespace === 'common' && key === 'appName') return 'BookSportsCourt';
    if (namespace === 'footer') {
      const messages: Record<string, string> = {
        brandDescription: 'Nền tảng đặt sân thể thao trực tuyến hàng đầu Việt Nam.',
        customerHeading: 'Người chơi',
        findVenues: 'Tìm sân thể thao',
        myBookings: 'Lịch đặt của tôi',
        ownerHeading: 'Dành cho chủ sân',
        ownerTimeline: 'Kênh quản lý lịch sân',
        ownerApply: 'Đăng ký mở cơ sở',
        bookingGuide: 'Hướng dẫn đặt sân',
        paymentProcess: 'Quy trình duyệt thanh toán',
        partnerPolicy: 'Chính sách phí đối tác (0đ)',
        policyHeading: 'Quy định & Chính sách',
        terms: 'Điều khoản dịch vụ',
        privacy: 'Chính sách bảo mật',
        cancellationPolicy: 'Chính sách huỷ & hoàn cọc',
        operatingRegulations: 'Quy chế hoạt động',
        currencyInfo: 'Tiền tệ: VND (₫)',
        timezoneInfo: 'Múi giờ: Asia/Ho_Chi_Minh (GMT+7)',
      };
      return messages[key] ?? `${namespace}.${key}`;
    }
    return key;
  },
}));

describe('Footer component (SPEC-FE-BATCH3-01 / TODO-12)', () => {
  afterEach(cleanup);

  it('render thông tin thương hiệu, các cột điều hướng và ghi chú múi giờ/tiền tệ theo i18n', () => {
    render(<Footer />);

    expect(screen.getByText('BookSportsCourt')).toBeDefined();
    expect(screen.getByText('Nền tảng đặt sân thể thao trực tuyến hàng đầu Việt Nam.')).toBeDefined();

    // Các đề mục chính
    expect(screen.getByText('Người chơi')).toBeDefined();
    expect(screen.getByText('Dành cho chủ sân')).toBeDefined();
    expect(screen.getByText('Quy định & Chính sách')).toBeDefined();

    // Các liên kết quan trọng
    expect(screen.getByRole('link', { name: 'Tìm sân thể thao' }).getAttribute('href')).toBe('/venues');
    expect(screen.getByRole('link', { name: 'Lịch đặt của tôi' }).getAttribute('href')).toBe('/bookings');
    expect(screen.getByRole('link', { name: 'Kênh quản lý lịch sân' }).getAttribute('href')).toBe('/owner/timeline');
    expect(screen.getByRole('link', { name: 'Đăng ký mở cơ sở' }).getAttribute('href')).toBe('/owner/apply');
    expect(screen.getByRole('link', { name: 'Hướng dẫn đặt sân' }).getAttribute('href')).toBe(
      '/info/booking-guide',
    );
    expect(screen.getByRole('link', { name: 'Quy trình duyệt thanh toán' }).getAttribute('href')).toBe(
      '/owner/payments',
    );
    expect(screen.getByRole('link', { name: 'Chính sách phí đối tác (0đ)' }).getAttribute('href')).toBe(
      '/info/partner-policy',
    );
    expect(screen.getByRole('link', { name: 'Điều khoản dịch vụ' }).getAttribute('href')).toBe(
      '/info/terms',
    );
    expect(screen.getByRole('link', { name: 'Chính sách bảo mật' }).getAttribute('href')).toBe(
      '/info/privacy',
    );
    expect(screen.getByRole('link', { name: 'Chính sách huỷ & hoàn cọc' }).getAttribute('href')).toBe(
      '/info/cancellation-policy',
    );
    expect(screen.getByRole('link', { name: 'Quy chế hoạt động' }).getAttribute('href')).toBe(
      '/info/operating-regulations',
    );

    // Múi giờ và tiền tệ
    expect(screen.getByText(/Tiền tệ: VND/i)).toBeDefined();
    expect(screen.getByText(/Múi giờ: Asia\/Ho_Chi_Minh/i)).toBeDefined();
  });
});
