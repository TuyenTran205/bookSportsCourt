'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { SOCKET_EVENTS } from '@bsc/shared';
import type { RealtimeEvent } from '@/mocks/realtime';
import { subscribe } from '@/mocks/realtime';
import { db } from '@/mocks/db';
import { getRealtimeSocket } from '@/lib/realtime/socket-client';

interface SocketContextValue {
  connected: boolean;
  /** Sự kiện realtime gần nhất – dùng để hiện banner "đang kết nối lại". */
  lastEvent: RealtimeEvent | null;
  subscribeToEvents: (listener: (e: RealtimeEvent) => void) => () => void;
  /** Vào room `venue:{id}:date:{date}` để nhận SLOT_UPDATED của lưới slot. */
  joinVenue: (venueId: string, date: string) => void;
  /** Rời room khi đổi ngày hoặc unmount. */
  leaveVenue: (venueId: string, date: string) => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

/** Sự kiện server phát xuống – khớp SOCKET_EVENTS ở packages/shared. */
const SERVER_EVENTS = [
  SOCKET_EVENTS.SLOT_UPDATED,
  SOCKET_EVENTS.HOLD_EXPIRED,
  SOCKET_EVENTS.BOOKING_CONFIRMED,
  SOCKET_EVENTS.BOOKING_CANCELLED,
  SOCKET_EVENTS.BOOKING_CREATED,
  SOCKET_EVENTS.PAYMENT_SUBMITTED,
  SOCKET_EVENTS.PAYMENT_REJECTED,
  SOCKET_EVENTS.NOTIFICATION_CREATED,
] as const;

/**
 * Cầu nối realtime.
 *
 * Hai chế độ:
 * 1. **Socket.IO thật** – khi có `NEXT_PUBLIC_SOCKET_URL` và MSW đang tắt. Gateway BE
 *    xác thực bằng cookie httpOnly và tự đưa socket vào room `owner:` / `user:`;
 *    client chỉ cần `join_venue` để nhận lưới slot của sân đang xem.
 * 2. **Mock** – khi `NEXT_PUBLIC_API_MOCKING=enabled`, dùng `BroadcastChannel`
 *    (`@/mocks/realtime`) mô phỏng cùng hành vi mà không cần backend.
 *
 * Cả hai chế độ đều phát ra `RealtimeEvent` nên component tiêu thụ không phải sửa gì.
 * Provider đồng thời invalidate cache TanStack Query theo loại sự kiện để dữ liệu
 * giữa các màn (Chủ sân / Khách hàng) đồng bộ tức thì.
 */
export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const queryClient = useQueryClient();
  /** Room đã join – join lại sau khi reconnect để không mất cập nhật lưới slot. */
  const joinedRooms = useRef(new Set<string>());

  const subscribeToEvents = useCallback((listener: (event: RealtimeEvent) => void) => {
    const socket = getRealtimeSocket();
    if (!socket) {
      // Mock mode: lọc theo targetUserId giống room cá nhân của BE.
      return subscribe((event) => {
        if (event.targetUserId && event.targetUserId !== db.currentUserId) return;
        listener(event);
      });
    }
    const offs = SERVER_EVENTS.map((type) => {
      const handler = (payload: unknown) => listener({ type, payload } as RealtimeEvent);
      socket.on(type, handler);
      return () => socket.off(type, handler);
    });
    return () => offs.forEach((off) => off());
  }, []);

  const joinVenue = useCallback((venueId: string, date: string) => {
    const socket = getRealtimeSocket();
    if (!socket) return;
    const key = `venue:${venueId}:date:${date}`;
    if (joinedRooms.current.has(key)) return;
    joinedRooms.current.add(key);
    socket.emit(SOCKET_EVENTS.JOIN_VENUE, { venueId, date });
  }, []);

  const leaveVenue = useCallback((venueId: string, date: string) => {
    const socket = getRealtimeSocket();
    if (!socket) return;
    const key = `venue:${venueId}:date:${date}`;
    if (!joinedRooms.current.delete(key)) return;
    socket.emit(SOCKET_EVENTS.LEAVE_VENUE, { venueId, date });
  }, []);

  useEffect(() => {
    const socket = getRealtimeSocket();
    const onConnect = () => {
      setConnected(true);
      // Reconnect: vào lại các room đang mở (server đã xoá room cũ theo socket).
      for (const key of joinedRooms.current) {
        const [, venueId, , date] = key.split(':');
        socket?.emit(SOCKET_EVENTS.JOIN_VENUE, { venueId, date });
      }
    };
    const onDisconnect = () => setConnected(false);
    if (socket) {
      setConnected(socket.connected);
      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);
      if (!socket.connected) socket.connect();
    } else {
      setConnected(true);
    }
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
      socket?.off('connect', onConnect);
      socket?.off('disconnect', onDisconnect);
      setConnected(false);
    };
  }, [queryClient, subscribeToEvents]);

  return (
    <SocketContext.Provider
      value={{ connected, lastEvent, subscribeToEvents, joinVenue, leaveVenue }}
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
