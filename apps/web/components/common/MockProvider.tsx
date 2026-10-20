'use client';

import { useEffect, useState } from 'react';

import { AppBrandLogo } from '@/components/common/AppBrandLogo';
import { SplashBrandReveal } from '@/components/common/SplashBrandReveal';
import { Spinner } from '@/components/ui/spinner';

/**
 * Khởi động MSW trước khi render ứng dụng, kết hợp hiển thị màn hình chào mừng thương hiệu.
 *
 * Nếu render ngay, các component gọi API sẽ bắn request trước lúc service worker
 * kịp đăng ký — request đi ra ngoài, nhận 404 và màn hình hiện lỗi mạng dù dữ
 * liệu mẫu vẫn còn. Vì vậy phải chờ `worker.start()` xong mới render children.
 *
 * Màn hình chào mừng (SplashBrandReveal) hiển thị phía trên (`z-[100]`) trong 1850ms,
 * vừa mang lại trải nghiệm thương hiệu cao cấp vừa che đi quá trình khởi động ngầm của MSW.
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

  return (
    <>
      <SplashBrandReveal isAppReady={ready} />
      {!ready ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 90,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#ffffff',
            fontFamily:
              'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
          className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-white"
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              textAlign: 'center',
            }}
            className="flex flex-col items-center gap-4 text-center"
          >
            <AppBrandLogo size={72} borderRadius={18} showShadow />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#15803d',
                fontSize: '13px',
                fontWeight: 500,
              }}
              className="flex items-center gap-2 text-primary-700 text-xs font-medium"
            >
              <Spinner size="xs" variant="current" label="" />
              <p
                style={{ margin: 0, fontSize: '13px', color: '#15803d' }}
                className="text-xs text-primary-700 font-medium"
              >
                Đang chuẩn bị dữ liệu mẫu…
              </p>
            </div>
          </div>
        </div>
      ) : (
        children
      )}
    </>
  );
}
