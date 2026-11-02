import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';

function createRequest(
  url: string,
  options: {
    session?: string;
    role?: 'customer' | 'owner' | 'admin';
  } = {},
) {
  const request = new NextRequest(new URL(url, 'http://localhost:3000'));
  if (options.session) {
    request.cookies.set('bsc_session', options.session);
  }
  if (options.role) {
    request.cookies.set('bsc_role', options.role);
  }
  return request;
}

describe('Middleware security & route guard (TC-SEC)', () => {
  it('TC-SEC-01: truy cập /dashboard chuyển hướng 308 sang /owner/dashboard', () => {
    const req = createRequest('/dashboard');
    const res = middleware(req);

    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe('http://localhost:3000/owner/dashboard');
  });

  it('TC-SEC-02: truy cập /owner/dashboard khi chưa có session chuyển hướng sang /login', () => {
    const req = createRequest('/owner/dashboard');
    const res = middleware(req);

    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toContain('/login');
    expect(location).toContain('next=%2Fowner%2Fdashboard');
  });

  it('TC-SEC-03: truy cập /owner/dashboard với role customer bị rewrite sang /not-found (404)', () => {
    const req = createRequest('/owner/dashboard', {
      session: 'sess-cust',
      role: 'customer',
    });
    const res = middleware(req);

    // Rewrite 404
    expect(res.headers.get('x-middleware-rewrite')).toContain('/not-found');
  });

  it('TC-SEC-04: truy cập /owner/dashboard với role owner hoặc admin được phép truy cập', () => {
    const ownerReq = createRequest('/owner/dashboard', {
      session: 'sess-owner',
      role: 'owner',
    });
    const ownerRes = middleware(ownerReq);
    expect(ownerRes.headers.get('location')).toBeNull();
    expect(ownerRes.headers.get('x-middleware-rewrite')).toBeNull();

    const adminReq = createRequest('/owner/dashboard', {
      session: 'sess-admin',
      role: 'admin',
    });
    const adminRes = middleware(adminReq);
    expect(adminRes.headers.get('location')).toBeNull();
    expect(adminRes.headers.get('x-middleware-rewrite')).toBeNull();
  });

  it('TC-MID-01: truy cập /notifications khi chưa đăng nhập bị chuyển hướng sang /login', () => {
    const req = createRequest('/notifications');
    const res = middleware(req);

    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toContain('/login');
    expect(location).toContain('next=%2Fnotifications');
  });

  it('TC-MID-02: truy cập /notifications khi đã đăng nhập được phép đi tiếp', () => {
    const req = createRequest('/notifications', {
      session: 'sess-cust',
      role: 'customer',
    });
    const res = middleware(req);

    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
  });
});
