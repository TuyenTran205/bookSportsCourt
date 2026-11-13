'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { SOCKET_EVENTS } from '@bsc/shared';
import type { RealtimeEvent } from '@/mocks/realtime';
import { subscribe } from '@/mocks/realtime';
import { db } from '@/mocks/db';
import { getSocketBaseUrl, IS_MOCKING_ENABLED } from '@/lib/api/client';
import { getWsToken } from '@/lib/api/endpoints/auth';

interface SocketContextValue {
  connected: boolean;
  /** Lần kết nối lại gần nhất – dùng để hiện banner "đang kết nối lại". */
  lastEvent: RealtimeEvent | null;
  subscribeToEvents: (listener: (e: RealtimeEvent) => void) => () => void;
  joinVenue: (venueId: string, date: string) => void;
  leaveVenue: (venueId: string, date: string) => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

function extractAuthUserId(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const user = (data as { user?: { id?: unknown } }).user;
  return typeof user?.id === 'string' ? user.id : null;
}

/**
 * Cầu nối realtime.
 *
 * - Khi `NEXT_PUBLIC_API_MOCKING === 'enabled'`, sử dụng `BroadcastChannel` mô phỏng đa tab.
 * - Khi chạy với backend thật, kết nối trực tiếp Socket.IO tới namespace `/ws` của Backend
 *   kèm short-lived `ws-token` (hoặc `{ guest: true }` khi chưa đăng nhập), tự động
 *   tham gia lại room `venue:<id>:date:<date>` và invalidate cache TanStack Query.
 */
export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const queryClient = useQueryClient();

  const [authUserId, setAuthUserId] = useState<string | null>(() =>
    extractAuthUserId(queryClient.getQueryData(['auth', 'me'])),
  );
  const listenersRef = useRef(new Set<(e: RealtimeEvent) => void>());
  const socketRef = useRef<Socket | null>(null);
  const activeRoomRef = useRef<{ venueId: string; date: string } | null>(null);

  const subscribeToEvents = useCallback(
    (listener: (event: RealtimeEvent) => void) => {
      if (IS_MOCKING_ENABLED) {
        return subscribe((event) => {
          if (event.targetUserId && event.targetUserId !== db.currentUserId) return;
          listener(event);
        });
      }
      listenersRef.current.add(listener);
      return () => {
        listenersRef.current.delete(listener);
      };
    },
    [],
  );

  const joinVenue = useCallback((venueId: string, date: string) => {
    if (!venueId || !date) return;
    activeRoomRef.current = { venueId, date };
    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit(SOCKET_EVENTS.JOIN_VENUE, { venueId, date });
    }
  }, []);

  const leaveVenue = useCallback((venueId: string, date: string) => {
    const active = activeRoomRef.current;
    if (active && active.venueId === venueId && active.date === date) {
      activeRoomRef.current = null;
    }
    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit(SOCKET_EVENTS.LEAVE_VENUE, { venueId, date });
    }
  }, []);

  const handleRealtimeEvent = useCallback(
    (event: RealtimeEvent) => {
      setLastEvent(event);
      if (event.type === 'notification_created') {
        void queryClient.invalidateQueries({ queryKey: ['notifications'] });
        toast.info(event.payload.title);
      } else if (event.type === 'slot_updated') {
        void queryClient.invalidateQueries({ queryKey: ['venues'] });
        void queryClient.invalidateQueries({ queryKey: ['owner', 'timeline'] });
      } else if (
        event.type === 'booking_confirmed' ||
        event.type === 'booking_cancelled'
      ) {
        void queryClient.invalidateQueries({ queryKey: ['bookings'] });
        void queryClient.invalidateQueries({ queryKey: ['owner', 'bookings'] });
        void queryClient.invalidateQueries({ queryKey: ['owner', 'timeline'] });
        void queryClient.invalidateQueries({ queryKey: ['venues'] });
      } else if (
        event.type === 'payment_submitted' ||
        event.type === 'booking_created'
      ) {
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

      if (!IS_MOCKING_ENABLED) {
        for (const listener of listenersRef.current) {
          listener(event);
        }
      }
    },
    [queryClient],
  );

  // Theo dõi thay đổi phiên đăng nhập (`['auth', 'me']`) để nâng cấp / hạ cấp kết nối WS.
  useEffect(() => {
    if (IS_MOCKING_ENABLED) return;
    return queryClient.getQueryCache().subscribe((event) => {
      const key = event.query.queryKey;
      if (key[0] === 'auth' && key[1] === 'me') {
        const nextUserId = extractAuthUserId(event.query.state.data);
        setAuthUserId((prev) => (prev === nextUserId ? prev : nextUserId));
      }
    });
  }, [queryClient]);

  // Mock mode (`BroadcastChannel` + `bsc-mock-db-updated`)
  useEffect(() => {
    if (!IS_MOCKING_ENABLED) return;
    setConnected(true);
    const unsubscribe = subscribeToEvents(handleRealtimeEvent);

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
  }, [handleRealtimeEvent, queryClient, subscribeToEvents]);

  // Real Socket.IO mode
  useEffect(() => {
    if (IS_MOCKING_ENABLED || process.env.NODE_ENV === 'test') return;

    let cancelled = false;
    let socket: Socket | null = null;
    let refreshTimer: ReturnType<typeof setInterval> | null = null;

    const connectSocket = async () => {
      let authPayload: { token?: string; guest?: boolean } = { guest: true };
      if (authUserId) {
        try {
          const { token } = await getWsToken();
          authPayload = { token };
        } catch {
          // Rơi về guest read-only nếu phiên vừa hết hạn trước khi login lại.
          authPayload = { guest: true };
        }
      }
      if (cancelled) return;

      socket = io(`${getSocketBaseUrl()}/ws`, {
        auth: authPayload,
        withCredentials: true,
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1500,
        reconnectionDelayMax: 15000,
      });
      socketRef.current = socket;

      const emitJoinIfNeeded = () => {
        const room = activeRoomRef.current;
        if (room && socket?.connected) {
          socket.emit(SOCKET_EVENTS.JOIN_VENUE, room);
        }
      };

      socket.on('connect', () => {
        setConnected(true);
        emitJoinIfNeeded();
      });
      socket.on('disconnect', () => {
        setConnected(false);
      });
      socket.on('connect_error', async () => {
        setConnected(false);
        if (!authUserId || !socket) return;
        try {
          const { token } = await getWsToken();
          if (!cancelled) {
            socket.auth = { token };
          }
        } catch {
          if (!cancelled) {
            socket.auth = { guest: true };
          }
        }
      });

      socket.on(SOCKET_EVENTS.SLOT_UPDATED, (payload) =>
        handleRealtimeEvent({ type: 'slot_updated', payload }),
      );
      socket.on(SOCKET_EVENTS.BOOKING_CREATED, (payload) =>
        handleRealtimeEvent({ type: 'booking_created', payload }),
      );
      socket.on(SOCKET_EVENTS.BOOKING_CONFIRMED, (payload) =>
        handleRealtimeEvent({ type: 'booking_confirmed', payload }),
      );
      socket.on(SOCKET_EVENTS.BOOKING_CANCELLED, (payload) =>
        handleRealtimeEvent({ type: 'booking_cancelled', payload }),
      );
      socket.on(SOCKET_EVENTS.PAYMENT_SUBMITTED, (payload) =>
        handleRealtimeEvent({ type: 'payment_submitted', payload }),
      );
      socket.on(SOCKET_EVENTS.PAYMENT_REJECTED, (payload) =>
        handleRealtimeEvent({ type: 'payment_rejected', payload }),
      );
      socket.on(SOCKET_EVENTS.HOLD_EXPIRED, (payload) =>
        handleRealtimeEvent({ type: 'hold_expired', payload }),
      );
      socket.on(SOCKET_EVENTS.NOTIFICATION_CREATED, (payload) =>
        handleRealtimeEvent({ type: 'notification_created', payload }),
      );

      if (authUserId) {
        // Làm mới ws-token định kỳ mỗi 12 phút (trước TTL 15 phút).
        refreshTimer = setInterval(async () => {
          if (cancelled || !socket) return;
          try {
            const { token } = await getWsToken();
            socket.auth = { token };
          } catch {
            // Bỏ qua; lần reconnect tiếp theo sẽ xử lý.
          }
        }, 12 * 60 * 1000);
      }
    };

    void connectSocket();

    const onWindowFocus = () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };
    window.addEventListener('focus', onWindowFocus);

    return () => {
      cancelled = true;
      if (refreshTimer) clearInterval(refreshTimer);
      window.removeEventListener('focus', onWindowFocus);
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
      }
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
      setConnected(false);
    };
  }, [authUserId, handleRealtimeEvent, queryClient]);

  const contextValue = useMemo(
    () => ({ connected, lastEvent, subscribeToEvents, joinVenue, leaveVenue }),
    [connected, lastEvent, subscribeToEvents, joinVenue, leaveVenue],
  );

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket(): SocketContextValue {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket phải dùng bên trong <SocketProvider>');
  return ctx;
}

export function useOptionalSocket(): SocketContextValue | null {
  return useContext(SocketContext);
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
