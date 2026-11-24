// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VenueListItem } from '@bsc/shared';

import { FavoriteButton } from './FavoriteButton';
import { FavoritesScreen } from './FavoritesScreen';
import { useAuth } from '@/lib/hooks/useAuth';
import { useFavorites, useToggleFavorite } from '@/lib/hooks/useBookings';

const mockPush = vi.fn();

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/venues/san-thang-long',
}));

vi.mock('@/lib/navigation/navigate', () => ({
  useAppRouter: () => ({ push: mockPush }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/lib/hooks/useBookings', () => ({
  useFavorites: vi.fn(),
  useToggleFavorite: vi.fn(),
}));

vi.mock('@/components/features/venue/VenueCard', () => ({
  VenueCard: ({ venue, action }: { venue: VenueListItem; action?: React.ReactNode }) => (
    <div data-testid="venue-card">
      <span>{venue.name}</span>
      {action}
    </div>
  ),
}));

describe('Favorites flow (CUS-12)', () => {
  const toggleMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useToggleFavorite).mockReturnValue({
      isPending: false,
      mutateAsync: toggleMutate,
    } as unknown as ReturnType<typeof useToggleFavorite>);
  });

  afterEach(() => {
    cleanup();
  });

  it('FavoriteButton điều hướng sang /login?next=... khi chưa đăng nhập và gọi toggle khi đã đăng nhập', async () => {
    vi.mocked(useAuth).mockReturnValue({ isAuthenticated: false } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useFavorites).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useFavorites>);

    render(<FavoriteButton venueId="venue-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'add' }));
    expect(mockPush).toHaveBeenCalledWith('/login?next=%2Fvenues%2Fsan-thang-long');

    cleanup();
    vi.mocked(useAuth).mockReturnValue({ isAuthenticated: true } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useFavorites).mockReturnValue({
      data: [{ id: 'venue-1', name: 'Sân Thăng Long' }],
    } as unknown as ReturnType<typeof useFavorites>);
    toggleMutate.mockResolvedValueOnce(undefined);

    render(<FavoriteButton venueId="venue-1" />);
    const btn = screen.getByRole('button', { name: 'remove' });
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(btn);

    await waitFor(() => {
      expect(toggleMutate).toHaveBeenCalledWith({ venueId: 'venue-1', favorited: true });
    });
  });

  it('FavoritesScreen hiển thị EmptyState khi rỗng và danh sách sân khi có dữ liệu', () => {
    vi.mocked(useAuth).mockReturnValue({ isAuthenticated: true } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useFavorites).mockReturnValue({
      isLoading: false,
      isError: false,
      data: [],
    } as unknown as ReturnType<typeof useFavorites>);

    render(<FavoritesScreen />);
    expect(screen.getByText('emptyTitle')).not.toBeNull();
    expect(screen.getByRole('link', { name: /explore/i }).getAttribute('href')).toBe('/venues');

    cleanup();
    vi.mocked(useFavorites).mockReturnValue({
      isLoading: false,
      isError: false,
      data: [{ id: 'venue-1', name: 'Sân Cầu Lông Thăng Long' }],
    } as unknown as ReturnType<typeof useFavorites>);

    render(<FavoritesScreen />);
    expect(screen.getByText('Sân Cầu Lông Thăng Long')).not.toBeNull();
  });
});
