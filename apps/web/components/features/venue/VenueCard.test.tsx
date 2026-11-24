// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VenueListItem } from '@bsc/shared';

import { VenueCard } from './VenueCard';

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt, src }: { alt?: string; src?: string }) => <img alt={alt ?? ''} src={src ?? ''} />,
}));

vi.mock('@/components/features/venue/VenueCompareButton', () => ({
  VenueCompareButton: ({ venue }: { venue: VenueListItem }) => (
    <button type="button" data-testid={`compare-${venue.id}`}>
      So sánh
    </button>
  ),
}));

const baseVenue: VenueListItem = {
  id: 'v-card-1',
  name: 'CLB Cầu Lông Hoàng Gia',
  slug: 'clb-hoang-gia',
  address: '88 Láng Hạ',
  coverUrl: 'https://cdn.example.com/cover.jpg',
  status: 'active',
  ratingAvg: 4.7,
  reviewCount: 18,
  fromPrice: 120000,
  province: { id: 1, name: 'Hà Nội' },
  district: { id: 2, name: 'Đống Đa' },
  ward: { id: 3, name: 'Láng Hạ' },
  sports: [
    { id: '1', name: 'Cầu lông', slug: 'cau-long', icon: 'badminton' },
    { id: '2', name: 'Pickleball', slug: 'pickleball', icon: 'pickleball' },
    { id: '3', name: 'Bóng bàn', slug: 'bong-ban', icon: 'table-tennis' },
    { id: '4', name: 'Tennis', slug: 'tennis', icon: 'tennis' },
  ],
} as unknown as VenueListItem;

describe('VenueCard (GST-02, P0/P2 UI States)', () => {
  afterEach(() => {
    cleanup();
  });

  it('hiển thị thông tin cơ bản, giới hạn tối đa 3 môn (+N) và nút so sánh ở chế độ công khai', () => {
    render(<VenueCard venue={baseVenue} />);

    expect(screen.getByText('CLB Cầu Lông Hoàng Gia')).not.toBeNull();
    expect(screen.getByText('Láng Hạ, Hà Nội')).not.toBeNull();
    expect(screen.getByText('+1')).not.toBeNull();
    expect(screen.getByText(/4\.7/)).not.toBeNull();
    expect(screen.getByTestId('compare-v-card-1')).not.toBeNull();
  });

  it('hiển thị fallback "Liên hệ", "Chưa có đánh giá", placeholder ảnh và ẩn nút so sánh khi bật showStatus', () => {
    const minimalVenue = {
      ...baseVenue,
      id: 'v-card-2',
      coverUrl: null,
      fromPrice: null,
      reviewCount: 0,
      ratingAvg: 0,
      status: 'pending',
    } as unknown as VenueListItem;

    render(<VenueCard venue={minimalVenue} showStatus href="/owner/venues/v-card-2" />);

    expect(screen.getByText('Liên hệ')).not.toBeNull();
    expect(screen.getByText('Chưa có đánh giá')).not.toBeNull();
    expect(screen.queryByTestId('compare-v-card-2')).toBeNull();
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/owner/venues/v-card-2');
  });
});
