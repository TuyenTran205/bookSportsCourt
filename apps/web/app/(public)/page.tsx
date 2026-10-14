'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const POPULAR_SPORTS = [
  { name: 'Cầu lông', slug: 'cau-long', icon: '🏸' },
  { name: 'Pickleball', slug: 'pickleball', icon: '🏓' },
  { name: 'Bóng đá mini', slug: 'bong-da', icon: '⚽' },
  { name: 'Tennis', slug: 'tennis', icon: '🎾' },
  { name: 'Bóng rổ', slug: 'bong-ro', icon: '🏀' },
];

/**
 * Trang chủ BookSportsCourt – Cổng thông tin & tìm sân cho người chơi (docs/01 & docs/09).
 */
export default function HomePage() {
  const tHome = useTranslations('home');
  const router = useRouter();
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
      {/* ── 1. Hero Section ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-neutral-200 bg-gradient-to-b from-primary-50/60 via-white to-white py-16 md:py-24">
        <div className="container flex flex-col items-center text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-100/60 px-3.5 py-1 text-xs font-semibold text-primary-800">
            <Sparkles className="size-3.5" aria-hidden="true" />
            <span>Nền tảng đặt sân thể thao hàng đầu Việt Nam</span>
          </div>

          <h1 className="max-w-3xl text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl md:text-5xl lg:text-6xl">
            {tHome('heroTitle')}
          </h1>

          <p className="mt-4 max-w-2xl text-base text-neutral-600 sm:text-lg">
            {tHome('heroSubtitle')}
          </p>

          {/* Ô tìm kiếm nhanh */}
          <form
            onSubmit={handleSearch}
            className="mt-8 flex w-full max-w-xl flex-col gap-2 rounded-card border border-neutral-300 bg-white p-2 shadow-card sm:flex-row sm:items-center sm:gap-2"
          >
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
                aria-hidden="true"
              />
              <Input
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

          {/* Môn thể thao phổ biến */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs font-medium text-neutral-500">{tHome('popularSports')}:</span>
            {POPULAR_SPORTS.map((sport) => (
              <Link
                key={sport.slug}
                href={`/venues?sport=${sport.slug}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-700 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-800"
              >
                <span>{sport.icon}</span>
                <span>{sport.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── 2. Lý do chọn nền tảng ────────────────────────────────────────── */}
      <section className="border-b border-neutral-200 bg-white py-14 md:py-20">
        <div className="container">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold text-neutral-900 sm:text-3xl">{tHome('whyTitle')}</h2>
            <p className="mt-2 text-sm text-neutral-500">
              Công nghệ tiên tiến giúp quy trình đặt sân mượt mà, minh bạch và chính xác tuyệt đối.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <Card className="border border-neutral-200 transition-all hover:border-primary-200 hover:shadow-card">
              <CardContent className="flex flex-col items-center p-6 text-center">
                <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                  <Zap className="size-6" />
                </div>
                <h3 className="text-lg font-semibold text-neutral-900">{tHome('whyRealtimeTitle')}</h3>
                <p className="mt-2 text-sm text-neutral-500">{tHome('whyRealtimeDesc')}</p>
              </CardContent>
            </Card>

            <Card className="border border-neutral-200 transition-all hover:border-primary-200 hover:shadow-card">
              <CardContent className="flex flex-col items-center p-6 text-center">
                <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                  <Clock className="size-6" />
                </div>
                <h3 className="text-lg font-semibold text-neutral-900">{tHome('whyHoldTitle')}</h3>
                <p className="mt-2 text-sm text-neutral-500">{tHome('whyHoldDesc')}</p>
              </CardContent>
            </Card>

            <Card className="border border-neutral-200 transition-all hover:border-primary-200 hover:shadow-card">
              <CardContent className="flex flex-col items-center p-6 text-center">
                <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                  <ShieldCheck className="size-6" />
                </div>
                <h3 className="text-lg font-semibold text-neutral-900">{tHome('whyVerifiedTitle')}</h3>
                <p className="mt-2 text-sm text-neutral-500">{tHome('whyVerifiedDesc')}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ── 3. Số liệu thống kê ───────────────────────────────────────────── */}
      <section className="border-b border-neutral-200 bg-neutral-50 py-12 md:py-16">
        <div className="container">
          <div className="grid grid-cols-1 gap-8 text-center sm:grid-cols-3">
            <div className="flex flex-col items-center">
              <div className="text-3xl font-extrabold text-primary-700 sm:text-4xl">500+</div>
              <span className="mt-1 text-sm font-medium text-neutral-600">{tHome('statsVenues')}</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-3xl font-extrabold text-primary-700 sm:text-4xl">25.000+</div>
              <span className="mt-1 text-sm font-medium text-neutral-600">{tHome('statsBookings')}</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-3xl font-extrabold text-primary-700 sm:text-4xl">15.000+</div>
              <span className="mt-1 text-sm font-medium text-neutral-600">{tHome('statsCustomers')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Kêu gọi hợp tác chủ sân ─────────────────────────────────────── */}
      <section className="bg-primary-800 py-16 text-white md:py-20">
        <div className="container flex flex-col items-center text-center">
          <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl">
            Bạn là chủ sân thể thao?
          </h2>
          <p className="mt-4 max-w-xl text-base text-primary-100">
            Gia nhập mạng lưới BookSportsCourt để tiếp cận hàng ngàn người chơi, tối ưu công suất lấp đầy
            và quản lý lịch đặt sân dễ dàng với chi phí 0đ.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Button variant="secondary" size="lg" asChild>
              <Link href="/profile">Đăng ký mở cơ sở ngay</Link>
            </Button>
            <Button variant="outline" size="lg" asChild className="border-white/30 text-white hover:bg-white/10">
              <Link href="/owner/timeline">Xem thử kênh quản lý</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
