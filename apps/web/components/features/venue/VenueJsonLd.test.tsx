// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';

import type { VenueDetail } from '@bsc/shared';
import { VenueJsonLd } from './VenueJsonLd';

const mockVenue: VenueDetail = {
  id: '019273c5-7f12-7000-8000-000000000001',
  slug: 'san-cau-long-hoang-gia',
  name: 'Sân Cầu Lông Hoàng Gia',
  description: 'Cụm 6 sân thảm tiêu chuẩn BWF',
  address: '123 Đường Cầu Giấy',
  provinceId: '01',
  districtId: '005',
  lat: 21.0333,
  lng: 105.7833,
  status: 'approved',
  coverUrl: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5',
  ratingAvg: 4.8,
  reviewCount: 42,
  fromPrice: 100000,
  ownerId: '019273c5-7f12-7000-8000-000000000010',
  province: {
    id: '01',
    slug: 'ha-noi',
    name: 'Hà Nội',
  },
  district: {
    id: '005',
    provinceId: '01',
    slug: 'cau-giay',
    name: 'Cầu Giấy',
  },
  sports: [
    { id: 'sp-1', name: 'Cầu lông', slug: 'badminton', icon: 'activity' },
  ],
  images: [
    { id: 'img-1', url: 'https://images.unsplash.com/photo-1', sortOrder: 0 },
    { id: 'img-2', url: 'https://images.unsplash.com/photo-2', sortOrder: 1 },
  ],
  amenities: [],
  courts: [],
  cancellationPolicy: null,
  openingHours: [
    {
      id: 'oh-1',
      venueId: 'v-1',
      courtId: null,
      weekday: 1, // Thứ hai
      openTime: '06:00',
      closeTime: '22:00',
      isClosed: false,
    },
    {
      id: 'oh-2',
      venueId: 'v-1',
      courtId: null,
      weekday: 0, // Chủ nhật
      openTime: '08:00',
      closeTime: '20:00',
      isClosed: false,
    },
    {
      id: 'oh-3',
      venueId: 'v-1',
      courtId: null,
      weekday: 2, // Thứ ba (đóng cửa)
      openTime: '00:00',
      closeTime: '00:00',
      isClosed: true,
    },
  ],
};

describe('VenueJsonLd component (SPEC-FE-BATCH3-01 / TODO-12)', () => {
  afterEach(() => {
    cleanup();
  });

  it('TC-SEO-03: Render thẻ script type="application/ld+json" với cấu trúc hợp lệ', () => {
    const { container } = render(<VenueJsonLd venue={mockVenue} />);

    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    expect(script?.textContent).toBeTruthy();

    const data = JSON.parse(script?.textContent || '{}');

    expect(data['@context']).toBe('https://schema.org');
    expect(data['@type']).toBe('SportsActivityLocation');
    expect(data.name).toBe('Sân Cầu Lông Hoàng Gia');
    expect(data.description).toBe('Cụm 6 sân thảm tiêu chuẩn BWF');

    // Kiểm tra danh sách ảnh
    expect(data.image).toEqual([
      'https://images.unsplash.com/photo-1',
      'https://images.unsplash.com/photo-2',
    ]);

    // Kiểm tra địa chỉ
    expect(data.address).toEqual({
      '@type': 'PostalAddress',
      streetAddress: '123 Đường Cầu Giấy',
      addressLocality: 'Cầu Giấy',
      addressRegion: 'Hà Nội',
      addressCountry: 'VN',
    });

    // Kiểm tra tọa độ geo
    expect(data.geo).toEqual({
      '@type': 'GeoCoordinates',
      latitude: 21.0333,
      longitude: 105.7833,
    });

    // Kiểm tra aggregateRating
    expect(data.aggregateRating).toEqual({
      '@type': 'AggregateRating',
      ratingValue: 4.8,
      reviewCount: 42,
      bestRating: 5,
      worstRating: 1,
    });

    // Kiểm tra openingHoursSpecification (chỉ lấy ngày mở cửa, loại bỏ ngày isClosed)
    expect(data.openingHoursSpecification).toHaveLength(2);
    expect(data.openingHoursSpecification).toEqual([
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: 'Monday',
        opens: '06:00',
        closes: '22:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: 'Sunday',
        opens: '08:00',
        closes: '20:00',
      },
    ]);
  });

  it('sử dụng coverUrl làm fallback khi mảng images rỗng', () => {
    const venueWithoutImages: VenueDetail = {
      ...mockVenue,
      images: [],
      coverUrl: 'https://images.unsplash.com/cover-fallback',
    };

    const { container } = render(<VenueJsonLd venue={venueWithoutImages} />);
    const script = container.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(script?.textContent || '{}');

    expect(data.image).toEqual(['https://images.unsplash.com/cover-fallback']);
  });

  it('xử lý an toàn khi venue không có đánh giá và không có giờ mở cửa', () => {
    const minimalVenue: VenueDetail = {
      ...mockVenue,
      ratingAvg: 0,
      reviewCount: 0,
      description: null,
      images: [],
      coverUrl: null,
      openingHours: [],
    };

    const { container } = render(<VenueJsonLd venue={minimalVenue} />);
    const script = container.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(script?.textContent || '{}');

    expect(data['@type']).toBe('SportsActivityLocation');
    expect(data.description).toBeUndefined();
    expect(data.image).toBeUndefined();
    expect(data.aggregateRating).toBeUndefined();
    expect(data.openingHoursSpecification).toBeUndefined();
  });
});
