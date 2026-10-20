'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from 'sonner';
import { SocketProvider } from '@/components/common/SocketProvider';

/**
 * Bọc các provider phía client.
 *
 * Thứ tự có ý nghĩa: `QueryClientProvider` ngoài cùng, rồi `SocketProvider`.
 * Socket cần biết trạng thái đăng nhập, mà thông tin đó đến từ query
 * `/auth/me`, nên nó phải nằm trong tầng React Query.
 *
 * `QueryClient` tạo trong `useState` để mỗi lần render trên server không dùng
 * chung state — đúng khuyến nghị của TanStack Query với App Router.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Dữ liệu đặt sân đổi liên tục — không coi là tươi quá lâu.
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SocketProvider>
        {children}
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{ className: 'font-sans' }}
        />
      </SocketProvider>
    </QueryClientProvider>
  );
}
