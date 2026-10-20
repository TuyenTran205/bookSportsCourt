'use client';

import { useEffect, useState } from 'react';

import { Spinner } from '@/components/ui/spinner';

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
      try {
        const { startMocking } = await import('@/mocks/browser');
        // Timeout 3.5s để không bao giờ bị kẹt vĩnh viễn ở màn hình chờ nếu ServiceWorker gặp sự cố
        await Promise.race([
          startMocking(),
          new Promise((resolve) => setTimeout(resolve, 3500)),
        ]);
      } catch (err) {
        console.warn('MSW start failed, continuing anyway:', err);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  if (!ready) {
    return (
      <div
        style={{
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8fafc',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
        className="flex min-h-screen items-center justify-center bg-bg"
      >
        <div
          role="status"
          aria-live="polite"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            textAlign: 'center',
          }}
          className="flex flex-col items-center gap-3 text-center"
        >
          <Spinner size="lg" label="" />
          <p
            style={{ fontSize: '14px', color: '#64748b', margin: 0 }}
            className="text-sm text-text-secondary"
          >
            Đang chuẩn bị dữ liệu mẫu…
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
