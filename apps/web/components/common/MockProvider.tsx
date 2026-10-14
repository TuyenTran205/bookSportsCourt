'use client';

import { useEffect, useState } from 'react';

/**
 * Khởi động MSW trước khi render ứng dụng.
 *
 * Nếu render ngay, các component gọi API sẽ bắn request trước lúc service worker
 * kịp đăng ký — request đi ra ngoài, nhận 404 và màn hình hiện lỗi mạng dù dữ
 * liệu mẫu vẫn còn. Vì vậy phải chờ `worker.start()` xong mới render.
 *
 * Khi `NEXT_PUBLIC_API_MOCKING !== 'enabled'`, component này trong suốt.
 */
export function MockProvider({ children }: { children: React.ReactNode }) {
  const enabled = process.env.NEXT_PUBLIC_API_MOCKING === 'enabled';
  const [ready, setReady] = useState(!enabled);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    void (async () => {
      const { startMocking } = await import('@/mocks/browser');
      await startMocking();
      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-primary-600"
            aria-hidden="true"
          />
          <p className="text-sm text-text-secondary">Đang chuẩn bị dữ liệu mẫu…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
