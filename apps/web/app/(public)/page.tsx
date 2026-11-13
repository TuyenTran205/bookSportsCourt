'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { VenueListItem } from '@bsc/shared';
import {
  Activity,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleDashed,
  CircleDot,
  Clock,
  ImageOff,
  MapPin,
  QrCode,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Table2,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { listVenues } from '@/lib/api/endpoints/venues';
import { useAppRouter } from '@/lib/navigation/navigate';
import { formatCurrency } from '@/lib/utils/format';

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

interface ShowcaseCourt {
  id: string;
  slug: string | null;
  name: string;
  sport: string;
  location: string;
  rating: number | null;
  fromPrice: number | null;
  imageUrl: string | null;
}

/** Dữ liệu dự phòng chỉ dùng khi API chưa trả kết quả hoặc chưa có cơ sở trong DB. */
const FALLBACK_SHOWCASE_COURTS: ShowcaseCourt[] = [
  {
    id: 'fallback-1',
    slug: null,
    name: 'CLB Cầu Lông Cầu Giấy VIP',
    sport: 'Cầu lông',
    location: 'Cầu Giấy, Hà Nội',
    rating: 4.9,
    fromPrice: 120000,
    imageUrl:
      'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'fallback-2',
    slug: null,
    name: 'Sân Pickleball Thảo Điền Pro',
    sport: 'Pickleball',
    location: 'TP. Thủ Đức, TP.HCM',
    rating: 5.0,
    fromPrice: 150000,
    imageUrl:
      'https://images.unsplash.com/photo-1599474924187-334a4ae5bd3c?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'fallback-3',
    slug: null,
    name: 'Sân Bóng Đá Mini Nam Sài Gòn',
    sport: 'Bóng đá mini',
    location: 'Quận 7, TP.HCM',
    rating: 4.8,
    fromPrice: 180000,
    imageUrl:
      'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'fallback-4',
    slug: null,
    name: 'Trung Tâm Tennis Đất Nện Mỹ Đình',
    sport: 'Tennis',
    location: 'Nam Từ Liêm, Hà Nội',
    rating: 4.9,
    fromPrice: 200000,
    imageUrl:
      'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'fallback-5',
    slug: null,
    name: 'Khu Phức Hợp Thể Thao Sông Hàn',
    sport: 'Bóng rổ & Cầu lông',
    location: 'Hải Châu, Đà Nẵng',
    rating: 4.9,
    fromPrice: 100000,
    imageUrl:
      'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'fallback-6',
    slug: null,
    name: 'Sân Cầu Lông Đỉnh Cao Ba Đình',
    sport: 'Cầu lông',
    location: 'Ba Đình, Hà Nội',
    rating: 4.8,
    fromPrice: 110000,
    imageUrl:
      'https://images.unsplash.com/photo-1521537634581-0dced2fee2ef?w=600&auto=format&fit=crop&q=80',
  },
];

/** Trộn ngẫu nhiên mảng theo Fisher-Yates (chỉ gọi sau khi mount để tránh mismatch SSR). */
function shuffleItems<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j]!;
    arr[j] = tmp!;
  }
  return arr;
}

function formatVenueLocation(venue: VenueListItem): string {
  const area = venue.ward?.name ?? venue.district?.name;
  if (area && venue.province?.name) return `${area}, ${venue.province.name}`;
  return venue.province?.name ?? venue.address;
}

/**
 * Hiệu ứng đếm số tăng dần mượt mà khi cuộn tới vị trí hiển thị (IntersectionObserver + requestAnimationFrame).
 */
function AnimatedCounter({
  end,
  suffix = '+',
  duration = 1500,
}: {
  end: number;
  suffix?: string;
  duration?: number;
}) {
  const [count, setCount] = React.useState(0);
  const elementRef = React.useRef<HTMLSpanElement>(null);
  const hasAnimated = React.useRef(false);

  React.useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      setCount(end);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const startTime = performance.now();

          const updateCount = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // easeOutCubic: 1 - (1 - t)^3
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentCount = Math.floor(easeOut * end);
            setCount(currentCount);

            if (progress < 1) {
              requestAnimationFrame(updateCount);
            } else {
              setCount(end);
            }
          };

          requestAnimationFrame(updateCount);
        }
      },
      { threshold: 0.15 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [end, duration]);

  return (
    <span ref={elementRef} className="tabular-nums">
      {count.toLocaleString('vi-VN')}
      {suffix}
    </span>
  );
}

/**
 * Trang chủ BookSportsCourt – Cổng thông tin & tìm sân cho người chơi (docs/01 & docs/09).
 * Thiết kế chuẩn Anti-AI (Linear / Stripe / Vercel style) theo đặc tả SPEC-HOME-003.
 */
export default function HomePage() {
  const tHome = useTranslations('home');
  const router = useAppRouter();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [realVenues, setRealVenues] = React.useState<VenueListItem[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    const loadVenues = async () => {
      try {
        const res = await listVenues({ limit: 100 });
        if (!cancelled && Array.isArray(res?.data) && res.data.length > 0) {
          setRealVenues(shuffleItems(res.data));
        }
      } catch {
        // Giữ dữ liệu dự phòng nếu API chưa kết nối hoặc trong môi trường test
      }
    };
    void loadVenues();
    return () => {
      cancelled = true;
    };
  }, []);

  const heroPreviewVenues = React.useMemo(() => realVenues.slice(0, 3), [realVenues]);

  const marqueeHalf = React.useMemo<ShowcaseCourt[]>(() => {
    if (realVenues.length === 0) {
      return FALLBACK_SHOWCASE_COURTS;
    }
    const items: ShowcaseCourt[] = realVenues.map((venue) => ({
      id: venue.id,
      slug: venue.slug,
      name: venue.name,
      sport:
        venue.sports.length > 0
          ? venue.sports
              .slice(0, 2)
              .map((s) => s.name)
              .join(' · ')
          : tHome('popularSportsLabel'),
      location: formatVenueLocation(venue),
      rating: (venue.reviewCount ?? 0) > 0 ? venue.ratingAvg : null,
      fromPrice: venue.fromPrice,
      imageUrl: venue.coverUrl,
    }));

    // Lặp tối thiểu lên 6 thẻ mỗi nửa để băng chuyền luôn kín bề rộng màn hình 1920px+;
    // khi DB có >= 6 sân thực thì giữ nguyên đúng toàn bộ số sân thực trả về.
    const filled = [...items];
    while (filled.length < 6) {
      filled.push(...items);
    }
    return filled;
  }, [realVenues, tHome]);

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
      {/* ── 1. Hero Section: Chiếm trọn khung nhìn đầu tiên (Above The Fold) kèm Background Tech-Sports & Ambient Glow ──────── */}
      <section className="relative flex min-h-[calc(100vh-4rem)] flex-col justify-between overflow-hidden border-b border-border bg-gradient-to-b from-primary-100/50 via-primary-50/20 to-bg py-10 lg:py-14 dark:from-primary-950/40 dark:via-bg dark:to-bg">
        {/* Lớp nền lưới sân thể thao chìm (Court Grid Pattern) */}
        <div
          className="pointer-events-none absolute inset-0 z-0 opacity-[0.06] dark:opacity-[0.04]"
          aria-hidden="true"
        >
          <svg className="size-full" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="court-grid-pattern" width="56" height="56" patternUnits="userSpaceOnUse">
                <path d="M 56 0 L 0 0 0 56" fill="none" stroke="currentColor" strokeWidth="1" />
                <circle cx="28" cy="28" r="1.5" fill="currentColor" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#court-grid-pattern)" />
          </svg>
        </div>

        {/* Đốm sáng Ambient Glow Orbs thở chậm tạo chiều sâu không gian */}
        <div
          className="pointer-events-none absolute -left-28 -top-28 size-96 rounded-full bg-primary-400/25 blur-3xl filter dark:bg-primary-600/15"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-20 top-16 size-80 rounded-full bg-teal-400/20 blur-3xl filter dark:bg-teal-600/15"
          aria-hidden="true"
        />

        <div className="container relative z-10 my-auto">
          <div className="mx-auto grid max-w-[1440px] grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12 xl:gap-16 2xl:gap-20">
            {/* Cột trái: 7 phần – Tiêu đề, mô tả, tìm kiếm và môn thể thao */}
            <div className="flex min-w-0 flex-col items-start text-left lg:col-span-7">
              {/* Badge tin cậy */}
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-100/70 px-4 py-1.5 text-xs font-semibold text-primary-800 shadow-xs sm:text-sm dark:border-primary-900/50 dark:bg-primary-950/40 dark:text-primary-300">
                <ShieldCheck className="size-4 shrink-0 text-primary-700 dark:text-primary-400" aria-hidden="true" />
                <span>{tHome('heroBadge')}</span>
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight text-text-primary sm:text-5xl lg:text-[3.5rem] xl:text-[3.875rem] 2xl:text-[4.25rem] lg:leading-[1.12]">
                {tHome('heroTitle')}
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-relaxed text-text-secondary sm:text-lg lg:text-xl xl:max-w-3xl 2xl:text-[1.3rem] lg:leading-relaxed">
                {tHome('heroSubtitle')}
              </p>

              {/* Ô tìm kiếm nhanh */}
              <form
                onSubmit={handleSearch}
                className="mt-8 flex w-full max-w-2xl flex-col gap-2.5 rounded-2xl border border-border/90 bg-bg-card p-2.5 shadow-md shadow-primary-950/5 transition-all focus-within:border-primary-500 focus-within:ring-4 focus-within:ring-primary-100/80 sm:flex-row sm:items-center sm:gap-2 sm:p-2.5 xl:max-w-3xl"
              >
                <div className="relative flex-1">
                  <Search
                    className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-text-disabled"
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
                    className="h-12 border-0 pl-11 pr-3 text-sm shadow-none focus-visible:ring-0 sm:text-base xl:h-14"
                  />
                </div>
                <Button type="submit" variant="primary" size="lg" className="h-12 shrink-0 px-7 text-sm font-semibold shadow-xs sm:text-base xl:h-14 xl:px-8">
                  <Search className="size-4" aria-hidden="true" />
                  <span>{tHome('searchButton')}</span>
                </Button>
              </form>

              {/* Danh sách chip môn thể thao căn trái */}
              <div className="mt-7 flex w-full max-w-full flex-nowrap items-center justify-start gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0 2xl:gap-2.5">
                <span className="shrink-0 whitespace-nowrap text-xs font-medium text-text-secondary 2xl:text-sm">
                  {tHome('popularSports')}:
                </span>
                {POPULAR_SPORTS.map((sport) => {
                  const Icon = sport.icon;
                  return (
                    <Link
                      key={sport.slug}
                      href={`/venues?sport=${sport.slug}`}
                      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-bg-card px-3 py-1.5 text-xs font-medium text-text-primary shadow-2xs transition-colors duration-150 hover:border-primary-400 hover:bg-bg-subtle hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-1 2xl:gap-2 2xl:px-3.5 2xl:text-sm dark:hover:text-primary-300"
                    >
                      <Icon
                        className="size-4 shrink-0 text-primary-700 dark:text-primary-400"
                        aria-hidden="true"
                        strokeWidth={1.75}
                      />
                      <span>{sport.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Cột phải: 5 phần – Live Visual Preview Card mô phỏng cơ sở thể thao với hiệu ứng Glassmorphism */}
            <aside
              aria-label={tHome('heroPreviewTitle')}
              className="hidden lg:col-span-5 lg:block"
            >
              <div className="relative w-full max-w-[560px] rounded-2xl border border-primary-200/80 bg-bg-card/95 p-7 shadow-2xl shadow-primary-950/10 backdrop-blur-md lg:ml-auto lg:p-8 xl:p-9 dark:border-primary-900/50 dark:bg-neutral-900/90">
                <div className="flex items-center justify-between border-b border-border/70 pb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex size-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
                    </span>
                    <span className="text-sm font-bold text-text-primary">
                      {tHome('heroPreviewTitle')}
                    </span>
                  </div>
                  <span className="rounded-md bg-primary-100/80 px-2.5 py-1 text-xs font-semibold text-primary-800 dark:bg-primary-950/60 dark:text-primary-300">
                    {tHome('heroPreviewHold')}
                  </span>
                </div>

                <div className="mt-5 space-y-3.5">
                  {heroPreviewVenues.length > 0 ? (
                    heroPreviewVenues.map((venue) => {
                      const sportsLabel = venue.sports
                        .slice(0, 2)
                        .map((s) => s.name)
                        .join(', ');
                      const areaLabel = formatVenueLocation(venue);
                      const subtitle = [sportsLabel, areaLabel].filter(Boolean).join(' · ');

                      return (
                        <Link
                          key={venue.id}
                          href={`/venues/${venue.slug}`}
                          className="flex items-center justify-between gap-3 rounded-xl border border-neutral-100 bg-neutral-50/80 p-3.5 transition-colors hover:border-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 sm:p-4 dark:border-neutral-800 dark:bg-neutral-800/50"
                        >
                          <div className="flex min-w-0 flex-col text-left">
                            <span className="truncate text-sm font-bold text-neutral-900 dark:text-neutral-100">
                              {venue.name}
                            </span>
                            <span className="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">
                              {subtitle}
                            </span>
                          </div>
                          <span className="shrink-0 tabular-nums text-sm font-extrabold text-primary-700 sm:text-base dark:text-primary-400">
                            {venue.fromPrice === null ? 'Liên hệ' : formatCurrency(venue.fromPrice)}
                          </span>
                        </Link>
                      );
                    })
                  ) : (
                    <>
                      <div className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50/80 p-3.5 transition-colors hover:border-primary-300 sm:p-4 dark:border-neutral-800 dark:bg-neutral-800/50">
                        <div className="flex flex-col text-left">
                          <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                            {tHome('heroPreviewVenueName')}
                          </span>
                          <span className="text-xs text-neutral-500 dark:text-neutral-400">
                            {tHome('heroPreviewSlot1')}
                          </span>
                        </div>
                        <span className="tabular-nums text-sm font-extrabold text-primary-700 sm:text-base dark:text-primary-400">
                          120.000 ₫
                        </span>
                      </div>

                      <div className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50/80 p-3.5 transition-colors hover:border-primary-300 sm:p-4 dark:border-neutral-800 dark:bg-neutral-800/50">
                        <div className="flex flex-col text-left">
                          <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                            {tHome('heroPreviewVenueName')}
                          </span>
                          <span className="text-xs text-neutral-500 dark:text-neutral-400">
                            {tHome('heroPreviewSlot2')}
                          </span>
                        </div>
                        <span className="tabular-nums text-sm font-extrabold text-primary-700 sm:text-base dark:text-primary-400">
                          140.000 ₫
                        </span>
                      </div>

                      <div className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50/80 p-3.5 transition-colors hover:border-primary-300 sm:p-4 dark:border-neutral-800 dark:bg-neutral-800/50">
                        <div className="flex flex-col text-left">
                          <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                            {tHome('heroPreviewVenueName')}
                          </span>
                          <span className="text-xs text-neutral-500 dark:text-neutral-400">
                            {tHome('heroPreviewSlot3')}
                          </span>
                        </div>
                        <span className="tabular-nums text-sm font-extrabold text-primary-700 sm:text-base dark:text-primary-400">
                          140.000 ₫
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-5 flex items-center gap-2 pt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  <Clock className="size-3.5 text-neutral-400" aria-hidden="true" />
                  <span>{tHome('heroPreviewStatus')}</span>
                </div>
              </div>
            </aside>
          </div>
        </div>

        {/* Chỉ báo cuộn trang trực quan (Scroll Indicator) */}
        <div className="container relative z-10 flex justify-center pb-4 pt-2">
          <div className="inline-flex items-center gap-2.5 text-text-secondary/75 transition-colors hover:text-text-primary">
            <span className="flex size-8 items-center justify-center rounded-full border border-border/80 bg-bg-card text-primary-600 shadow-xs animate-bounce dark:text-primary-400">
              <ChevronDown className="size-4.5" aria-hidden="true" />
            </span>
            <span className="text-xs font-medium tracking-wide sm:text-sm">
              {tHome('scrollDown')}
            </span>
          </div>
        </div>
      </section>

      {/* ── 2. Lý do chọn nền tảng: Header căn giữa, 3 Card cân đối ──────── */}
      <section className="border-b border-border bg-bg-subtle py-14 md:py-20">
        <div className="container">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl xl:text-4xl">
              {tHome('whyTitle')}
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-text-secondary sm:text-base">
              {tHome('whySubtitle')}
            </p>
          </div>

          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 md:grid-cols-3 xl:gap-8">
            <Card className="border border-border bg-bg-card transition-all duration-150 hover:border-primary-300 hover:shadow-card">
              <CardContent className="flex flex-col items-center p-6 text-center xl:p-8">
                <div className="mb-4 flex size-11 items-center justify-center rounded-lg border border-primary-100/60 bg-primary-50 text-primary-700 dark:border-primary-900/50 dark:bg-primary-950/40 dark:text-primary-300">
                  <Zap className="size-5" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-semibold tracking-tight text-text-primary">
                  {tHome('whyRealtimeTitle')}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                  {tHome('whyRealtimeDesc')}
                </p>
              </CardContent>
            </Card>

            <Card className="border border-border bg-bg-card transition-all duration-150 hover:border-primary-300 hover:shadow-card">
              <CardContent className="flex flex-col items-center p-6 text-center xl:p-8">
                <div className="mb-4 flex size-11 items-center justify-center rounded-lg border border-primary-100/60 bg-primary-50 text-primary-700 dark:border-primary-900/50 dark:bg-primary-950/40 dark:text-primary-300">
                  <Clock className="size-5" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-semibold tracking-tight text-text-primary">
                  {tHome('whyHoldTitle')}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                  {tHome('whyHoldDesc')}
                </p>
              </CardContent>
            </Card>

            <Card className="border border-border bg-bg-card transition-all duration-150 hover:border-primary-300 hover:shadow-card">
              <CardContent className="flex flex-col items-center p-6 text-center xl:p-8">
                <div className="mb-4 flex size-11 items-center justify-center rounded-lg border border-primary-100/60 bg-primary-50 text-primary-700 dark:border-primary-900/50 dark:bg-primary-950/40 dark:text-primary-300">
                  <ShieldCheck className="size-5" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-semibold tracking-tight text-text-primary">
                  {tHome('whyVerifiedTitle')}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                  {tHome('whyVerifiedDesc')}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ── 3. Băng chuyền hình ảnh sân thực chạy ngang liên tục (Infinite Horizontal Marquee) ──────── */}
      <section className="relative overflow-hidden border-b border-border bg-bg py-12 md:py-16">
        <div className="container mb-8">
          <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <div className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 dark:text-primary-400">
              <Sparkles className="size-3.5" aria-hidden="true" />
              <span>{tHome('marqueeBadge')}</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-text-primary sm:text-2xl xl:text-3xl">
              {tHome('marqueeHeading')}
            </h2>
            <p className="mt-1.5 text-xs text-text-secondary sm:text-sm xl:text-base">
              {tHome('marqueeSubtitle')}
            </p>
          </div>
        </div>

        {/* Băng chuyền vô tận với hiệu ứng làm mờ 2 mép siêu mượt (mask-image + gradient fade) */}
        <div className="relative w-full overflow-hidden bsc-marquee-mask">
          {/* Lớp gradient mờ nhẹ ở 2 bên mép tạo chiều sâu không gian */}
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 sm:w-28 lg:w-40 bg-gradient-to-r from-bg via-bg/40 to-transparent dark:from-bg dark:via-bg/40"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 sm:w-28 lg:w-40 bg-gradient-to-l from-bg via-bg/40 to-transparent dark:from-bg dark:via-bg/40"
            aria-hidden="true"
          />

          <div
            className="animate-bsc-marquee gap-5 py-2 xl:gap-6"
            style={{ animationDuration: `${Math.max(30, marqueeHalf.length * 5)}s` }}
          >
            {[...marqueeHalf, ...marqueeHalf].map((court, idx) => {
              const cardBody = (
                <>
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                    {court.imageUrl ? (
                      <Image
                        src={court.imageUrl}
                        alt={court.name}
                        width={600}
                        height={375}
                        unoptimized
                        className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center bg-bg-subtle">
                        <ImageOff className="size-8 text-text-disabled" aria-hidden="true" />
                      </div>
                    )}
                    {/* Lớp phủ gradient mờ nhẹ trên ảnh giúp text/badge nổi bật, không bị thô */}
                    <div
                      className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-black/25 opacity-80 transition-opacity duration-300 group-hover:opacity-90"
                      aria-hidden="true"
                    />
                    <span className="absolute left-2.5 top-2.5 rounded-full border border-white/10 bg-black/50 px-2.5 py-0.5 text-[11px] font-medium text-white shadow-xs backdrop-blur-md">
                      {court.sport}
                    </span>
                    {court.rating !== null ? (
                      <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-full border border-black/5 bg-white/95 px-2.5 py-0.5 text-[11px] font-bold text-neutral-900 shadow-md backdrop-blur-md dark:border-white/10 dark:bg-neutral-900/90 dark:text-neutral-100">
                        <Star className="size-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                        <span>{court.rating.toFixed(1)}</span>
                      </div>
                    ) : court.fromPrice !== null ? (
                      <div className="absolute bottom-2.5 right-2.5 rounded-full border border-black/5 bg-white/95 px-2.5 py-0.5 text-[11px] font-bold text-primary-700 shadow-md backdrop-blur-md dark:border-white/10 dark:bg-neutral-900/90 dark:text-primary-400">
                        {formatCurrency(court.fromPrice)}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-col p-3.5 text-left">
                    <h3 className="truncate text-sm font-semibold text-text-primary transition-colors group-hover:text-primary-700 dark:group-hover:text-primary-400">
                      {court.name}
                    </h3>
                    <div className="mt-1 flex items-center gap-1 text-xs text-text-secondary">
                      <MapPin className="size-3 shrink-0 text-primary-600 dark:text-primary-400" aria-hidden="true" />
                      <span className="truncate">{court.location}</span>
                    </div>
                  </div>
                </>
              );

              const cardClass =
                'group flex w-[260px] shrink-0 flex-col overflow-hidden rounded-2xl border border-border/80 bg-bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary-400 hover:shadow-lg hover:shadow-primary-950/5 sm:w-[300px] xl:w-[340px]';

              return court.slug ? (
                <Link
                  key={`${court.id}-${idx}`}
                  href={`/venues/${court.slug}`}
                  className={cardClass}
                >
                  {cardBody}
                </Link>
              ) : (
                <div key={`${court.id}-${idx}`} className={cardClass}>
                  {cardBody}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 4. Số liệu thống kê: Căn giữa cân xứng 3 cột + tabular-nums + divider ─────────── */}
      <section className="border-b border-border bg-bg-subtle py-12 md:py-16">
        <div className="container">
          <div className="mx-auto grid max-w-6xl grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="flex flex-col items-center py-6 text-center sm:px-8 sm:py-2">
              <div className="tabular-nums text-4xl font-extrabold tracking-tight text-primary-700 dark:text-primary-400 sm:text-5xl">
                <AnimatedCounter end={500} suffix="+" />
              </div>
              <span className="mt-2 text-sm font-medium text-text-secondary sm:text-base">
                {tHome('statsVenues')}
              </span>
            </div>
            <div className="flex flex-col items-center py-6 text-center sm:px-8 sm:py-2">
              <div className="tabular-nums text-4xl font-extrabold tracking-tight text-primary-700 dark:text-primary-400 sm:text-5xl">
                <AnimatedCounter end={25000} suffix="+" />
              </div>
              <span className="mt-2 text-sm font-medium text-text-secondary sm:text-base">
                {tHome('statsBookings')}
              </span>
            </div>
            <div className="flex flex-col items-center py-6 text-center sm:px-8 sm:py-2">
              <div className="tabular-nums text-4xl font-extrabold tracking-tight text-primary-700 dark:text-primary-400 sm:text-5xl">
                <AnimatedCounter end={15000} suffix="+" />
              </div>
              <span className="mt-2 text-sm font-medium text-text-secondary sm:text-base">
                {tHome('statsCustomers')}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. Kêu gọi hành động: Trải nghiệm đặt sân thông minh cho người chơi & Kết nối đối tác chủ sân ─────────── */}
      <section className="relative overflow-hidden border-t border-primary-800/40 bg-gradient-to-br from-neutral-950 via-primary-950 to-emerald-950 py-16 text-white md:py-24">
        {/* Lớp nền lưới sân thể thao chìm */}
        <div
          className="pointer-events-none absolute inset-0 z-0 opacity-[0.04]"
          aria-hidden="true"
        >
          <svg className="size-full" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="bottom-court-pattern" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="1" />
                <circle cx="30" cy="30" r="1.5" fill="currentColor" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#bottom-court-pattern)" />
          </svg>
        </div>

        {/* Ánh sáng cực quang thể thao chuyển động nhẹ */}
        <div
          className="pointer-events-none absolute -right-24 -top-24 size-[28rem] rounded-full bg-emerald-500/20 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-28 -left-28 size-[26rem] rounded-full bg-teal-500/20 blur-3xl"
          aria-hidden="true"
        />

        <div className="container relative z-10">
          {/* Khối chính (Grid 12 cột): Người chơi là trọng tâm (7 cột) + Mockup ứng dụng động (5 cột) */}
          <div className="mx-auto grid max-w-[1440px] grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
            {/* Cột trái: 7 phần – Tiêu đề, 3 bước hành động nhanh và nút Đặt sân ngay */}
            <div className="flex flex-col items-start text-left lg:col-span-7">
              {/* Badge trải nghiệm người chơi */}
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-4 py-1.5 text-xs font-semibold text-emerald-300 backdrop-blur-sm sm:text-sm">
                <Sparkles className="size-4 text-emerald-400" aria-hidden="true" />
                <span>{tHome('ctaPlayerBadge')}</span>
              </div>

              <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl lg:leading-tight">
                {tHome('ctaPlayerTitle')}
              </h2>

              <p className="mt-4 max-w-2xl text-base leading-relaxed text-emerald-100/90 sm:text-lg">
                {tHome('ctaPlayerDesc')}
              </p>

              {/* 3 bước đặt sân trực quan */}
              <div className="mt-8 grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="flex flex-col items-start rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-xs transition-colors hover:bg-white/10">
                  <div className="mb-2 flex size-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                    <Clock className="size-4" aria-hidden="true" />
                  </div>
                  <span className="text-sm font-bold text-white">
                    {tHome('ctaStep1Title')}
                  </span>
                  <span className="mt-1 text-xs text-emerald-200/70">
                    {tHome('ctaStep1Desc')}
                  </span>
                </div>

                <div className="flex flex-col items-start rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-xs transition-colors hover:bg-white/10">
                  <div className="mb-2 flex size-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                    <ShieldCheck className="size-4" aria-hidden="true" />
                  </div>
                  <span className="text-sm font-bold text-white">
                    {tHome('ctaStep2Title')}
                  </span>
                  <span className="mt-1 text-xs text-emerald-200/70">
                    {tHome('ctaStep2Desc')}
                  </span>
                </div>

                <div className="flex flex-col items-start rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-xs transition-colors hover:bg-white/10">
                  <div className="mb-2 flex size-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                    <QrCode className="size-4" aria-hidden="true" />
                  </div>
                  <span className="text-sm font-bold text-white">
                    {tHome('ctaStep3Title')}
                  </span>
                  <span className="mt-1 text-xs text-emerald-200/70">
                    {tHome('ctaStep3Desc')}
                  </span>
                </div>
              </div>

              {/* Nút hành động chính của người chơi */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Button
                  variant="secondary"
                  size="lg"
                  asChild
                  className="group h-12 bg-white px-8 text-base font-bold text-neutral-950 shadow-xl shadow-black/30 hover:bg-emerald-50 hover:text-neutral-950 active:bg-neutral-100 sm:h-14 dark:bg-white dark:text-neutral-950"
                >
                  <Link href="/venues">
                    <span>{tHome('ctaPlayerAction')}</span>
                    <ArrowRight
                      className="size-5 transition-transform duration-200 group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </Link>
                </Button>
              </div>
            </div>

            {/* Cột phải: 5 phần – Interactive Floating Smartphone Booking Mockup */}
            <div className="flex justify-center lg:col-span-5">
              <div className="relative w-full max-w-[340px] rounded-[2.5rem] border-4 border-neutral-700/60 bg-gradient-to-b from-neutral-900 via-neutral-950 to-neutral-900 p-5 shadow-2xl shadow-emerald-950/40 ring-1 ring-white/15 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/40">
                {/* Notch / Dynamic Island */}
                <div className="mx-auto mb-4 flex h-4 w-28 items-center justify-center rounded-full bg-neutral-800/80">
                  <div className="mr-2 size-2 rounded-full bg-neutral-950" />
                  <div className="h-1.5 w-6 rounded-full bg-neutral-900" />
                </div>

                {/* Header app mô phỏng */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex size-6 items-center justify-center rounded-md bg-emerald-500/30 text-emerald-400">
                      <Zap className="size-3.5" aria-hidden="true" />
                    </div>
                    <span className="text-xs font-bold tracking-tight text-white">BookSportsCourt</span>
                  </div>
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                    Live Booking
                  </span>
                </div>

                {/* Thẻ trạng thái thành công */}
                <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-left">
                  <div className="flex items-center gap-2.5">
                    <div className="relative flex size-6 shrink-0 items-center justify-center">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                      <CheckCircle2 className="relative size-5 text-emerald-400" aria-hidden="true" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">
                        {tHome('mockupBookingSuccess')}
                      </h4>
                      <span className="font-mono text-[10px] text-emerald-300/80">
                        {tHome('mockupCode')}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3.5 space-y-1.5 rounded-xl border border-white/5 bg-neutral-900/80 p-3">
                    <div className="truncate text-xs font-semibold text-white">
                      {realVenues[0]?.name ?? tHome('mockupVenue')}
                    </div>
                    <div className="text-[11px] text-neutral-300">
                      {tHome('mockupCourt')}
                    </div>
                    <div className="flex items-center gap-1.5 pt-1 text-[11px] font-medium text-emerald-400">
                      <Clock className="size-3" aria-hidden="true" />
                      <span>{tHome('mockupTime')}</span>
                    </div>
                  </div>

                  {/* Đếm ngược giữ chỗ */}
                  <div className="mt-3 flex items-center justify-between pt-1">
                    <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                      {tHome('mockupPaid')}
                    </span>
                    <span className="tabular-nums text-[11px] font-semibold text-amber-300">
                      {tHome('mockupHoldCountdown')}
                    </span>
                  </div>
                </div>

                {/* 2 nút mini tương tác của mockup */}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 py-2 text-[11px] font-medium text-neutral-200 transition-colors hover:bg-white/10">
                    <MapPin className="size-3 text-emerald-400" aria-hidden="true" />
                    <span>{tHome('mockupDirections')}</span>
                  </div>
                  <div className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 py-2 text-[11px] font-medium text-neutral-200 transition-colors hover:bg-white/10">
                    <Share2 className="size-3 text-teal-400" aria-hidden="true" />
                    <span>{tHome('mockupShare')}</span>
                  </div>
                </div>

                {/* Home Indicator Bar */}
                <div className="mx-auto mt-4 h-1 w-24 rounded-full bg-neutral-700/80" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. Kêu gọi hợp tác chủ sân: Nền lưới sân thể thao chìm như các thẻ/section ở trên ─────────── */}
      <section className="relative overflow-hidden border-t border-border bg-gradient-to-b from-primary-50/40 via-bg to-bg-subtle/50 py-14 sm:py-16 md:py-20 dark:from-primary-950/20 dark:via-bg dark:to-bg">
        {/* Lớp nền lưới sân thể thao chìm (Court Grid Pattern) như Hero và các thẻ ở trên */}
        <div
          className="pointer-events-none absolute inset-0 z-0 opacity-[0.06] dark:opacity-[0.04]"
          aria-hidden="true"
        >
          <svg className="size-full" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="owner-court-grid-pattern" width="56" height="56" patternUnits="userSpaceOnUse">
                <path d="M 56 0 L 0 0 0 56" fill="none" stroke="currentColor" strokeWidth="1" />
                <circle cx="28" cy="28" r="1.5" fill="currentColor" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#owner-court-grid-pattern)" />
          </svg>
        </div>

        {/* Đốm sáng Ambient Glow nhẹ nhàng */}
        <div
          className="pointer-events-none absolute -left-20 top-1/2 size-80 -translate-y-1/2 rounded-full bg-primary-200/30 blur-3xl filter dark:bg-primary-900/15"
          aria-hidden="true"
        />

        <div className="container relative z-10">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-8 text-left md:flex-row md:items-center md:justify-between md:gap-12">
            <div className="max-w-3xl">
              {/* Badge đối tác chữ xanh */}
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-100/70 px-4 py-1.5 text-xs font-semibold text-primary-800 shadow-2xs sm:text-sm dark:border-primary-900/50 dark:bg-primary-950/40 dark:text-primary-300">
                <Building2 className="size-4 shrink-0 text-primary-700 dark:text-primary-400" aria-hidden="true" />
                <span>{tHome('ctaBadge')}</span>
              </div>

              <h2 className="text-3xl font-extrabold tracking-tight text-text-primary sm:text-4xl md:text-5xl">
                {tHome('ctaTitle')}
              </h2>
              <p className="mt-3.5 max-w-3xl text-base leading-relaxed text-text-secondary sm:text-lg">
                {tHome('ctaDesc')}
              </p>

              {/* 3 đặc quyền chủ sân: Icon xanh */}
              <div className="mt-6 flex flex-wrap items-center gap-y-2.5 gap-x-6 text-xs font-medium text-text-secondary sm:text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4.5 text-primary-600 dark:text-primary-400" aria-hidden="true" />
                  <span>{tHome('ctaHighlight1')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4.5 text-primary-600 dark:text-primary-400" aria-hidden="true" />
                  <span>{tHome('ctaHighlight2')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="size-4.5 text-primary-600 dark:text-primary-400" aria-hidden="true" />
                  <span>{tHome('ctaHighlight3')}</span>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-3.5 sm:flex-row">
              <Button
                variant="primary"
                size="lg"
                asChild
                className="group h-12 px-7 text-sm font-semibold shadow-sm sm:text-base"
              >
                <Link href="/owner/apply">
                  <span>{tHome('ctaRegisterOwner')}</span>
                  <ArrowRight
                    className="size-4.5 transition-transform duration-200 group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="h-12 border-primary-300 bg-transparent px-7 text-sm font-semibold text-primary-800 hover:bg-primary-50 hover:text-primary-900 sm:text-base dark:border-primary-700/60 dark:text-primary-200 dark:hover:bg-primary-950/40"
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
