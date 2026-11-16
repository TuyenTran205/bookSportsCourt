'use client';

import { io, type Socket } from 'socket.io-client';

/**
 * Namespace Socket.IO của backend (xem docs/11-api-contract.md – mục Realtime).
 * Gateway BE xác thực bằng cookie httpOnly nên client chỉ cần withCredentials.
 */
export const REALTIME_NAMESPACE = '/ws';

let socket: Socket | null = null;

/** MSW đang bật thì realtime đi qua mock BroadcastChannel, không mở socket thật. */
export function isRealtimeMockMode(): boolean {
  return process.env.NEXT_PUBLIC_API_MOCKING === 'enabled';
}

/**
 * Singleton socket dùng chung toàn app. Trả về null khi chạy mock mode hoặc
 * thiếu cấu hình NEXT_PUBLIC_SOCKET_URL (khi đó provider dùng mock).
 */
export function getRealtimeSocket(): Socket | null {
  if (isRealtimeMockMode()) return null;
  const baseUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
  if (!baseUrl) return null;
  if (!socket) {
    socket = io(`${baseUrl}${REALTIME_NAMESPACE}`, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      autoConnect: true,
    });
  }
  return socket;
}

/** Đóng socket khi unmount provider (chỉ dùng trong test/dev hot-reload). */
export function closeRealtimeSocket(): void {
  socket?.disconnect();
  socket = null;
}
