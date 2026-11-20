'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { Clock, ImageOff, Map as MapIcon, MapPin, Navigation, ShieldCheck, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Pagination } from '@/components/common/Pagination';
import { SlotGrid } from '@/components/features/booking/SlotGrid';
import { BookingConfirmDialog } from '@/components/features/venue/BookingConfirmDialog';
import { VenueLocationMapWrapper } from '@/components/features/venue/VenueLocationMapWrapper';
import { VenueOpeningHours } from '@/components/features/venue/VenueOpeningHours';
import { VenueJsonLd } from '@/components/features/venue/VenueJsonLd';
import { VenueCompareButton } from '@/components/features/venue/VenueCompareButton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { useVenueRoom } from '@/lib/hooks/useVenueRoom';
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
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const slotsQuery = useVenueSlots(slug, date);
  const summaryQuery = useReviewSummary(slug);
  const reviewsQuery = useVenueReviews(slug, reviewPage);

  // Realtime: vào room của sân+ngày để lưới slot tự cập nhật khi có người giữ/đặt/huỷ.
  // `useVenueRoom` tự bỏ qua khi SocketProvider không mount (vd. trang public/Storybook).
  useVenueRoom(venue?.id, date);

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

  const selectedSlots = React.useMemo(
    () => courtSlots[0]?.slots ?? [],
    [courtSlots],
  );
  const total = totalPrice(selectedSlots, selected);
  const pickedSlotItems = React.useMemo(
    () =>
      [...selected]
        .sort()
        .map((start) => selectedSlots.find((s) => s.start === start))
        .filter((s): s is NonNullable<typeof s> => Boolean(s)),
    [selected, selectedSlots],
  );
  const selectedCourt = React.useMemo(
    () => activeCourts.find((c) => c.id === courtId) ?? null,
    [activeCourts, courtId],
  );
  const selectedSportName = React.useMemo(
    () => venue?.sports.find((s) => s.id === selectedCourt?.sportId)?.name ?? null,
    [venue?.sports, selectedCourt?.sportId],
  );
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
  const selectedRangeText = firstKey && endOfLast ? formatTimeRange(firstKey, endOfLast) : null;
  const hasCoordinates =
    typeof venue.lat === 'number' &&
    typeof venue.lng === 'number' &&
    Number.isFinite(venue.lat) &&
    Number.isFinite(venue.lng) &&
    (venue.lat !== 0 || venue.lng !== 0);
  const addressParts: string[] = [];
  if (venue.address) addressParts.push(venue.address.trim());
  const lowerAddr = (venue.address ?? '').toLowerCase();
  if (venue.district?.name && !lowerAddr.includes(venue.district.name.toLowerCase())) {
    addressParts.push(venue.district.name);
  }
  if (
    venue.province?.name &&
    !lowerAddr.includes(venue.province.name.toLowerCase().replace(/^(thành phố|tỉnh)\s+/i, ''))
  ) {
    addressParts.push(venue.province.name);
  }
  const fullAddress = addressParts.join(', ');
  const googleMapsDestination = hasCoordinates ? `${venue.lat},${venue.lng}` : fullAddress;
  const googleMapsDirectionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(googleMapsDestination)}`;

  const onOpenConfirm = () => {
    if (!isAuthenticated || !courtId || selected.length === 0 || hold.isPending) return;
    setConfirmOpen(true);
  };

  const onConfirmHold = async () => {
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
      setConfirmOpen(false);
      router.push(`/checkout/${result.booking.id}`);
    } catch (err) {
      // Lần thử sau là một ý định mới (vd. slot vừa bị người khác giữ) nên cần khoá mới.
      idempotencyKey.current = null;
      setConfirmOpen(false);
      setSelected([]);
      void slotsQuery.refetch();
      toast.error(err instanceof ApiError ? err.message : t('holdFailed'));
    }
  };

  return (
    <main className="container pb-32 pt-6 lg:pb-12">
      <VenueJsonLd venue={venue} />
      <nav aria-label="breadcrumb" className="mb-3 text-sm text-neutral-600">
        <Link href="/venues" className="hover:text-primary-700 hover:underline">
          {t('allVenues')}
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-neutral-900">{venue.name}</span>
      </nav>

      <div className="space-y-4 sm:space-y-5">
        {/* ===== Laptop (lg+): Hàng 1 là Ảnh (1) | Tabs (2) chia 1:1, Hàng 2 là Thông tin chính (col-span-2). Mobile: Ảnh (1) -> Thông tin chính (2) -> Tabs (3) ===== */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch lg:gap-6">
          <section aria-label={t('gallery')} className="order-1 flex flex-col lg:order-1">
            <div className="relative aspect-video min-h-48 w-full overflow-hidden rounded-card bg-neutral-100">
              {hero ? (
                <Image
                  src={hero.url}
                  alt={venue.name}
                  fill
                  priority
                  unoptimized={hero.url.startsWith('data:')}
                  sizes="(min-width: 1024px) 50vw, 100vw"
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
                        'relative block h-14 w-20 overflow-hidden rounded-btn border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600',
                        i === activeImage ? 'border-primary-600' : 'border-transparent',
                      )}
                    >
                      <Image
                        src={img.url}
                        alt=""
                        fill
                        unoptimized={img.url.startsWith('data:')}
                        sizes="80px"
                        className="object-cover"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Card className="order-3 flex flex-col p-3.5 sm:p-4 lg:order-2">
            <Tabs defaultValue="amenities" className="flex flex-1 flex-col">
              <TabsList
                className="grid w-full grid-cols-4 overflow-hidden sm:flex"
                aria-label="Thông tin chi tiết cơ sở"
              >
                <TabsTrigger value="amenities" className="justify-center px-1.5 text-xs sm:justify-start sm:px-2.5 sm:text-sm">
                  {t('amenities')}
                </TabsTrigger>
                <TabsTrigger value="location" className="justify-center px-1.5 text-xs sm:justify-start sm:px-2.5 sm:text-sm">
                  <span className="sm:hidden">Vị trí</span>
                  <span className="hidden sm:inline">{t('locationTitle')}</span>
                </TabsTrigger>
                <TabsTrigger value="hours" className="justify-center px-1.5 text-xs sm:justify-start sm:px-2.5 sm:text-sm">
                  <span className="sm:hidden">Giờ mở</span>
                  <span className="hidden sm:inline">{t('openingHoursTitle')}</span>
                </TabsTrigger>
                <TabsTrigger value="policy" className="justify-center px-1.5 text-xs sm:justify-start sm:px-2.5 sm:text-sm">
                  <span className="sm:hidden">Cọc & huỷ</span>
                  <span className="hidden sm:inline">{t('policy')}</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="amenities" className="flex-1 pt-3">
                {venue.amenities.length > 0 ? (
                  <ul className="grid grid-cols-2 gap-1.5 sm:gap-2">
                    {venue.amenities.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center gap-1.5 rounded-btn border border-border bg-bg-subtle/60 px-2.5 py-1.5 text-xs text-text-primary sm:gap-2 sm:px-3 sm:py-2 sm:text-sm"
                      >
                        <ShieldCheck className="size-3.5 shrink-0 text-primary-600 sm:size-4" aria-hidden="true" />
                        <span className="line-clamp-2">{a.name}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex items-center gap-2 rounded-btn bg-bg-subtle p-4 text-sm text-text-secondary">
                    <ShieldCheck className="size-4 shrink-0 text-text-disabled" aria-hidden="true" />
                    <span>{t('noAmenities')}</span>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="location" className="flex-1 pt-3">
                {hasCoordinates && typeof venue.lat === 'number' && typeof venue.lng === 'number' ? (
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-neutral-600 sm:text-sm">{t('locationAddress')}</p>
                      <Button asChild variant="outline" size="sm" className="shrink-0">
                        <a href={googleMapsDirectionsUrl} target="_blank" rel="noopener noreferrer">
                          <Navigation className="size-3.5" aria-hidden="true" />
                          {t('getDirections')}
                        </a>
                      </Button>
                    </div>
                    <VenueLocationMapWrapper
                      center={[venue.lat, venue.lng]}
                      marker={[venue.lat, venue.lng]}
                      className="h-52 overflow-hidden rounded-btn border border-neutral-200 sm:h-60"
                    />
                  </div>
                ) : (
                  <div className="space-y-3 rounded-btn bg-bg-subtle p-4 text-sm text-text-secondary">
                    <div className="flex items-start gap-2">
                      <MapPin className="mt-0.5 size-4 shrink-0 text-text-disabled" aria-hidden="true" />
                      <span>{t('noLocationCoords')}</span>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <a href={googleMapsDirectionsUrl} target="_blank" rel="noopener noreferrer">
                        <Navigation className="size-3.5" aria-hidden="true" />
                        {t('openGoogleMaps')}
                      </a>
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="hours" className="flex-1 pt-3">
                <VenueOpeningHours openingHours={venue.openingHours ?? []} hideHeader compact />
              </TabsContent>

              <TabsContent value="policy" className="flex-1 pt-3">
                {venue.cancellationPolicy ? (
                  <div className="space-y-2.5 rounded-btn border border-border bg-bg-subtle/60 p-3.5 text-sm text-neutral-700">
                    <p className="flex items-start gap-2">
                      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary-600" aria-hidden="true" />
                      <span>{t('policyDeposit', { percent: venue.cancellationPolicy.depositPercent })}</span>
                    </p>
                    <p className="flex items-start gap-2">
                      <Clock className="mt-0.5 size-4 shrink-0 text-primary-600" aria-hidden="true" />
                      <span>
                        {t('policyRefund', {
                          hours: venue.cancellationPolicy.cancelBeforeHours,
                          percent: venue.cancellationPolicy.refundPercent,
                        })}
                      </span>
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-btn bg-bg-subtle p-4 text-sm text-text-secondary">
                    <ShieldCheck className="size-4 shrink-0 text-text-disabled" aria-hidden="true" />
                    <span>{t('noPolicy')}</span>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </Card>

          {/* ===== Thông tin tổng quan sân ===== */}
          <section className="order-2 space-y-2 lg:order-3 lg:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">{venue.name}</h1>
              <div className="flex items-center gap-2">
                <VenueCompareButton venue={venue} variant="button" showText />
              </div>
            </div>
            <div className="flex items-start gap-2 text-sm text-neutral-600 sm:text-base">
              <a
                href={googleMapsDirectionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${t('openGoogleMaps')}: ${fullAddress}`}
                title={t('openGoogleMaps')}
                className="relative mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-btn border border-primary-200 bg-primary-50 text-primary-700 transition-colors hover:bg-primary-100 hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 before:absolute before:-inset-2 sm:before:inset-0"
              >
                <MapIcon className="size-4" strokeWidth={1.75} aria-hidden="true" />
              </a>
              <span className="pt-0.5">{fullAddress}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              {(venue.reviewCount ?? 0) > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden="true" />
                  <strong>{(venue.ratingAvg ?? 0).toFixed(1)}</strong>
                  <span className="text-neutral-500">
                    ({formatNumber(venue.reviewCount)} {t('reviews')})
                  </span>
                </span>
              ) : (
                <span className="text-neutral-500">{t('noReviews')}</span>
              )}
              <span className="text-neutral-600">
                {t('fromPrice')}{' '}
                <strong className="text-primary-700">
                  {venue.fromPrice === null ? t('contactForPrice') : formatCurrency(venue.fromPrice)}
                </strong>
                {venue.fromPrice === null ? null : t('perBlock')}
              </span>
              {(venue.sports ?? []).length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {(venue.sports ?? []).map((s) => (
                    <li key={s.id} className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-700">
                      {s.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {venue.description && <p className="text-sm leading-relaxed text-neutral-700">{venue.description}</p>}
          </section>
        </div>

        {/* ===== Khối đặt sân: đặt ở vị trí cao, kéo đặt tiện lợi, block thu gọn ===== */}
        <Card className="space-y-3 p-3 sm:p-4" aria-labelledby="booking-panel-heading">
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h2 id="booking-panel-heading" className="text-lg font-semibold text-neutral-900">
                {t('pickSlot')}
              </h2>
              <span className="text-sm text-neutral-600">{formatDateWithWeekday(date)}</span>
              {dayOperatingHours && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700">
                  <Clock className="size-3.5" aria-hidden="true" />
                  <span>
                    {t('openHours')}: {dayOperatingHours}
                  </span>
                </span>
              )}
            </div>
            <div className="flex min-w-0 items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 px-2 text-xs sm:px-3 sm:text-sm"
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
                className="h-9 min-w-0 flex-1 sm:w-40 sm:flex-none"
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
                className="shrink-0 px-2 text-xs sm:px-3 sm:text-sm"
                onClick={() => {
                  setDate(addDays(date, 1));
                  resetSelection();
                }}
              >
                {t('nextDay')}
              </Button>
            </div>
          </div>

          {activeCourts.length > 1 && (
            <div className="space-y-1.5">
              <p id="court-selector-label" className="text-xs font-medium text-neutral-500">
                {t('courts')} ({activeCourts.length})
              </p>
              <div
                role="radiogroup"
                aria-labelledby="court-selector-label"
                className="flex flex-wrap gap-1.5"
              >
                {activeCourts.map((c) => {
                  const isActive = (courtId ?? activeCourts[0]?.id) === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      onClick={() => {
                        setCourtId(c.id);
                        resetSelection();
                      }}
                      className={cn(
                        'min-h-9 rounded-btn border px-3 py-1.5 text-left text-xs leading-snug transition-colors sm:text-sm',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-1',
                        isActive
                          ? 'border-primary-700 bg-primary-700 font-medium text-white shadow-xs'
                          : 'border-border bg-bg-subtle/60 text-neutral-700 hover:border-primary-300 hover:bg-primary-50/70 hover:text-primary-800',
                      )}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {slotsQuery.isLoading ? (
            <Skeleton className="h-28 w-full" />
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

          <div className="border-t border-border pt-3">
            <BookingBar
              count={selected.length}
              total={total}
              range={selectedRangeText}
              isAuthenticated={isAuthenticated}
              loginHref={loginHref}
              onContinue={onOpenConfirm}
              pending={hold.isPending}
            />
          </div>
        </Card>

        {/* ===== Đánh giá từ khách: để cuối cùng ===== */}
        <ReviewsSection
          summary={summaryQuery.data}
          list={reviewsQuery.data?.data}
          meta={reviewsQuery.data?.meta}
          loading={reviewsQuery.isLoading}
          onPageChange={setReviewPage}
        />
      </div>

      <BookingConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        venueName={venue.name}
        venueAddress={venue.address}
        courtName={selectedCourt?.name ?? 'Sân thi đấu'}
        sportName={selectedSportName}
        date={date}
        timeRange={selectedRangeText}
        slots={pickedSlotItems}
        totalPrice={total}
        cancellationPolicy={venue.cancellationPolicy}
        pending={hold.isPending}
        onConfirm={onConfirmHold}
      />
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
    <main className="container space-y-6 py-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="order-1 aspect-video w-full lg:order-1" />
        <Skeleton className="order-3 h-64 w-full lg:order-2 lg:h-auto" />
        <div className="order-2 space-y-2 lg:order-3 lg:col-span-2">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </div>
      <Skeleton className="h-44 w-full" />
    </main>
  );
}
