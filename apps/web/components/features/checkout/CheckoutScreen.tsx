'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
  Timer,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { ErrorState } from '@/components/common/ErrorState';
import { CheckoutPaymentSection } from '@/components/features/checkout/CheckoutPaymentSection';
import { CheckoutProofUploader } from '@/components/features/checkout/CheckoutProofUploader';
import { CheckoutSummary } from '@/components/features/checkout/CheckoutSummary';
import { HoldCountdown } from '@/components/features/booking/HoldCountdown';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  bookingKeys,
  useBookingDetail,
  useHoldInfo,
} from '@/lib/hooks/useBookings';
import { useAppRouter } from '@/lib/navigation/navigate';

export function CheckoutScreen() {
  const t = useTranslations('checkout');
  const { holdId } = useParams<{ holdId: string }>();
  const router = useAppRouter();
  const queryClient = useQueryClient();

  const bookingQuery = useBookingDetail(holdId);
  const booking = bookingQuery.data;

  const isHeld = booking?.status === 'held';
  const holdQuery = useHoldInfo(holdId, isHeld);

  const [isExpiredLocal, setIsExpiredLocal] = React.useState(false);

  // Tự động chuyển hướng nếu đơn đã được xác nhận
  React.useEffect(() => {
    if (booking?.status === 'confirmed') {
      const timer = window.setTimeout(() => {
        router.push(`/bookings/${booking.id}`);
      }, 1500);
      return () => window.clearTimeout(timer);
    }
  }, [booking?.status, booking?.id, router]);

  // Loading skeleton
  if (bookingQuery.isLoading) {
    return <CheckoutSkeleton />;
  }

  // Error state
  if (bookingQuery.isError || !booking) {
    return (
      <main className="container max-w-4xl py-12">
        <ErrorState
          error={bookingQuery.error ?? 'Không tìm thấy thông tin đơn giữ chỗ.'}
          onRetry={() => bookingQuery.refetch()}
        />
      </main>
    );
  }

  const { court } = booking;
  const isExpired = isExpiredLocal || booking.status === 'expired';

  // 1. Trạng thái hết hạn giữ chỗ
  if (isExpired) {
    return (
      <main className="container max-w-2xl py-12">
        <Card className="space-y-6 p-8 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-danger/10 text-danger">
            <Timer className="size-8" aria-hidden="true" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
              {t('expiredTitle')}
            </h1>
            <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
              {t('expiredDesc')}
            </p>
          </div>

          <div className="rounded-btn border border-border bg-bg-subtle p-4 text-left text-xs text-text-secondary">
            <p className="font-semibold text-text-primary">
              {court.venue.name} · {court.name}
            </p>
            <p className="mt-1 text-neutral-500">Mã đơn giữ chỗ: {booking.id}</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button asChild variant="primary">
              <Link href={`/venues/${court.venue.slug}`}>
                <ArrowLeft className="size-4" aria-hidden="true" />
                <span>{t('reselectSlot')}</span>
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/venues">
                <span>{t('findOtherVenues')}</span>
              </Link>
            </Button>
          </div>
        </Card>
      </main>
    );
  }

  // 2. Trạng thái đã gửi biên lai, đang chờ duyệt
  if (booking.status === 'pending_payment') {
    return (
      <main className="container max-w-2xl py-12">
        <Card className="space-y-6 p-8 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Clock className="size-8" aria-hidden="true" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
              {t('pendingTitle')}
            </h1>
            <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
              {t('pendingDesc')}
            </p>
          </div>

          <div className="flex justify-center pt-2">
            <Button asChild variant="primary">
              <Link href={`/bookings/${booking.id}`}>
                <ExternalLink className="size-4" aria-hidden="true" />
                <span>{t('viewBookingDetail')}</span>
              </Link>
            </Button>
          </div>
        </Card>
      </main>
    );
  }

  // 3. Trạng thái đã xác nhận thành công
  if (booking.status === 'confirmed') {
    return (
      <main className="container max-w-2xl py-12">
        <Card className="space-y-6 p-8 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-400">
            <CheckCircle2 className="size-8" aria-hidden="true" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
              Đơn đặt sân đã được xác nhận
            </h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Chuyển hướng sang trang chi tiết đơn đặt sân...
            </p>
          </div>

          <div className="flex justify-center pt-2">
            <Button asChild variant="primary">
              <Link href={`/bookings/${booking.id}`}>
                <span>{t('viewBookingDetail')}</span>
              </Link>
            </Button>
          </div>
        </Card>
      </main>
    );
  }

  // 4. Màn hình Checkout chính thức (status === 'held')
  return (
    <main className="container max-w-6xl space-y-6 py-6 pb-24 lg:py-8">
      {/* Breadcrumb điều hướng */}
      <nav aria-label="breadcrumb" className="text-xs text-neutral-600 dark:text-neutral-400">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-primary-700 hover:underline">
              Trang chủ
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/venues" className="hover:text-primary-700 hover:underline">
              Tìm sân
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href={`/venues/${court.venue.slug}`}
              className="hover:text-primary-700 hover:underline"
            >
              {court.venue.name}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="font-semibold text-neutral-900 dark:text-white">
            {t('breadcrumb')}
          </li>
        </ol>
      </nav>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl dark:text-white">
          {t('title')}
        </h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {t('subtitle')}
        </p>
      </div>

      {/* Lưới 2 cột: Tóm tắt đơn (Trái) & Thanh toán VietQR + Upload (Phải) */}
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        {/* Cột trái: Tóm tắt đơn giữ chỗ */}
        <section aria-labelledby="checkout-summary-heading" className="lg:col-span-5">
          <h2 id="checkout-summary-heading" className="sr-only">
            {t('orderSummary')}
          </h2>
          <CheckoutSummary booking={booking} />
        </section>

        {/* Cột phải: Đồng hồ đếm ngược, mã VietQR, thông tin ngân hàng & tải minh chứng */}
        <section aria-labelledby="checkout-payment-heading" className="space-y-6 lg:col-span-7">
          <h2 id="checkout-payment-heading" className="sr-only">
            {t('transferInfoTitle')}
          </h2>

          {/* Thanh đếm ngược thời gian giữ chỗ */}
          {booking.expiresAt && (
            <HoldCountdown
              expiresAt={booking.expiresAt}
              onExpire={() => {
                setIsExpiredLocal(true);
                void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
              }}
              className="border border-border bg-bg-card shadow-xs text-text-primary"
            />
          )}

          {/* Khối thanh toán VietQR & thông tin ngân hàng */}
          {holdQuery.data ? (
            <CheckoutPaymentSection payment={holdQuery.data.payment} />
          ) : (
            <Skeleton className="h-64 w-full rounded-card" />
          )}

          {/* Khối tải ảnh minh chứng chuyển khoản */}
          <CheckoutProofUploader
            bookingId={booking.id}
            onSuccess={() => {
              void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
              window.setTimeout(() => {
                router.push(`/bookings/${booking.id}`);
              }, 1200);
            }}
          />
        </section>
      </div>
    </main>
  );
}

function CheckoutSkeleton() {
  return (
    <main className="container max-w-6xl space-y-6 py-8">
      <Skeleton className="h-4 w-64" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-5">
          <Skeleton className="h-80 w-full rounded-card" />
        </div>
        <div className="space-y-6 lg:col-span-7">
          <Skeleton className="h-14 w-full rounded-input" />
          <Skeleton className="h-72 w-full rounded-card" />
          <Skeleton className="h-44 w-full rounded-card" />
        </div>
      </div>
    </main>
  );
}
