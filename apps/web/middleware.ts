import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * middleware.ts – Chặn route theo role TRƯỚC khi render (docs/09-frontend-conventions.md).
 *
 * Chạy ở Edge runtime để UX nhanh:
 * - (customer): cần session. Nếu chưa đăng nhập → redirect /login?next=<path>
 * - (owner): cần session & role in ['owner', 'admin']. Chưa đăng nhập → redirect /login?next=<path>;
 *   đã đăng nhập nhưng sai vai trò → rewrite 404 (redirect sẽ gây vòng lặp với /login)
 * - (admin): cần session & role === 'admin'. Nếu không đủ → rewrite 404 (không để lộ route)
 *
 * Lưu ý bảo mật: Đây chỉ là lớp UX chặn sớm. Mọi validate bảo mật thực sự được BE
 * thực hiện ở từng endpoint (docs/06-security-and-permissions.md).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const session = request.cookies.get('bsc_session')?.value;
  const role = request.cookies.get('bsc_role')?.value;

  // 1. Nhóm route Quản trị viên: /admin
  const isAdminRoute = pathname.startsWith('/admin');
  if (isAdminRoute) {
    if (!session || role !== 'admin') {
      // Rewrite sang 404 thay vì 403 để không tiết lộ route nội bộ có tồn tại
      return NextResponse.rewrite(new URL('/not-found', request.url));
    }
    return NextResponse.next();
  }

  // 2. Nhóm route Chủ sân: /owner (loại trừ /owner/apply dành cho khách hàng đăng ký làm chủ sân)
  const isOwnerRoute = pathname.startsWith('/owner') && pathname !== '/owner/apply';
  if (isOwnerRoute) {
    if (!session) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }
    // Đã đăng nhập nhưng sai vai trò: KHÔNG redirect về /login, vì /login đẩy người đã
    // có session quay lại `next` → vòng lặp vô hạn. Trả 404 giống nhánh admin.
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.rewrite(new URL('/not-found', request.url));
    }
    return NextResponse.next();
  }

  // 3. Nhóm route Khách hàng: /bookings, /favorites, /profile
  const isCustomerRoute =
    pathname.startsWith('/bookings') ||
    pathname.startsWith('/favorites') ||
    pathname.startsWith('/profile');

  if (isCustomerRoute) {
    if (!session) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // 4. Nếu đã đăng nhập mà vào lại các trang xác thực (login, register)
  const isAuthRoute =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password';

  if (isAuthRoute && session) {
    const next = request.nextUrl.searchParams.get('next');
    return NextResponse.redirect(new URL(next ?? '/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Bỏ qua các file tĩnh, ảnh, mock worker và OAuth callback
     * /auth/callback/google PHẢI nằm ngoài mọi chặn route (docs/09)
     */
    '/((?!api|_next/static|_next/image|auth/callback/google|mockServiceWorker.js|favicon.ico).*)',
  ],
};
