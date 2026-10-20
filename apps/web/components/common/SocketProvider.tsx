'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { RealtimeEvent } from '@/mocks/realtime';
import { subscribe } from '@/mocks/realtime';
import { db } from '@/mocks/db';

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

  const subscribeToEvents = useCallback((listener: (event: RealtimeEvent) => void) => {
    return subscribe((event) => {
      if (event.targetUserId && event.targetUserId !== db.currentUserId) return;
      listener(event);
    });
  }, []);

  useEffect(() => {
    setConnected(true);
    const unsubscribe = subscribeToEvents((event) => {
      setLastEvent(event);
      if (event.type === 'notification_created') {
        void queryClient.invalidateQueries({ queryKey: ['notifications'] });
        toast.info(event.payload.title);
      } else if (event.type === 'slot_updated') {
        void queryClient.invalidateQueries({ queryKey: ['venues'] });
        void queryClient.invalidateQueries({ queryKey: ['owner', 'timeline'] });
      } else if (event.type === 'booking_confirmed' || event.type === 'booking_cancelled') {
        void queryClient.invalidateQueries({ queryKey: ['bookings'] });
        void queryClient.invalidateQueries({ queryKey: ['owner', 'bookings'] });
        void queryClient.invalidateQueries({ queryKey: ['owner', 'timeline'] });
        void queryClient.invalidateQueries({ queryKey: ['venues'] });
      } else if (event.type === 'payment_submitted' || event.type === 'booking_created') {
        void queryClient.invalidateQueries({ queryKey: ['owner', 'payments'] });
        void queryClient.invalidateQueries({ queryKey: ['owner', 'bookings'] });
        void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      } else if (event.type === 'payment_rejected') {
        void queryClient.invalidateQueries({ queryKey: ['bookings'] });
        void queryClient.invalidateQueries({ queryKey: ['owner', 'bookings'] });
        void queryClient.invalidateQueries({ queryKey: ['owner', 'timeline'] });
        void queryClient.invalidateQueries({ queryKey: ['venues'] });
      } else if (event.type === 'hold_expired') {
        void queryClient.invalidateQueries({ queryKey: ['bookings'] });
        void queryClient.invalidateQueries({ queryKey: ['venues'] });
        void queryClient.invalidateQueries({ queryKey: ['owner', 'timeline'] });
      }
    });

    // Lắng nghe tín hiệu đồng bộ Mock DB qua localStorage từ tab khác
    const onStorageSync = () => {
      void queryClient.invalidateQueries({ queryKey: ['venues'] });
      void queryClient.invalidateQueries({ queryKey: ['owner'] });
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };
    const onWindowFocus = () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };
    window.addEventListener('bsc-mock-db-updated', onStorageSync);
    window.addEventListener('focus', onWindowFocus);

    return () => {
      unsubscribe();
      window.removeEventListener('bsc-mock-db-updated', onStorageSync);
      window.removeEventListener('focus', onWindowFocus);
      setConnected(false);
    };
  }, [queryClient, subscribeToEvents]);

  return (
    <SocketContext.Provider
      value={{ connected, lastEvent, subscribeToEvents }}
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
