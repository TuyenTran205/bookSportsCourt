'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { Clock, ImageOff, MapPin, Navigation, ShieldCheck, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Pagination } from '@/components/common/Pagination';
import { SlotGrid } from '@/components/features/booking/SlotGrid';
import { VenueLocationMapWrapper } from '@/components/features/venue/VenueLocationMapWrapper';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/hooks/useAuth';
import { useCreateHold } from '@/lib/hooks/useBookings';
import { ApiError } from '@/lib/api/errors';
import {
  useReviewSummary,
  useVenueDetail,
  useVenueReviews,
  useVenueSlots,
} from '@/lib/hooks/useVenue';
import { useAppRouter } from '@/lib/navigation/navigate';
import { cn } from '@/lib/utils/cn';
import {
  addDays,
  formatCurrency,
  formatDateWithWeekday,
  formatNumber,
  formatTimeRange,
  timeAgo,
  toDateInputValue,
} from '@/lib/utils/format';
import { MAX_SLOTS_PER_BOOKING, totalPrice } from '@/lib/utils/slot-selection';

const BLOCK_MINUTES = 30;

/**
 * VenueDetailScreen – GST-02/GST-03: xem chi tiết cơ sở và lịch trống theo ngày.
 * Khách chưa đăng nhập vẫn xem được hết; chỉ khi bấm "Tiếp tục" mới bị yêu cầu đăng nhập.
 */
export function VenueDetailScreen() {
  const t = useTranslations('venueDetail');
  const tSlot = useTranslations('slot');
  const { slug } = useParams<{ slug: string }>();
  const router = useAppRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const hold = useCreateHold();
  // Một khoá cho một ý định đặt: bấm lặp do mạng chậm không tạo hai hold.
  const idempotencyKey = React.useRef<string | null>(null);

  const venueQuery = useVenueDetail(slug);
  const venue = venueQuery.data;

  const today = React.useMemo(() => toDateInputValue(new Date()), []);
  const [date, setDate] = React.useState(today);
  const [courtId, setCourtId] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [activeImage, setActiveImage] = React.useState(0);
  const [reviewPage, setReviewPage] = React.useState(1);

  const slotsQuery = useVenueSlots(slug, date);
  const summaryQuery = useReviewSummary(slug);
  const reviewsQuery = useVenueReviews(slug, reviewPage);

  const activeCourts = React.useMemo(
    () => (venue?.courts ?? []).filter((c) => c.status === 'active'),
    [venue],
  );

  React.useEffect(() => {
    const first = activeCourts[0];
    if (courtId === null && first) setCourtId(first.id);
  }, [activeCourts, courtId]);

  // Đổi ngày hoặc đổi sân thì bỏ lựa chọn: key slot chỉ có nghĩa trong đúng ngày/sân đó.
  const resetSelection = () => setSelected([]);

  const courtSlots = React.useMemo(
    () => (slotsQuery.data?.courts ?? []).filter((c) => c.courtId === courtId),
    [slotsQuery.data, courtId],
  );

  const courtNames = React.useMemo(
    () => Object.fromEntries((venue?.courts ?? []).map((c) => [c.id, c.name])),
    [venue],
  );

  const dayOperatingHours = React.useMemo(() => {
    if (!slotsQuery.data?.courts) return null;
    const allSlots = slotsQuery.data.courts.flatMap((c) => c.slots);
    if (allSlots.length === 0) return 'Đóng cửa';
    let minStart = allSlots[0]!.start;
    let maxEnd = allSlots[0]!.end;
    for (const s of allSlots) {
      if (s.start < minStart) minStart = s.start;
      if (s.end > maxEnd) maxEnd = s.end;
    }
    return formatTimeRange(minStart, maxEnd);
  }, [slotsQuery.data]);

  const selectedSlots = courtSlots[0]?.slots ?? [];
  const total = totalPrice(selectedSlots, selected);
  const sortedSelected = [...selected].sort();
  const firstKey = sortedSelected[0];
  const lastKey = sortedSelected[sortedSelected.length - 1];
  const endOfLast = lastKey
    ? new Date(new Date(lastKey).getTime() + BLOCK_MINUTES * 60 * 1000)
    : null;

  if (venueQuery.isLoading) return <DetailSkeleton />;

  if (venueQuery.isError || !venue) {
    return (
      <main className="container py-12">
        <ErrorState error={venueQuery.error ?? t('notFoundDesc')} onRetry={() => venueQuery.refetch()} />
      </main>
    );
  }

  const images = [...venue.images].sort((a, b) => a.sortOrder - b.sortOrder);
  const hero = images[activeImage] ?? images[0];
  const loginHref = `/login?next=${encodeURIComponent(pathname)}`;

  const onContinue = async () => {
    if (!isAuthenticated || !courtId || selected.length === 0 || hold.isPending) return;
    // Mỗi key là `start` ISO của một block 30 phút; API nhận từng block riêng.
    // Lấy đúng cặp start/end từ danh sách slot thật để giữ nguyên định dạng múi giờ (+07:00).
    const slots = [...selected].sort().map((start) => {
      const match = selectedSlots.find((s) => s.start === start);
      return {
        start,
        end: match
          ? match.end
          : new Date(new Date(start).getTime() + BLOCK_MINUTES * 60 * 1000).toISOString(),
      };
    });
    idempotencyKey.current ??= crypto.randomUUID();
    try {
      const result = await hold.mutateAsync({
        courtId,
        slots,
        idempotencyKey: idempotencyKey.current,
      });
      router.push(`/bookings/${result.booking.id}`);
    } catch (err) {
      // Lần thử sau là một ý định mới (vd. slot vừa bị người khác giữ) nên cần khoá mới.
      idempotencyKey.current = null;
      setSelected([]);
      void slotsQuery.refetch();
      toast.error(err instanceof ApiError ? err.message : t('holdFailed'));
    }
  };

  return (
    <main className="container pb-32 pt-6 lg:pb-12">
      <nav aria-label="breadcrumb" className="mb-4 text-sm text-neutral-600">
        <Link href="/venues" className="hover:text-primary-700 hover:underline">
          {t('allVenues')}
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-neutral-900">{venue.name}</span>
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* ===== Cột trái: thông tin ===== */}
        <div className="min-w-0 space-y-8">
          <section aria-label={t('gallery')}>
            <div className="relative aspect-[16/9] overflow-hidden rounded-card bg-neutral-100">
              {hero ? (
                <Image
                  src={hero.url}
                  alt={venue.name}
                  fill
                  priority
                  unoptimized={hero.url.startsWith('data:')}
                  sizes="(min-width: 1024px) 60vw, 100vw"
                  className="object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center">
                  <ImageOff className="size-10 text-neutral-400" aria-hidden="true" />
                </div>
              )}
            </div>
            {images.length > 1 && (
              <ul className="mt-2 flex gap-2 overflow-x-auto scrollbar-thin">
                {images.map((img, i) => (
                  <li key={img.id} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveImage(i)}
                      aria-label={t('viewImage', { n: i + 1 })}
                      aria-current={i === activeImage}
                      className={cn(
                        'relative block h-16 w-24 overflow-hidden rounded-btn border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600',
                        i === activeImage ? 'border-primary-600' : 'border-transparent',
                      )}
                    >
                      <Image
                        src={img.url}
                        alt=""
                        fill
                        unoptimized={img.url.startsWith('data:')}
                        sizes="96px"
                        className="object-cover"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h1 className="text-3xl font-bold text-neutral-900">{venue.name}</h1>
            <p className="flex items-start gap-1.5 text-neutral-600">
              <MapPin className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <span>
                {venue.address}
                {venue.district && `, ${venue.district.name}`}
                {venue.province && `, ${venue.province.name}`}
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              {venue.reviewCount > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden="true" />
                  <strong>{venue.ratingAvg.toFixed(1)}</strong>
                  <span className="text-neutral-500">
                    ({formatNumber(venue.reviewCount)} {t('reviews')})
                  </span>
                </span>
              ) : (
                <span className="text-neutral-500">{t('noReviews')}</span>
              )}
              <span className="text-neutral-600">
                {t('fromPrice')}{' '}
                <strong className="text-primary-700">{formatCurrency(venue.fromPrice)}</strong>
                {t('perBlock')}
              </span>
            </div>
            {venue.sports.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {venue.sports.map((s) => (
                  <li key={s.id} className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-700">
                    {s.name}
                  </li>
                ))}
              </ul>
            )}
            {venue.description && <p className="leading-relaxed text-neutral-700">{venue.description}</p>}
          </section>

          {Number.isFinite(venue.lat) &&
            Number.isFinite(venue.lng) &&
            (venue.lat !== 0 || venue.lng !== 0) && (
              <section aria-labelledby="venue-location-heading" className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 id="venue-location-heading" className="text-xl font-semibold text-neutral-900">
                      {t('locationTitle')}
                    </h2>
                    <p className="mt-1 text-sm text-neutral-600">{t('locationAddress')}</p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${venue.lat},${venue.lng}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Navigation aria-hidden="true" />
                      {t('getDirections')}
                    </a>
                  </Button>
                </div>
                <VenueLocationMapWrapper
                  center={[venue.lat, venue.lng]}
                  marker={[venue.lat, venue.lng]}
                  className="h-72 overflow-hidden rounded-card border border-neutral-200"
                />
              </section>
            )}

          {venue.amenities.length > 0 && (
            <section aria-labelledby="amenities-h" className="space-y-3">
              <h2 id="amenities-h" className="text-xl font-semibold text-neutral-900">
                {t('amenities')}
              </h2>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {venue.amenities.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-2 rounded-btn border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700"
                  >
                    <ShieldCheck className="size-4 shrink-0 text-primary-600" aria-hidden="true" />
                    {a.name}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {venue.cancellationPolicy && (
            <section aria-labelledby="policy-h" className="space-y-3">
              <h2 id="policy-h" className="text-xl font-semibold text-neutral-900">
                {t('policy')}
              </h2>
              <Card className="space-y-1.5 p-4 text-sm text-neutral-700">
                <p>{t('policyDeposit', { percent: venue.cancellationPolicy.depositPercent })}</p>
                <p>
                  {t('policyRefund', {
                    hours: venue.cancellationPolicy.cancelBeforeHours,
                    percent: venue.cancellationPolicy.refundPercent,
                  })}
                </p>
              </Card>
            </section>
          )}

          <ReviewsSection
            summary={summaryQuery.data}
            list={reviewsQuery.data?.data}
            meta={reviewsQuery.data?.meta}
            loading={reviewsQuery.isLoading}
            onPageChange={setReviewPage}
          />
        </div>

        {/* ===== Cột phải: chọn lịch ===== */}
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:self-start" aria-label={t('bookingPanel')}>
          <Card className="space-y-4 p-4">
            <h2 className="text-lg font-semibold text-neutral-900">{t('pickSlot')}</h2>

            <div className="flex min-w-0 items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 px-1.5 text-xs sm:px-3 sm:text-sm"
                disabled={date <= today}
                onClick={() => {
                  setDate(addDays(date, -1));
                  resetSelection();
                }}
              >
                {t('prevDay')}
              </Button>
              <Input
                type="date"
                className="min-w-0 flex-1"
                value={date}
                min={today}
                aria-label={t('date')}
                onChange={(e) => {
                  if (!e.target.value) return;
                  setDate(e.target.value);
                  resetSelection();
                }}
              />
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 px-1.5 text-xs sm:px-3 sm:text-sm"
                onClick={() => {
                  setDate(addDays(date, 1));
                  resetSelection();
                }}
              >
                {t('nextDay')}
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-neutral-600">
              <p>{formatDateWithWeekday(date)}</p>
              {dayOperatingHours && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700">
                  <Clock className="size-3.5" aria-hidden="true" />
                  <span>
                    {t('openHours')}: {dayOperatingHours}
                  </span>
                </span>
              )}
            </div>

            {activeCourts.length > 1 && (
              <Tabs
                value={courtId ?? activeCourts[0]?.id ?? ''}
                onValueChange={(v) => {
                  setCourtId(v);
                  resetSelection();
                }}
              >
                <TabsList aria-label={t('courts')}>
                  {activeCourts.map((c) => (
                    <TabsTrigger key={c.id} value={c.id}>
                      {c.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            )}

            {slotsQuery.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : slotsQuery.isError ? (
              <ErrorState error={slotsQuery.error} onRetry={() => slotsQuery.refetch()} />
            ) : (
              <SlotGrid
                courts={courtSlots}
                courtNames={courtNames}
                selected={selected}
                onSelectedChange={setSelected}
                onLimitReached={(max) => toast.warning(tSlot('maxSlotsReached', { max }))}
              />
            )}
          </Card>

          <Card className="hidden space-y-3 p-4 lg:block">
            <BookingBar
              count={selected.length}
              total={total}
              range={firstKey && endOfLast ? formatTimeRange(firstKey, endOfLast) : null}
              isAuthenticated={isAuthenticated}
              loginHref={loginHref}
              onContinue={onContinue}
              pending={hold.isPending}
            />
          </Card>
        </aside>
      </div>

      {/* Thanh đặt sân cố định ở đáy cho mobile */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white p-4 shadow-lg lg:hidden">
        <BookingBar
          count={selected.length}
          total={total}
          range={firstKey && endOfLast ? formatTimeRange(firstKey, endOfLast) : null}
          isAuthenticated={isAuthenticated}
          loginHref={loginHref}
          onContinue={onContinue}
          pending={hold.isPending}
        />
      </div>
    </main>
  );
}

interface BookingBarProps {
  count: number;
  total: number;
  range: string | null;
  isAuthenticated: boolean;
  loginHref: string;
  onContinue: () => void;
  pending?: boolean;
}

function BookingBar({ count, total, range, isAuthenticated, loginHref, onContinue, pending }: BookingBarProps) {
  const t = useTranslations('venueDetail');
  const disabled = count === 0;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3 text-sm">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-neutral-600">
            <Clock className="size-4" aria-hidden="true" />
            {range ?? t('noSlotPicked')}
          </p>
          {count > 0 && (
            <p className="mt-0.5 text-xs text-neutral-500">
              {t('blocksPicked', { count, max: MAX_SLOTS_PER_BOOKING })}
            </p>
          )}
        </div>
        <p className="shrink-0 text-lg font-bold tabular-nums text-primary-700">{formatCurrency(total)}</p>
      </div>

      {isAuthenticated ? (
        <Button variant="primary" size="lg" className="w-full" disabled={disabled} loading={pending} onClick={onContinue}>
          {t('continue')}
        </Button>
      ) : disabled ? (
        <Button variant="primary" size="lg" className="w-full" disabled>
          {t('continue')}
        </Button>
      ) : (
        <Button asChild variant="primary" size="lg" className="w-full">
          <Link href={loginHref}>{t('loginToContinue')}</Link>
        </Button>
      )}
    </div>
  );
}

interface ReviewsSectionProps {
  summary?: { average: number; total: number; buckets: Array<{ star: number; count: number }> };
  list?: Array<{
    id: string;
    rating: number;
    comment: string | null;
    ownerReply: string | null;
    createdAt: string;
    customer?: { fullName: string };
  }>;
  meta?: { page: number; limit: number; total: number; totalPages: number };
  loading: boolean;
  onPageChange: (page: number) => void;
}

function ReviewsSection({ summary, list, meta, loading, onPageChange }: ReviewsSectionProps) {
  const t = useTranslations('venueDetail');

  return (
    <section aria-labelledby="reviews-h" className="space-y-4">
      <h2 id="reviews-h" className="text-xl font-semibold text-neutral-900">
        {t('reviewsTitle')}
      </h2>

      {summary && summary.total > 0 && (
        <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
          <div className="text-center sm:w-32">
            <p className="text-4xl font-bold tabular-nums text-neutral-900">{summary.average.toFixed(1)}</p>
            <p className="text-xs text-neutral-500">
              {formatNumber(summary.total)} {t('reviews')}
            </p>
          </div>
          <ul className="flex-1 space-y-1.5">
            {summary.buckets.map((b) => (
              <li key={b.star} className="flex items-center gap-2 text-xs text-neutral-600">
                <span className="w-8 tabular-nums">{b.star} ★</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                  <span
                    className="block h-full rounded-full bg-amber-400"
                    style={{ width: `${summary.total ? (b.count / summary.total) * 100 : 0}%` }}
                  />
                </span>
                <span className="w-6 text-right tabular-nums">{b.count}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : !list || list.length === 0 ? (
        <EmptyState icon={Star} title={t('noReviews')} description={t('noReviewsDesc')} />
      ) : (
        <>
          <ul className="space-y-3">
            {list.map((r) => (
              <li key={r.id}>
                <Card className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-neutral-900">{r.customer?.fullName ?? t('anonymous')}</p>
                    <p className="text-xs text-neutral-500">{timeAgo(r.createdAt)}</p>
                  </div>
                  <p className="flex items-center gap-0.5" aria-label={t('ratingAria', { rating: r.rating })}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          'size-4',
                          i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-neutral-300',
                        )}
                        aria-hidden="true"
                      />
                    ))}
                  </p>
                  {r.comment && <p className="text-sm text-neutral-700">{r.comment}</p>}
                  {r.ownerReply && (
                    <div className="rounded-btn bg-neutral-50 p-3 text-sm">
                      <p className="mb-0.5 text-xs font-semibold text-neutral-600">{t('ownerReply')}</p>
                      <p className="text-neutral-700">{r.ownerReply}</p>
                    </div>
                  )}
                </Card>
              </li>
            ))}
          </ul>
          {meta && <Pagination meta={meta} onPageChange={onPageChange} />}
        </>
      )}
    </section>
  );
}

function DetailSkeleton() {
  return (
    <main className="container py-6">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <Skeleton className="aspect-[16/9] w-full" />
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    </main>
  );
}
