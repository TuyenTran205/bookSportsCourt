import type { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro, Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { SiteChrome } from '@/components/layout/SiteChrome';
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
  themeColor: '#16a34a',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const messages = await getMessages();

  return (
    <html lang="vi" className={`${beVietnamPro.variable} ${inter.variable}`}>
      <body className="flex min-h-screen flex-col font-sans">
        <NextIntlClientProvider messages={messages}>
          {/* MockProvider chờ MSW sẵn sàng rồi mới render app, tránh việc
              component gọi API trước khi service worker kịp chặn request. */}
          <MockProvider>
            <Providers>
              <SiteChrome>{children}</SiteChrome>
            </Providers>
          </MockProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
