import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ImageOff, MapPin, Star } from 'lucide-react';

import type { VenueListItem } from '@bsc/shared';

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
  className?: string;
}

export function VenueCard({ venue, showStatus = false, href, action, className }: VenueCardProps) {
  const location = venue.district?.name ?? venue.province?.name ?? venue.address;
  const detailHref = href ?? `/venues/${venue.slug}`;

  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-card border border-neutral-200 bg-white',
        'transition-shadow duration-150 hover:shadow-md',
        className,
      )}
    >
      {action && <div className="absolute left-2 top-2 z-10">{action}</div>}
      <Link href={detailHref} className="block focus-visible:outline-none">
        <div className="relative aspect-video bg-neutral-100">
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
              <ImageOff className="size-8 text-neutral-400" aria-hidden="true" />
            </div>
          )}

          {/* Badge trạng thái là ngoại lệ duy nhất được nằm trên ảnh. */}
          {showStatus && (
            <div className="absolute right-2 top-2">
              <StatusBadge kind="venue" status={venue.status} />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 p-4">
          <h3 className="line-clamp-1 text-base font-bold text-neutral-900">{venue.name}</h3>

          <p className="flex items-center gap-1 text-sm text-neutral-600">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            <span className="line-clamp-1">{location}</span>
          </p>

          {/* Môn thể thao — tối đa 3 thẻ để hàng không xuống dòng. */}
          {venue.sports.length > 0 && (
            <ul className="flex flex-wrap gap-1">
              {venue.sports.slice(0, 3).map((sport) => (
                <li
                  key={sport.id}
                  className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700"
                >
                  {sport.name}
                </li>
              ))}
              {venue.sports.length > 3 && (
                <li className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
                  +{venue.sports.length - 3}
                </li>
              )}
            </ul>
          )}

          <div className="mt-1 flex items-end justify-between gap-2">
            <p className="text-sm text-neutral-500">
              từ <span className="text-base font-bold text-primary-700">
                {formatCurrency(venue.fromPrice)}
              </span>
            </p>
            <RatingValue rating={venue.ratingAvg} count={venue.reviewCount} />
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
function RatingValue({ rating, count }: { rating: number; count: number }) {
  if (count === 0) {
    return <span className="text-xs text-neutral-400">Chưa có đánh giá</span>;
  }

  return (
    <span
      className="flex items-center gap-1 text-sm"
      aria-label={`${rating} trên 5, ${formatNumber(count)} đánh giá`}
    >
      <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden="true" />
      <span className="font-medium text-neutral-900">{rating.toFixed(1)}</span>
      <span className="text-xs text-neutral-500">({formatNumber(count)})</span>
    </span>
  );
}
