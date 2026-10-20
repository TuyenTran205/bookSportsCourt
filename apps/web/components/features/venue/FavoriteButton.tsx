'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { ApiError } from '@/lib/api/errors';
import { useAuth } from '@/lib/hooks/useAuth';
import { useFavorites, useToggleFavorite } from '@/lib/hooks/useBookings';
import { useAppRouter } from '@/lib/navigation/navigate';
import { cn } from '@/lib/utils/cn';

/**
 * FavoriteButton – CUS-13: thêm/bỏ sân yêu thích. Khách chưa đăng nhập bấm vào
 * sẽ được đưa tới trang đăng nhập rồi quay lại đúng trang đang xem.
 */
export function FavoriteButton({ venueId }: { venueId: string }) {
  const t = useTranslations('favorites');
  const router = useAppRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();

  const favorites = useFavorites(isAuthenticated);
  const toggle = useToggleFavorite();

  const favorited = !!favorites.data?.some((v) => v.id === venueId);

  const onClick = async () => {
    if (!isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    try {
      await toggle.mutateAsync({ venueId, favorited });
      toast.success(favorited ? t('removed') : t('added'));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t('failed'));
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={toggle.isPending}
      aria-pressed={favorited}
      aria-label={favorited ? t('remove') : t('add')}
      className="inline-flex size-9 items-center justify-center rounded-full bg-white/95 shadow-sm transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 disabled:opacity-60"
    >
      <Heart
        className={cn('size-5', favorited ? 'fill-danger text-danger' : 'text-neutral-600')}
        aria-hidden="true"
      />
    </button>
  );
}
