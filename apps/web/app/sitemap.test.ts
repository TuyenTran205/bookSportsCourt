import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import sitemap from './sitemap';
import * as venueApi from '@/lib/api/endpoints/venues';

vi.mock('@/lib/api/endpoints/venues', () => ({
  listVenues: vi.fn(),
}));

describe('sitemap.ts metadata route (SPEC-FE-BATCH3-01 / TODO-12)', () => {
  const originalEnv = process.env.NEXT_PUBLIC_SITE_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://booksportscourt.vn';
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = originalEnv;
    vi.restoreAllMocks();
  });

  it('TC-SEO-02: sinh danh sách sitemap bao gồm các route tĩnh và route động venues', async () => {
    vi.mocked(venueApi.listVenues).mockResolvedValueOnce({
      data: [
        {
          id: 'v-1',
          slug: 'san-cau-long-hoang-gia',
          name: 'Sân Cầu Lông Hoàng Gia',
          address: 'Hà Nội',
          province: null,
          district: null,
          lat: 21,
          lng: 105,
          status: 'approved',
          coverUrl: null,
          ratingAvg: 4.8,
          reviewCount: 10,
          fromPrice: 100000,
          sports: [],
        },
        {
          id: 'v-2',
          slug: 'san-bong-da-thang-long',
          name: 'Sân Bóng Đá Thăng Long',
          address: 'Hà Nội',
          province: null,
          district: null,
          lat: 21,
          lng: 105,
          status: 'approved',
          coverUrl: null,
          ratingAvg: 4.5,
          reviewCount: 5,
          fromPrice: 300000,
          sports: [],
        },
      ],
      meta: {
        total: 2,
        page: 1,
        limit: 100,
        totalPages: 1,
      },
    });

    const entries = await sitemap();

    expect(entries.length).toBe(5); // 3 tĩnh + 2 venues động

    // Tuyến đường tĩnh
    expect(entries.find((e) => e.url === 'https://booksportscourt.vn')?.priority).toBe(1.0);
    expect(entries.find((e) => e.url === 'https://booksportscourt.vn/venues')?.priority).toBe(0.9);
    expect(entries.find((e) => e.url === 'https://booksportscourt.vn/owner/apply')?.priority).toBe(0.6);

    // Tuyến đường động venues
    const venue1 = entries.find((e) => e.url === 'https://booksportscourt.vn/venues/san-cau-long-hoang-gia');
    expect(venue1).toBeDefined();
    expect(venue1?.priority).toBe(0.8);
    expect(venue1?.changeFrequency).toBe('weekly');

    const venue2 = entries.find((e) => e.url === 'https://booksportscourt.vn/venues/san-bong-da-thang-long');
    expect(venue2).toBeDefined();
    expect(venue2?.priority).toBe(0.8);
  });

  it('xử lý an toàn khi API listVenues bị lỗi, trả về danh sách route tĩnh dự phòng', async () => {
    vi.mocked(venueApi.listVenues).mockRejectedValueOnce(new Error('Network error'));

    const entries = await sitemap();

    expect(entries.length).toBe(3);
    expect(entries.map((e) => e.url)).toEqual([
      'https://booksportscourt.vn',
      'https://booksportscourt.vn/venues',
      'https://booksportscourt.vn/owner/apply',
    ]);
  });
});
