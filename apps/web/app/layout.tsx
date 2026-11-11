import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { Be_Vietnam_Pro, Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { SiteChrome } from '@/components/layout/SiteChrome';
import { NavigationProgress } from '@/components/layout/NavigationProgress';
import { MockProvider } from '@/components/common/MockProvider';
import { Providers } from './providers';
import './globals.css';

/**
 * docs/07 mục 4: `Be Vietnam Pro` là font chính, `Inter` là fallback.
 * Nạp cả hai qua `next/font` để tối ưu CLS; thứ tự trong `--font-sans` quyết
 * định font nào thắng, nên fallback đứng sau.
 */
const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-be-vietnam-pro',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'BookSportsCourt – Đặt sân thể thao online',
    template: '%s | BookSportsCourt',
  },
  description:
    'Đặt sân cầu lông, bóng đá, pickleball, tennis online. Xem lịch trống theo thời gian thực, giữ chỗ 10 phút, thanh toán chuyển khoản.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#16a34a' },
    { media: '(prefers-color-scheme: dark)', color: '#121214' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const messages = await getMessages();

  return (
    <html lang="vi" className={`${beVietnamPro.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('bsc-theme-mode');var d=t==='dark'||(!t||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches;if(d){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){}})();`,
          }}
        />
        {/*
          Zero-Flicker Splash – chạy đồng bộ trong <head> TRƯỚC lần paint đầu tiên.
          sessionStorage chỉ đọc được ở browser, nên nếu chờ React hydrate mới quyết
          định thì SSR HTML (Header, Banner, danh sách sân) đã bị vẽ ra trước và người
          dùng thấy chớp giật. Script gắn `bsc-splash-active` lên <html> để CSS trong
          globals.css ẩn ngay nội dung trang khách. `SplashBrandReveal` gỡ class khi
          bắt đầu fade-out. Xem docs/specs/web-splash-welcome-screen-spec.md.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var r=document.documentElement;try{var shown=sessionStorage.getItem('bsc_welcome_splash_shown');var q=new URLSearchParams(window.location.search);var forced=q.get('splash')==='force'||q.get('welcome')==='1';if(!forced&&shown==='true'){r.classList.remove('bsc-splash-active');return;}r.classList.add('bsc-splash-active');setTimeout(function(){r.classList.remove('bsc-splash-active');},8000);}catch(e){r.classList.remove('bsc-splash-active');}})();`,
          }}
        />
        {/* Tối ưu kết nối trước đến các CDN Tile của Bản đồ (Ưu tiên Esri mặc định) */}
        <link rel="preconnect" href="https://server.arcgisonline.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://a.tile.openstreetmap.fr" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://tile.opentopomap.org" />
        <link rel="dns-prefetch" href="https://a.basemaps.cartocdn.com" />
      </head>
      <body className="flex min-h-screen flex-col font-sans">
        <NextIntlClientProvider messages={messages}>
          {/* MockProvider chờ MSW sẵn sàng rồi mới render app, tránh việc
              component gọi API trước khi service worker kịp chặn request. */}
          <MockProvider>
            <Providers>
              {/* Một instance duy nhất ở root (E14). Bọc Suspense vì
                  NavigationProgress đọc usePathname — boundary này giữ
                  toàn bộ layout ở chế độ static shell. */}
              <Suspense fallback={null}>
                <NavigationProgress />
              </Suspense>
              <SiteChrome>{children}</SiteChrome>
            </Providers>
          </MockProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
