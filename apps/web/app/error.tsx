'use client';

import * as React from 'react';
import Link from 'next/link';
import { Home } from 'lucide-react';

import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[AppError]', error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-4">
        <ErrorState error={error} onRetry={reset} className="w-full" />
        <Button variant="outline" size="sm" asChild>
          <Link href="/">
            <Home className="size-4" aria-hidden="true" />
            <span>Về trang chủ</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
