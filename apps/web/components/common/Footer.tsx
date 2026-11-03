'use client';

import Link from 'next/link';
import { Calendar, Mail, MapPin, Phone } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Footer – Chân trang chuẩn dùng chung toàn hệ thống (docs/07-design-system.md).
 * Trình bày thông tin doanh nghiệp, chính sách, hỗ trợ và thông tin tiền tệ/múi giờ.
 */
export function Footer() {
  const t = useTranslations('footer');
  const tCommon = useTranslations('common');

  return (
    <footer className="border-t border-border bg-bg text-text-secondary">
      <div className="container py-12 md:py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-5">
          {/* Cột 1 & 2: Thương hiệu & giới thiệu */}
          <div className="flex flex-col gap-4 lg:col-span-2">
            <Link
              href="/"
              className="flex items-center gap-2 text-lg font-bold text-primary-700 transition-colors hover:text-primary-800"
            >
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary-700 text-white">
                <Calendar className="size-5" />
              </div>
              <span>{tCommon('appName')}</span>
            </Link>
            <p className="max-w-sm text-sm text-text-secondary">
              {t('brandDescription')}
            </p>
            <div className="flex flex-col gap-2 pt-2 text-xs text-text-secondary">
              <div className="flex items-center gap-2">
                <MapPin className="size-3.5 text-text-disabled" />
                <span>{t('location')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="size-3.5 text-text-disabled" />
                <span>{t('hotline')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="size-3.5 text-text-disabled" />
                <span>{t('support')}</span>
              </div>
            </div>
          </div>

          {/* Cột 3: Dành cho người chơi */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-text-primary">{t('customerHeading')}</h3>
            <ul className="flex flex-col gap-2 text-sm text-text-secondary">
              <li>
                <Link href="/venues" className="transition-colors hover:text-primary-600 dark:hover:text-primary-400">
                  {t('findVenues')}
                </Link>
              </li>
              <li>
                <Link href="/bookings" className="transition-colors hover:text-primary-600 dark:hover:text-primary-400">
                  {t('myBookings')}
                </Link>
              </li>
              <li>
                <Link href="/favorites" className="transition-colors hover:text-primary-600 dark:hover:text-primary-400">
                  {t('favorites')}
                </Link>
              </li>
              <li>
                <span className="text-text-disabled">{t('bookingGuide')}</span>
              </li>
            </ul>
          </div>

          {/* Cột 4: Dành cho chủ sân */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-text-primary">{t('ownerHeading')}</h3>
            <ul className="flex flex-col gap-2 text-sm text-text-secondary">
              <li>
                <Link href="/owner/timeline" className="transition-colors hover:text-primary-600 dark:hover:text-primary-400">
                  {t('ownerTimeline')}
                </Link>
              </li>
              <li>
                <Link href="/owner/apply" className="transition-colors hover:text-primary-600 dark:hover:text-primary-400">
                  {t('ownerApply')}
                </Link>
              </li>
              <li>
                <span className="text-text-disabled">{t('paymentProcess')}</span>
              </li>
              <li>
                <span className="text-text-disabled">{t('partnerPolicy')}</span>
              </li>
            </ul>
          </div>

          {/* Cột 5: Quy định & Chính sách */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-text-primary">{t('policyHeading')}</h3>
            <ul className="flex flex-col gap-2 text-sm text-text-secondary">
              <li>
                <span className="text-text-disabled">{t('terms')}</span>
              </li>
              <li>
                <span className="text-text-disabled">{t('privacy')}</span>
              </li>
              <li>
                <span className="text-text-disabled">{t('cancellationPolicy')}</span>
              </li>
              <li>
                <span className="text-text-disabled">{t('operatingRegulations')}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Dòng chân trang */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 text-xs text-text-disabled sm:flex-row">
          <p>{t('copyright')}</p>
          <div className="flex items-center gap-4">
            <span>{t('currencyInfo')}</span>
            <span>•</span>
            <span>{t('timezoneInfo')}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
