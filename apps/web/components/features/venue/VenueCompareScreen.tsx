'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeftRight,
  Building2,
  CheckCircle2,
  ExternalLink,
  MapPin,
  Plus,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MAX_COMPARE_VENUES, useVenueComparison } from '@/lib/hooks/useVenueComparison';
import { cn } from '@/lib/utils/cn';
import { formatCurrency, formatNumber } from '@/lib/utils/format';

export function VenueCompareScreen() {
  const t = useTranslations('compare');
  const { venues, count, removeVenue, clearVenues } = useVenueComparison();

  // Xác định giá thấp nhất để gắn nhãn "Giá tốt nhất". Bỏ qua cơ sở chưa có giá.
  const lowestPrice = React.useMemo(() => {
    const prices = venues.map((v) => v.fromPrice).filter((p): p is number => p !== null);
    if (prices.length === 0) return 0;
    return Math.min(...prices);
  }, [venues]);

  // 1. Trạng thái rỗng: chưa chọn cơ sở nào
  if (count === 0) {
    return (
      <main className="container max-w-4xl py-16">
        <EmptyState
          icon={ArrowLeftRight}
          title={t('emptyTitle')}
          description={t('emptyDesc')}
          action={
            <Button asChild variant="primary">
              <Link href="/venues">{t('exploreVenues')}</Link>
            </Button>
          }
        />
      </main>
    );
  }

  // 2. Trạng thái chỉ có 1 cơ sở: hiển thị cảnh báo cần thêm cơ sở
  if (count === 1) {
    const singleVenue = venues[0]!;
    return (
      <main className="container max-w-4xl space-y-6 py-8">
        <nav aria-label="breadcrumb" className="text-xs text-neutral-600 dark:text-neutral-400">
          <ol className="flex items-center gap-1.5">
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
            <li className="font-semibold text-neutral-900 dark:text-white">{t('title')}</li>
          </ol>
        </nav>

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl dark:text-white">
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{t('subtitle')}</p>
        </div>

        <div
          role="alert"
          className="flex items-center gap-2 rounded-btn border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <span>{t('oneVenueWarning')}</span>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Card cơ sở hiện tại */}
          <Card className="relative overflow-hidden p-4">
            <button
              type="button"
              onClick={() => removeVenue(singleVenue.id)}
              aria-label={t('removeVenueAria', { name: singleVenue.name })}
              className="absolute right-3 top-3 z-10 inline-flex size-8 items-center justify-center rounded-full bg-white/90 text-neutral-500 shadow-xs hover:bg-neutral-100 hover:text-danger dark:bg-neutral-800 dark:text-neutral-300"
            >
              <X className="size-4" aria-hidden="true" />
            </button>

            <div className="relative aspect-video w-full overflow-hidden rounded-md bg-neutral-100 dark:bg-neutral-800">
              {singleVenue.coverUrl ? (
                <Image
                  src={singleVenue.coverUrl}
                  alt={singleVenue.name}
                  fill
                  unoptimized={singleVenue.coverUrl.startsWith('data:')}
                  className="object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-neutral-400">
                  <Building2 className="size-8" aria-hidden="true" />
                </div>
              )}
            </div>

            <div className="mt-3 space-y-2">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                {singleVenue.name}
              </h3>
              <p className="flex items-start gap-1 text-xs text-neutral-600 dark:text-neutral-400">
                <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span className="line-clamp-1">{singleVenue.address}</span>
              </p>
              <p className="text-sm font-semibold text-primary-700 dark:text-primary-300">
                {t('fromPrice')}: {singleVenue.fromPrice === null ? 'Liên hệ' : formatCurrency(singleVenue.fromPrice)}
              </p>
            </div>
          </Card>

          {/* Ô trống lớn thêm cơ sở */}
          <Link
            href="/venues"
            className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed border-border p-6 text-center transition-colors hover:border-primary-500 hover:bg-bg-subtle text-text-primary"
          >
            <div className="flex size-12 items-center justify-center rounded-full bg-bg-subtle text-text-secondary">
              <Plus className="size-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                {t('addMore')}
              </p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {t('selectMoreVenues')}
              </p>
            </div>
          </Link>
        </div>
      </main>
    );
  }

  // 3. Trạng thái đủ điều kiện so sánh (count >= 2)
  return (
    <main className="container max-w-7xl space-y-6 py-6 pb-24 lg:py-8">
      {/* Breadcrumb điều hướng */}
      <nav aria-label="breadcrumb" className="text-xs text-neutral-600 dark:text-neutral-400">
        <ol className="flex items-center gap-1.5">
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
          <li className="font-semibold text-neutral-900 dark:text-white">{t('title')}</li>
        </ol>
      </nav>

      {/* Header trang so sánh */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-4 dark:border-neutral-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl dark:text-white">
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{t('subtitle')}</p>
        </div>

        <div className="flex items-center gap-2">
          {count < MAX_COMPARE_VENUES && (
            <Button asChild variant="outline" size="sm">
              <Link href="/venues">
                <Plus className="size-4" aria-hidden="true" />
                <span>{t('addMore')}</span>
              </Link>
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearVenues}
            className="text-xs text-neutral-500 hover:text-danger dark:text-neutral-400"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            <span>{t('clearAll')}</span>
          </Button>
        </div>
      </div>

      {/* Ma trận so sánh dạng bảng */}
      <div className="overflow-x-auto rounded-card border border-border bg-bg-card shadow-xs text-text-primary">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            {/* Hàng 1: Cơ sở Header & Ảnh */}
            <tr className="border-b border-border bg-bg-subtle text-text-primary">
              <th
                scope="col"
                className="w-40 sm:w-56 p-4 align-top font-bold text-neutral-900 dark:text-white"
              >
                {t('criteriaHeader')}
              </th>
              {venues.map((venue) => (
                <th
                  key={venue.id}
                  scope="col"
                  className="min-w-[240px] sm:min-w-[280px] p-4 align-top"
                >
                  <div className="space-y-3">
                    <div className="relative aspect-video w-full overflow-hidden rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800">
                      {venue.coverUrl ? (
                        <Image
                          src={venue.coverUrl}
                          alt={venue.name}
                          fill
                          unoptimized={venue.coverUrl.startsWith('data:')}
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center text-neutral-400">
                          <Building2 className="size-8" aria-hidden="true" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeVenue(venue.id)}
                        aria-label={t('removeVenueAria', { name: venue.name })}
                        className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-danger"
                      >
                        <X className="size-3.5" aria-hidden="true" />
                      </button>
                    </div>

                    <div>
                      <h2 className="line-clamp-2 text-base font-bold text-neutral-900 dark:text-white">
                        {venue.name}
                      </h2>
                    </div>

                    <Button asChild variant="primary" size="sm" className="w-full text-xs">
                      <Link href={`/venues/${venue.slug}`}>{t('bookNow')}</Link>
                    </Button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {/* Hàng 2: Môn thể thao */}
            <tr>
              <th
                scope="row"
                className="bg-neutral-50/30 p-4 font-semibold text-neutral-700 dark:bg-neutral-800/20 dark:text-neutral-300"
              >
                {t('sports')}
              </th>
              {venues.map((venue) => (
                <td key={venue.id} className="p-4 align-top">
                  <div className="flex flex-wrap gap-1.5">
                    {venue.sports.length > 0 ? (
                      venue.sports.map((sport) => (
                        <span
                          key={sport.id}
                          className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                        >
                          {sport.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-neutral-400">—</span>
                    )}
                  </div>
                </td>
              ))}
            </tr>

            {/* Hàng 3: Bảng giá thuê */}
            <tr>
              <th
                scope="row"
                className="bg-neutral-50/30 p-4 font-semibold text-neutral-700 dark:bg-neutral-800/20 dark:text-neutral-300"
              >
                {t('fromPrice')}
              </th>
              {venues.map((venue) => {
                const isBestPrice = venue.fromPrice === lowestPrice && lowestPrice > 0;
                return (
                  <td key={venue.id} className="p-4 align-top">
                    <div className="space-y-1">
                      <p className="text-base font-bold text-primary-700 dark:text-primary-300">
                        {venue.fromPrice === null ? 'Liên hệ' : formatCurrency(venue.fromPrice)}
                        <span className="text-xs font-normal text-neutral-500 dark:text-neutral-400">
                          {' '}
                          / 30 phút
                        </span>
                      </p>
                      {isBestPrice && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-700 dark:bg-primary-950/60 dark:text-primary-300">
                          <CheckCircle2 className="size-3" aria-hidden="true" />
                          <span>{t('bestPriceBadge')}</span>
                        </span>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* Hàng 4: Đánh giá & Uy tín */}
            <tr>
              <th
                scope="row"
                className="bg-neutral-50/30 p-4 font-semibold text-neutral-700 dark:bg-neutral-800/20 dark:text-neutral-300"
              >
                {t('rating')}
              </th>
              {venues.map((venue) => (
                <td key={venue.id} className="p-4 align-top">
                  {venue.reviewCount > 0 ? (
                    <div className="flex items-center gap-1.5 text-sm">
                      <Star
                        className="size-4 fill-amber-400 text-amber-400"
                        aria-hidden="true"
                      />
                      <span className="font-bold text-neutral-900 dark:text-white">
                        {venue.ratingAvg.toFixed(1)}
                      </span>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        ({formatNumber(venue.reviewCount)} đánh giá)
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-neutral-400">Chưa có đánh giá</span>
                  )}
                </td>
              ))}
            </tr>

            {/* Hàng 5: Vị trí & Khu vực */}
            <tr>
              <th
                scope="row"
                className="bg-neutral-50/30 p-4 font-semibold text-neutral-700 dark:bg-neutral-800/20 dark:text-neutral-300"
              >
                {t('location')}
              </th>
              {venues.map((venue) => (
                <td key={venue.id} className="p-4 align-top">
                  <div className="space-y-1">
                    {(venue.districtName || venue.provinceName) && (
                      <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                        {[venue.districtName, venue.provinceName].filter(Boolean).join(', ')}
                      </p>
                    )}
                    <p className="flex items-start gap-1 text-xs text-neutral-600 dark:text-neutral-400">
                      <MapPin className="mt-0.5 size-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
                      <span>{venue.address}</span>
                    </p>
                  </div>
                </td>
              ))}
            </tr>

            {/* Hàng 6: Thao tác cuối */}
            <tr>
              <th
                scope="row"
                className="bg-neutral-50/30 p-4 font-semibold text-neutral-700 dark:bg-neutral-800/20 dark:text-neutral-300"
              >
                {t('actions')}
              </th>
              {venues.map((venue) => (
                <td key={venue.id} className="p-4 align-top">
                  <div className="flex flex-col gap-2">
                    <Button asChild variant="primary" size="sm" className="w-full text-xs">
                      <Link href={`/venues/${venue.slug}`}>{t('bookNow')}</Link>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="w-full text-xs">
                      <Link href={`/venues/${venue.slug}`}>
                        <ExternalLink className="size-3.5" aria-hidden="true" />
                        <span>{t('viewDetail')}</span>
                      </Link>
                    </Button>
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  );
}
