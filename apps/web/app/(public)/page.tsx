'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  Circle,
  CircleDashed,
  CircleDot,
  Clock,
  Search,
  ShieldCheck,
  Table2,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAppRouter } from '@/lib/navigation/navigate';

interface PopularSport {
  name: string;
  slug: string;
  icon: LucideIcon;
}

const POPULAR_SPORTS: PopularSport[] = [
  { name: 'Cầu lông', slug: 'cau-long', icon: Activity },
  { name: 'Pickleball', slug: 'pickleball', icon: Table2 },
  { name: 'Bóng đá mini', slug: 'bong-da', icon: CircleDot },
  { name: 'Tennis', slug: 'tennis', icon: Circle },
  { name: 'Bóng rổ', slug: 'bong-ro', icon: CircleDashed },
];

/**
 * Trang chủ BookSportsCourt – Cổng thông tin & tìm sân cho người chơi (docs/01 & docs/09).
 * Thiết kế chuẩn Anti-AI (Linear / Stripe / Vercel style) theo đặc tả SPEC-HOME-003.
 */
export default function HomePage() {
  const tHome = useTranslations('home');
  const router = useAppRouter();
  const [searchQuery, setSearchQuery] = React.useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/venues?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push('/venues');
    }
  };

  return (
    <main className="flex flex-col">
      {/* ── 1. Hero Section: Layout 2 cột bất đối xứng trên lg: (7/5) ──────── */}
      <section className="relative overflow-hidden border-b border-neutral-200 bg-gradient-to-b from-primary-50/50 via-white to-white py-14 sm:py-16 lg:py-20">
        <div className="container">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
            {/* Cột trái: 7 phần – Tiêu đề, mô tả, tìm kiếm và môn thể thao */}
            <div className="flex flex-col items-start text-left lg:col-span-7">
              {/* Badge tin cậy */}
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-100/60 px-3.5 py-1 text-xs font-semibold text-primary-800">
                <ShieldCheck className="size-3.5 shrink-0 text-primary-700" aria-hidden="true" />
                <span>{tHome('heroBadge')}</span>
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl lg:text-5xl lg:leading-tight">
                {tHome('heroTitle')}
              </h1>

              <p className="mt-4 max-w-xl text-base leading-relaxed text-neutral-600 sm:text-lg">
                {tHome('heroSubtitle')}
              </p>

              {/* Ô tìm kiếm nhanh */}
              <form
                onSubmit={handleSearch}
                className="mt-8 flex w-full max-w-xl flex-col gap-2 rounded-card border border-neutral-300 bg-white p-2 shadow-sm focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100 sm:flex-row sm:items-center sm:gap-2"
              >
                <div className="relative flex-1">
                  <Search
                    className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
                    aria-hidden="true"
                  />
                  {/* Nhãn ẩn cho trình đọc màn hình — placeholder không đủ làm tên trường. */}
                  <label htmlFor="home-search-input" className="sr-only">
                    {tHome('searchPlaceholder')}
                  </label>
                  <Input
                    id="home-search-input"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={tHome('searchPlaceholder')}
                    className="border-0 pl-9 pr-3 shadow-none focus-visible:ring-0"
                  />
                </div>
                <Button type="submit" variant="primary" size="md" className="shrink-0">
                  <Search className="size-4" aria-hidden="true" />
                  <span>{tHome('searchButton')}</span>
                </Button>
              </form>

              {/* Danh sách chip môn thể thao căn trái */}
              <div className="mt-6 flex flex-wrap items-center justify-start gap-2">
                <span className="text-xs font-medium text-neutral-500">
                  {tHome('popularSports')}:
                </span>
                {POPULAR_SPORTS.map((sport) => {
                  const Icon = sport.icon;
                  return (
                    <Link
                      key={sport.slug}
                      href={`/venues?sport=${sport.slug}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-700 transition-colors duration-150 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-1"
                    >
                      <Icon
                        className="size-3.5 shrink-0 text-primary-700"
                        aria-hidden="true"
                        strokeWidth={1.5}
                      />
                      <span>{sport.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Cột phải: 5 phần – Live Visual Preview Card mô phỏng cơ sở thể thao */}
            <aside
              aria-label={tHome('heroPreviewTitle')}
              className="hidden lg:col-span-5 lg:block"
            >
              <div className="rounded-card border border-neutral-200 bg-white p-6 shadow-card">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                    </span>
                    <span className="text-xs font-semibold text-neutral-900">
                      {tHome('heroPreviewTitle')}
                    </span>
                  </div>
                  <span className="rounded bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-700">
                    {tHome('heroPreviewHold')}
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50/60 p-3">
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-semibold text-neutral-900">
                        {tHome('heroPreviewVenueName')}
                      </span>
                      <span className="text-[11px] text-neutral-500">
                        {tHome('heroPreviewSlot1')}
                      </span>
                    </div>
                    <span className="tabular-nums text-xs font-bold text-primary-700">
                      120.000 ₫
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50/60 p-3">
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-semibold text-neutral-900">
                        {tHome('heroPreviewVenueName')}
                      </span>
                      <span className="text-[11px] text-neutral-500">
                        {tHome('heroPreviewSlot2')}
                      </span>
                    </div>
                    <span className="tabular-nums text-xs font-bold text-primary-700">
                      140.000 ₫
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50/60 p-3">
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-semibold text-neutral-900">
                        {tHome('heroPreviewVenueName')}
                      </span>
                      <span className="text-[11px] text-neutral-500">
                        {tHome('heroPreviewSlot3')}
                      </span>
                    </div>
                    <span className="tabular-nums text-xs font-bold text-primary-700">
                      140.000 ₫
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-1.5 pt-2 text-[11px] text-neutral-500">
                  <Clock className="size-3 text-neutral-400" aria-hidden="true" />
                  <span>{tHome('heroPreviewStatus')}</span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ── 2. Lý do chọn nền tảng: Header căn trái, 3 Card căn trái ──────── */}
      <section className="border-b border-neutral-200 bg-white py-14 md:py-20">
        <div className="container">
          <div className="mb-10 max-w-2xl text-left">
            <h2 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
              {tHome('whyTitle')}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              {tHome('whySubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <Card className="border border-neutral-200 bg-white transition-all duration-150 hover:border-primary-200 hover:shadow-card">
              <CardContent className="flex flex-col items-start p-6 text-left">
                <div className="mb-4 flex size-11 items-center justify-center rounded-lg border border-primary-100/60 bg-primary-50 text-primary-700">
                  <Zap className="size-5" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-semibold tracking-tight text-neutral-900">
                  {tHome('whyRealtimeTitle')}
                </h3>
                <p className="mt-2 text-left text-sm leading-relaxed text-neutral-600">
                  {tHome('whyRealtimeDesc')}
                </p>
              </CardContent>
            </Card>

            <Card className="border border-neutral-200 bg-white transition-all duration-150 hover:border-primary-200 hover:shadow-card">
              <CardContent className="flex flex-col items-start p-6 text-left">
                <div className="mb-4 flex size-11 items-center justify-center rounded-lg border border-primary-100/60 bg-primary-50 text-primary-700">
                  <Clock className="size-5" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-semibold tracking-tight text-neutral-900">
                  {tHome('whyHoldTitle')}
                </h3>
                <p className="mt-2 text-left text-sm leading-relaxed text-neutral-600">
                  {tHome('whyHoldDesc')}
                </p>
              </CardContent>
            </Card>

            <Card className="border border-neutral-200 bg-white transition-all duration-150 hover:border-primary-200 hover:shadow-card">
              <CardContent className="flex flex-col items-start p-6 text-left">
                <div className="mb-4 flex size-11 items-center justify-center rounded-lg border border-primary-100/60 bg-primary-50 text-primary-700">
                  <ShieldCheck className="size-5" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-semibold tracking-tight text-neutral-900">
                  {tHome('whyVerifiedTitle')}
                </h3>
                <p className="mt-2 text-left text-sm leading-relaxed text-neutral-600">
                  {tHome('whyVerifiedDesc')}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ── 3. Số liệu thống kê: căn trái + tabular-nums + divider ─────────── */}
      <section className="border-b border-neutral-200 bg-neutral-50 py-12 md:py-16">
        <div className="container">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            <div className="flex flex-col items-start text-left">
              <div className="tabular-nums text-3xl font-extrabold tracking-tight text-primary-700 sm:text-4xl">
                500+
              </div>
              <span className="mt-1 text-sm font-medium text-neutral-600">
                {tHome('statsVenues')}
              </span>
            </div>
            <div className="flex flex-col items-start border-t border-neutral-200 pt-6 text-left sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0">
              <div className="tabular-nums text-3xl font-extrabold tracking-tight text-primary-700 sm:text-4xl">
                25.000+
              </div>
              <span className="mt-1 text-sm font-medium text-neutral-600">
                {tHome('statsBookings')}
              </span>
            </div>
            <div className="flex flex-col items-start border-t border-neutral-200 pt-6 text-left sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0">
              <div className="tabular-nums text-3xl font-extrabold tracking-tight text-primary-700 sm:text-4xl">
                15.000+
              </div>
              <span className="mt-1 text-sm font-medium text-neutral-600">
                {tHome('statsCustomers')}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Kêu gọi hợp tác chủ sân: Banner 2 cột ngang trên md: ─────────── */}
      <section className="bg-primary-800 py-14 text-white md:py-16">
        <div className="container">
          <div className="flex flex-col gap-8 text-left md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
                {tHome('ctaTitle')}
              </h2>
              <p className="mt-3 text-base leading-relaxed text-primary-100">
                {tHome('ctaDesc')}
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <Button variant="secondary" size="lg" asChild className="font-semibold shadow-sm">
                <Link href="/owner/apply">
                  <span>{tHome('ctaRegisterOwner')}</span>
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white active:bg-white/20"
              >
                <Link href="/owner/timeline">{tHome('ctaExploreOwner')}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
