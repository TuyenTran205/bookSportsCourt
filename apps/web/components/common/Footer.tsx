'use client';

import Link from 'next/link';
import {
  Calendar,
  Facebook,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Youtube,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Footer – Chân trang chuẩn dùng chung toàn hệ thống (docs/07-design-system.md).
 * Áp dụng Phương án B: Tone Xám phẳng (bg-bg-subtle) đồng bộ với Section 2 và Section 4.
 */
export function Footer() {
  const t = useTranslations('footer');
  const tCommon = useTranslations('common');

  return (
    <footer className="border-t border-border bg-bg-subtle text-text-secondary">
      <div className="container py-12 md:py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-5">
          {/* Cột 1 & 2: Thương hiệu & giới thiệu */}
          <div className="flex flex-col gap-4 lg:col-span-2">
            <Link
              href="/"
              className="flex items-center gap-2.5 text-lg font-bold text-text-primary transition-opacity hover:opacity-90"
            >
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary-700 text-white shadow-xs">
                <Calendar className="size-5" />
              </div>
              <span className="tracking-tight text-text-primary">{tCommon('appName')}</span>
            </Link>
            <p className="max-w-md text-sm leading-relaxed text-text-secondary">
              {t('brandDescription')}
            </p>
            <div className="flex flex-col gap-2.5 pt-1 text-xs text-text-secondary">
              <div className="flex items-center gap-2">
                <MapPin className="size-3.5 shrink-0 text-text-disabled" />
                <span>{t('location')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="size-3.5 shrink-0 text-text-disabled" />
                <a
                  href="tel:19000000"
                  className="transition-colors hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2"
                >
                  {t('hotline')}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="size-3.5 shrink-0 text-text-disabled" />
                <a
                  href="mailto:support@booksportscourt.vn"
                  className="transition-colors hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2"
                >
                  {t('support')}
                </a>
              </div>
            </div>
          </div>

          {/* Cột 3: Dành cho người chơi */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold tracking-wide text-text-primary">
              {t('customerHeading')}
            </h3>
            <ul className="flex flex-col gap-2 text-sm text-text-secondary">
              <li>
                <Link
                  href="/venues"
                  className="transition-colors hover:text-primary-600 dark:hover:text-primary-400"
                >
                  {t('findVenues')}
                </Link>
              </li>
              <li>
                <Link
                  href="/bookings"
                  className="transition-colors hover:text-primary-600 dark:hover:text-primary-400"
                >
                  {t('myBookings')}
                </Link>
              </li>
              <li>
                <Link
                  href="/favorites"
                  className="transition-colors hover:text-primary-600 dark:hover:text-primary-400"
                >
                  {t('favorites')}
                </Link>
              </li>
              <li>
                <Link
                  href="/info/booking-guide"
                  className="transition-colors hover:text-primary-600 dark:hover:text-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2"
                >
                  {t('bookingGuide')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Cột 4: Dành cho chủ sân */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold tracking-wide text-text-primary">
              {t('ownerHeading')}
            </h3>
            <ul className="flex flex-col gap-2 text-sm text-text-secondary">
              <li>
                <Link
                  href="/owner/timeline"
                  className="transition-colors hover:text-primary-600 dark:hover:text-primary-400"
                >
                  {t('ownerTimeline')}
                </Link>
              </li>
              <li>
                <Link
                  href="/owner/apply"
                  className="transition-colors hover:text-primary-600 dark:hover:text-primary-400"
                >
                  {t('ownerApply')}
                </Link>
              </li>
              <li>
                <Link
                  href="/owner/payments"
                  className="transition-colors hover:text-primary-600 dark:hover:text-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2"
                >
                  {t('paymentProcess')}
                </Link>
              </li>
              <li>
                <Link
                  href="/info/partner-policy"
                  className="transition-colors hover:text-primary-600 dark:hover:text-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2"
                >
                  {t('partnerPolicy')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Cột 5: Quy định & Chính sách */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold tracking-wide text-text-primary">
              {t('policyHeading')}
            </h3>
            <ul className="flex flex-col gap-2 text-sm text-text-secondary">
              <li>
                <Link
                  href="/info/terms"
                  className="transition-colors hover:text-primary-600 dark:hover:text-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2"
                >
                  {t('terms')}
                </Link>
              </li>
              <li>
                <Link
                  href="/info/privacy"
                  className="transition-colors hover:text-primary-600 dark:hover:text-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2"
                >
                  {t('privacy')}
                </Link>
              </li>
              <li>
                <Link
                  href="/info/cancellation-policy"
                  className="transition-colors hover:text-primary-600 dark:hover:text-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2"
                >
                  {t('cancellationPolicy')}
                </Link>
              </li>
              <li>
                <Link
                  href="/info/operating-regulations"
                  className="transition-colors hover:text-primary-600 dark:hover:text-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2"
                >
                  {t('operatingRegulations')}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Dòng chân trang */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 text-xs text-text-disabled sm:flex-row">
          <p>{t('copyright')}</p>
          <div className="flex items-center gap-2.5">
            <span className="mr-1 text-text-secondary">{t('socialConnect')}:</span>
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook BookSportsCourt"
              className="flex size-7 items-center justify-center rounded-full border border-border bg-bg-card text-text-secondary transition-all hover:border-primary-500 hover:bg-primary-50 hover:text-primary-700 dark:hover:bg-primary-950/40 dark:hover:text-primary-400"
            >
              <Facebook className="size-3.5" />
            </a>
            <a
              href="https://youtube.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="YouTube BookSportsCourt"
              className="flex size-7 items-center justify-center rounded-full border border-border bg-bg-card text-text-secondary transition-all hover:border-primary-500 hover:bg-primary-50 hover:text-primary-700 dark:hover:bg-primary-950/40 dark:hover:text-primary-400"
            >
              <Youtube className="size-3.5" />
            </a>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram BookSportsCourt"
              className="flex size-7 items-center justify-center rounded-full border border-border bg-bg-card text-text-secondary transition-all hover:border-primary-500 hover:bg-primary-50 hover:text-primary-700 dark:hover:bg-primary-950/40 dark:hover:text-primary-400"
            >
              <Instagram className="size-3.5" />
            </a>
            <a
              href="https://zalo.me"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Zalo Hỗ trợ BookSportsCourt"
              className="flex size-7 items-center justify-center rounded-full border border-border bg-bg-card text-text-secondary transition-all hover:border-primary-500 hover:bg-primary-50 hover:text-primary-700 dark:hover:bg-primary-950/40 dark:hover:text-primary-400"
            >
              <MessageCircle className="size-3.5" />
            </a>
            {/* Metadata tiêu chuẩn tiền tệ & múi giờ cho trình đọc màn hình / báo cáo đồ án */}
            <span className="sr-only">{t('currencyInfo')}</span>
            <span className="sr-only">{t('timezoneInfo')}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
