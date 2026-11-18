import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ImageOff, MapPin, Star } from 'lucide-react';

import type { VenueListItem } from '@bsc/shared';

import { VenueCompareButton } from '@/components/features/venue/VenueCompareButton';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils/cn';
import { formatCurrency, formatNumber } from '@/lib/utils/format';

/**
 * VenueCard – docs/07-design-system.md mục 10.
 *
 * Quy tắc từ tài liệu:
 * - Ảnh 16:9, `object-cover`.
 * - KHÔNG overlay text trên ảnh (chỉ badge trạng thái ở góc trên).
 * - Thông tin: tên sân (bold), quận/huyện, môn thể thao, giá từ, rating.
 * - Hover: `shadow-md`, KHÔNG transform scale (gây layout shift).
 *
 * Server Component: chỉ nhận props và render, không có state.
 */
export interface VenueCardProps {
  venue: VenueListItem;
  /**
   * Hiện badge trạng thái. Mặc định tắt vì khách chỉ thấy cơ sở đã duyệt;
   * màn quản trị bật lên để phân biệt `pending` / `suspended`.
   */
  showStatus?: boolean;
  /** Ghi đè `href` — màn owner trỏ sang trang quản lý thay vì trang công khai. */
  href?: string;
  /**
   * Nút hành động nhỏ (vd. yêu thích) đặt ở góc ảnh. Là slot để thẻ vẫn là Server
   * Component; nút phải nằm ngoài `<Link>` nên không thể lồng trong phần dưới.
   */
  action?: React.ReactNode;
  /**
   * Hiển thị nút so sánh cơ sở. Mặc định tự bật ở trang khách/công khai.
   */
  showCompare?: boolean;
  /** Mật độ hiển thị thẻ (`compact` thu gọn chiều cao cho chế độ chia đôi 1:2). */
  density?: 'default' | 'compact';
  className?: string;
}

export function VenueCard({
  venue,
  showStatus = false,
  href,
  action,
  showCompare = true,
  density = 'default',
  className,
}: VenueCardProps) {
  const location = venue.ward?.name
    ? `${venue.ward.name}, ${venue.province?.name ?? ''}`.trim()
    : (venue.district?.name ?? venue.province?.name ?? venue.address);
  const detailHref = href ?? `/venues/${venue.slug}`;
  const displayCompare = showCompare && !showStatus;
  const isCompact = density === 'compact';

  return (
    <article
      className={cn(
        'group relative isolate box-border overflow-hidden rounded-card border border-border bg-bg-card',
        'transition-shadow duration-150 hover:shadow-md',
        className,
      )}
    >
      {(action || displayCompare) && (
        <div className="absolute left-2 top-2 z-10 flex items-center gap-1.5">
          {action}
          {displayCompare && <VenueCompareButton venue={venue} />}
        </div>
      )}
      <Link href={detailHref} className="block focus-visible:outline-none">
        <div
          className={cn(
            'relative overflow-hidden bg-bg-subtle',
            isCompact ? 'h-28 sm:h-32' : 'h-40 sm:h-44',
          )}
        >
          {venue.coverUrl ? (
            <Image
              src={venue.coverUrl}
              alt=""
              fill
              unoptimized={venue.coverUrl.startsWith('data:')}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover"
            />
          ) : (
            // Không có ảnh: khung xám + icon, KHÔNG để vỡ layout.
            <div className="flex size-full items-center justify-center">
              <ImageOff className="size-8 text-text-disabled" aria-hidden="true" />
            </div>
          )}

          {/* Badge trạng thái là ngoại lệ duy nhất được nằm trên ảnh. */}
          {showStatus && (
            <div className="absolute right-2 top-2">
              <StatusBadge kind="venue" status={venue.status} />
            </div>
          )}
        </div>

        <div className={cn('flex flex-col', isCompact ? 'gap-1 p-3' : 'gap-1.5 p-3.5 sm:p-4')}>
          <h3
            className={cn(
              'line-clamp-1 font-bold text-text-primary',
              isCompact ? 'text-sm' : 'text-base',
            )}
          >
            {venue.name}
          </h3>

          <p
            className={cn(
              'flex items-center gap-1 text-text-secondary',
              isCompact ? 'text-xs' : 'text-sm',
            )}
          >
            <MapPin
              className={cn('shrink-0', isCompact ? 'size-3.5' : 'size-4')}
              aria-hidden="true"
            />
            <span className="line-clamp-1">{location}</span>
          </p>

          {/* Môn thể thao — tối đa 3 thẻ để hàng không xuống dòng. */}
          {(venue.sports ?? []).length > 0 && (
            <ul className={cn('flex flex-wrap gap-1', !isCompact && 'min-h-6')}>
              {(venue.sports ?? []).slice(0, 3).map((sport) => (
                <li
                  key={sport.id}
                  className={cn(
                    'rounded-full bg-bg-subtle text-text-secondary',
                    isCompact ? 'px-2 py-0.5 text-[11px]' : 'px-2 py-0.5 text-xs',
                  )}
                >
                  {sport.name}
                </li>
              ))}
              {(venue.sports ?? []).length > 3 && (
                <li
                  className={cn(
                    'rounded-full bg-bg-subtle text-text-secondary',
                    isCompact ? 'px-2 py-0.5 text-[11px]' : 'px-2 py-0.5 text-xs',
                  )}
                >
                  +{(venue.sports ?? []).length - 3}
                </li>
              )}
            </ul>
          )}

          <div
            className={cn(
              'flex items-end justify-between gap-2',
              isCompact ? 'mt-0.5' : 'mt-1',
            )}
          >
            <p className={cn('text-text-secondary', isCompact ? 'text-xs' : 'text-sm')}>
              từ{' '}
              <span
                className={cn(
                  'font-bold text-primary-700 dark:text-primary-400',
                  isCompact ? 'text-sm' : 'text-base',
                )}
              >
                {venue.fromPrice === null ? 'Liên hệ' : formatCurrency(venue.fromPrice)}
              </span>
            </p>
            <RatingValue rating={venue.ratingAvg ?? 0} count={venue.reviewCount ?? 0} />
          </div>
        </div>
      </Link>
    </article>
  );
}

/**
 * Điểm đánh giá.
 *
 * Chưa có đánh giá thì hiện "Chưa có đánh giá" thay vì "0.0 ★" — số 0 gây
 * hiểu nhầm là bị đánh giá thấp.
 */
function RatingValue({ rating = 0, count = 0 }: { rating?: number | null; count?: number | null }) {
  const safeCount = count ?? 0;
  const safeRating = rating ?? 0;

  if (safeCount === 0) {
    return <span className="text-xs text-text-disabled">Chưa có đánh giá</span>;
  }

  return (
    <span
      className="flex items-center gap-1 text-sm"
      aria-label={`${safeRating} trên 5, ${formatNumber(safeCount)} đánh giá`}
    >
      <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden="true" />
      <span className="font-medium text-text-primary">{safeRating.toFixed(1)}</span>
      <span className="text-xs text-text-secondary">({formatNumber(safeCount)})</span>
    </span>
  );
}
