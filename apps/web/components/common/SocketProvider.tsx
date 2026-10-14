'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RealtimeEvent } from '@/mocks/realtime';
import { subscribe } from '@/mocks/realtime';

interface SocketContextValue {
  connected: boolean;
  /** Lần kết nối lại gần nhất – dùng để hiện banner "đang kết nối lại". */
  lastEvent: RealtimeEvent | null;
  subscribeToEvents: (listener: (e: RealtimeEvent) => void) => () => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

/**
 * Cầu nối realtime.
 *
 * Với backend thật, đây là chỗ khởi tạo `io(NEXT_PUBLIC_SOCKET_URL, {...})` và
 * chuyển tiếp sự kiện. Hiện tại nó nối vào kênh `BroadcastChannel` mô phỏng,
 * nên component dùng hook bên dưới không phải sửa gì khi nối Socket.IO thật.
 *
 * Đồng thời lắng nghe các sự kiện cập nhật để tự động invalidate cache TanStack Query,
 * đảm bảo dữ liệu giữa các tab (Chủ sân và Khách hàng) luôn đồng bộ tức thì.
 */
export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    setConnected(true);
    const unsubscribe = subscribe((event) => {
      setLastEvent(event);
      if (event.type === 'slot_updated') {
        void queryClient.invalidateQueries({ queryKey: ['venues'] });
        void queryClient.invalidateQueries({ queryKey: ['owner', 'timeline'] });
      } else if (event.type === 'booking_confirmed' || event.type === 'booking_cancelled') {
        void queryClient.invalidateQueries({ queryKey: ['bookings'] });
        void queryClient.invalidateQueries({ queryKey: ['owner', 'bookings'] });
        void queryClient.invalidateQueries({ queryKey: ['owner', 'timeline'] });
        void queryClient.invalidateQueries({ queryKey: ['venues'] });
      } else if (event.type === 'payment_submitted') {
        void queryClient.invalidateQueries({ queryKey: ['owner', 'payments'] });
        void queryClient.invalidateQueries({ queryKey: ['owner', 'bookings'] });
        void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      }
    });

    // Lắng nghe tín hiệu đồng bộ Mock DB qua localStorage từ tab khác
    const onStorageSync = () => {
      void queryClient.invalidateQueries({ queryKey: ['venues'] });
      void queryClient.invalidateQueries({ queryKey: ['owner'] });
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
    };
    window.addEventListener('bsc-mock-db-updated', onStorageSync);

    return () => {
      unsubscribe();
      window.removeEventListener('bsc-mock-db-updated', onStorageSync);
      setConnected(false);
    };
  }, [queryClient]);

  return (
    <SocketContext.Provider
      value={{ connected, lastEvent, subscribeToEvents: subscribe }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket(): SocketContextValue {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket phải dùng bên trong <SocketProvider>');
  return ctx;
}

/**
 * Lắng nghe sự kiện realtime và gọi `onEvent`.
 *
 * `onEvent` được đọc qua tham chiếu mới nhất nên không cần bọc `useCallback`
 * ở phía component gọi.
 */
export function useRealtime(onEvent: (e: RealtimeEvent) => void): void {
  const { subscribeToEvents } = useSocket();

  useEffect(() => {
    return subscribeToEvents(onEvent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribeToEvents]);
}
