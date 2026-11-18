// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { getSocketBaseUrl } from '@/lib/api/client';
import { getWsToken } from '@/lib/api/endpoints/auth';
import {
  SocketProvider,
  useOptionalSocket,
  useSocket,
} from './SocketProvider';

function Consumer({
  onReady,
}: {
  onReady: (ctx: ReturnType<typeof useSocket>) => void;
}) {
  const socket = useSocket();
  const optional = useOptionalSocket();
  React.useEffect(() => {
    expect(optional).toBe(socket);
    onReady(socket);
  }, [optional, onReady, socket]);
  return null;
}

describe('SocketProvider & realtime URL helpers', () => {
  const originalSocketEnv = process.env.NEXT_PUBLIC_SOCKET_URL;
  const originalApiEnv = process.env.NEXT_PUBLIC_API_URL;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SOCKET_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  afterEach(() => {
    if (originalSocketEnv === undefined) delete process.env.NEXT_PUBLIC_SOCKET_URL;
    else process.env.NEXT_PUBLIC_SOCKET_URL = originalSocketEnv;
    if (originalApiEnv === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = originalApiEnv;
    vi.restoreAllMocks();
  });

  it('ưu tiên NEXT_PUBLIC_SOCKET_URL và tự cắt dấu / cuối', () => {
    process.env.NEXT_PUBLIC_SOCKET_URL = 'https://booksportscourt.onrender.com/';
    expect(getSocketBaseUrl()).toBe('https://booksportscourt.onrender.com');
  });

  it('fallback sang NEXT_PUBLIC_API_URL hoặc localhost:3001', () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://127.0.0.1:3001/';
    expect(getSocketBaseUrl()).toBe('http://127.0.0.1:3001');
    delete process.env.NEXT_PUBLIC_API_URL;
    expect(getSocketBaseUrl()).toBe('http://localhost:3001');
  });

  it('getWsToken gọi POST /api/v1/auth/ws-token và unwrap data', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { token: 'ws-jwt-123', expiresInSeconds: 900 } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    const result = await getWsToken();
    expect(result).toEqual({ token: 'ws-jwt-123', expiresInSeconds: 900 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('/api/v1/auth/ws-token');
    expect(fetchSpy.mock.calls[0]?.[1]?.method).toBe('POST');
  });

  it('cung cấp joinVenue / leaveVenue và useOptionalSocket trả null ngoài Provider', () => {
    function Outside() {
      const ctx = useOptionalSocket();
      expect(ctx).toBeNull();
      return null;
    }
    render(<Outside />);

    const qc = new QueryClient();
    const readySpy = vi.fn();
    render(
      <QueryClientProvider client={qc}>
        <SocketProvider>
          <Consumer onReady={readySpy} />
        </SocketProvider>
      </QueryClientProvider>,
    );
    expect(readySpy).toHaveBeenCalled();
    const ctx = readySpy.mock.calls[0]![0] as ReturnType<typeof useSocket>;
    expect(typeof ctx.joinVenue).toBe('function');
    expect(typeof ctx.leaveVenue).toBe('function');
    act(() => {
      ctx.joinVenue('019a0000-0004-7000-8000-000000000001', '2026-11-14');
      ctx.leaveVenue('019a0000-0004-7000-8000-000000000001', '2026-11-14');
    });
  });
});
