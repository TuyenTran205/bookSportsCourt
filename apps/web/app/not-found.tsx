import Link from 'next/link';
import { FileQuestion, Home } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

/**
 * not-found.tsx – Trang 404 chuẩn của Next.js (docs/09 & docs/08).
 * Được sử dụng khi người dùng truy cập trang không tồn tại hoặc khi middleware
 * rewrite chặn các route nội bộ (như /admin).
 */
export default function NotFound() {
  const tCommon = useTranslations('common');

  return (
    <main className="container flex min-h-[calc(100vh-4rem-12rem)] flex-col items-center justify-center py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
        <FileQuestion className="size-8" aria-hidden="true" />
      </div>

      <h1 className="mt-4 text-2xl font-bold text-neutral-900 sm:text-3xl">
        {tCommon('notFoundTitle')}
      </h1>

      <p className="mt-2 max-w-md text-sm text-neutral-500">
        {tCommon('notFoundDesc')}
      </p>

      <Button variant="primary" size="md" asChild className="mt-6">
        <Link href="/" className="flex items-center gap-2">
          <Home className="size-4" />
          <span>{tCommon('goHome')}</span>
        </Link>
      </Button>
    </main>
  );
}
