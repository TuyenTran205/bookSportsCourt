import { http } from 'msw';
import type { OwnerProfile, User } from '@bsc/shared';
import { db, findUserByEmail, persist, saveCurrentUserId } from '../db';
import { DEMO_PASSWORD } from '../fixtures/users';
import { ownerProfiles } from '../fixtures/users';
import { err, newId, ok, simulateLatency } from '../utils';

/**
 * Auth giả lập.
 *
 * Session dùng cookie `bsc_session` chứa id người dùng. Vì MSW chạy trong
 * trình duyệt và ghi cookie thật, `middleware.ts` của Next đọc được cookie này
 * y như khi có backend thật — nên logic phân quyền theo route chạy đúng, không
 * phải mock riêng ở tầng middleware.
 */

export const SESSION_COOKIE = 'bsc_session';
export const ROLE_COOKIE = 'bsc_role';

export function setSession(userId: string) {
  if (typeof document === 'undefined') return;
  const user = db.users.find((u) => u.id === userId);
  const role = user?.role ?? 'customer';
  // 7 ngày; không đặt HttpOnly vì mock cần đọc lại được ở client và middleware.
  document.cookie = `${SESSION_COOKIE}=${userId}; path=/; max-age=${7 * 24 * 60 * 60}; samesite=lax`;
  document.cookie = `${ROLE_COOKIE}=${role}; path=/; max-age=${7 * 24 * 60 * 60}; samesite=lax`;
}

export function clearSession() {
  if (typeof document === 'undefined') return;
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`;
  document.cookie = `${ROLE_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

/** Bóc mật khẩu trước khi trả ra ngoài. */
function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
  };
}

export const authHandlers = [
  http.post('/api/v1/auth/register', async ({ request }) => {
    await simulateLatency(400);
    const body = (await request.json()) as {
      fullName: string;
      email: string;
      phone: string;
      password: string;
    };

    if (findUserByEmail(body.email)) {
      return err(409, 'EMAIL_ALREADY_EXISTS', 'Email này đã được đăng ký');
    }

    const user: User = {
      id: newId(),
      email: body.email.toLowerCase(),
      fullName: body.fullName,
      phone: body.phone,
      avatarUrl: null,
      role: 'customer',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    setSession(user.id);
    db.currentUserId = user.id;
    saveCurrentUserId(user.id);
    persist(); // không lưu thì F5 sẽ khôi phục người dùng cũ và ghi đè cookie phiên

    return ok({ user: publicUser(user) }, 201);
  }),

  http.post('/api/v1/auth/login', async ({ request }) => {
    await simulateLatency(400);
    const body = (await request.json()) as { email: string; password: string };
    const user = findUserByEmail(body.email);

    // Mọi tài khoản demo dùng chung một mật khẩu.
    if (!user || body.password !== DEMO_PASSWORD) {
      return err(401, 'UNAUTHORIZED', 'Email hoặc mật khẩu không đúng');
    }
    if (user.status === 'suspended') {
      return err(403, 'FORBIDDEN', 'Tài khoản đã bị tạm khoá. Vui lòng liên hệ hỗ trợ.');
    }

    setSession(user.id);
    db.currentUserId = user.id;
    saveCurrentUserId(user.id);
    persist();
    return ok({ user: publicUser(user) });
  }),

  http.post('/api/v1/auth/logout', async () => {
    await simulateLatency(200);
    clearSession();
    db.currentUserId = null;
    saveCurrentUserId(null);
    persist();
    return ok({ success: true });
  }),

  /**
   * Trả về người dùng đang đăng nhập, hoặc 401 nếu chưa.
   *
   * Đường dẫn là `/users/me` theo docs/11-api-contract.md mục Users. Tài liệu
   * ghi rõ KHÔNG có `GET /auth/me` — `/auth/*` chỉ còn endpoint xác thực/phiên.
   */
  http.get('/api/v1/users/me', async () => {
    await simulateLatency(150);
    const user = db.users.find((u) => u.id === db.currentUserId);
    if (!user) return err(401, 'UNAUTHORIZED', 'Chưa đăng nhập');

    // Kèm hồ sơ chủ sân nếu có — header cần biết để hiện menu "Kênh chủ sân".
    const ownerProfile: OwnerProfile | undefined = ownerProfiles.find((p) => p.userId === user.id);
    return ok({ user: publicUser(user), ownerProfile: ownerProfile ?? null });
  }),

  /** Cập nhật hồ sơ cá nhân (docs/11 mục Users). */
  http.patch('/api/v1/users/me', async ({ request }) => {
    await simulateLatency(350);
    const user = db.users.find((u) => u.id === db.currentUserId);
    if (!user) return err(401, 'UNAUTHORIZED', 'Chưa đăng nhập');

    const body = (await request.json()) as { fullName?: string; phone?: string };
    if (body.fullName !== undefined) {
      if (body.fullName.trim().length < 2) {
        return err(422, 'VALIDATION_ERROR', 'Họ tên phải có ít nhất 2 ký tự');
      }
      user.fullName = body.fullName.trim();
    }
    if (body.phone !== undefined) user.phone = body.phone || null;

    persist();
    return ok({ user: publicUser(user) });
  }),

  /** Đổi mật khẩu — bắt buộc đúng mật khẩu cũ (docs/11 mục Users). */
  http.patch('/api/v1/users/me/password', async ({ request }) => {
    await simulateLatency(400);
    const user = db.users.find((u) => u.id === db.currentUserId);
    if (!user) return err(401, 'UNAUTHORIZED', 'Chưa đăng nhập');

    const body = (await request.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };
    // Mock dùng chung một mật khẩu demo cho mọi tài khoản (xem fixtures/users.ts).
    if (body.currentPassword !== DEMO_PASSWORD) {
      return err(400, 'INVALID_PASSWORD', 'Mật khẩu hiện tại không đúng');
    }
    if (!body.newPassword || body.newPassword.length < 8) {
      return err(422, 'VALIDATION_ERROR', 'Mật khẩu mới phải có ít nhất 8 ký tự');
    }
    // Không lưu mật khẩu mới: mock chỉ có một mật khẩu dùng chung, ghi đè sẽ
    // làm hỏng các tài khoản demo khác. Trả thành công để UI chạy đúng luồng.
    return ok({ success: true });
  }),

  /**
   * Upload ảnh đại diện (multipart). Mock không lưu file thật — trả về một
   * URL ảnh sinh sẵn để avatar hiển thị ngay.
   */
  http.post('/api/v1/users/me/avatar', async ({ request }) => {
    await simulateLatency(600);
    const user = db.users.find((u) => u.id === db.currentUserId);
    if (!user) return err(401, 'UNAUTHORIZED', 'Chưa đăng nhập');

    const form = await request.formData();
    const file = form.get('avatar');
    if (!(file instanceof File)) {
      return err(422, 'VALIDATION_ERROR', 'Thiếu tệp ảnh đại diện');
    }
    if (file.size > 2 * 1024 * 1024) {
      return err(422, 'FILE_TOO_LARGE', 'Ảnh đại diện tối đa 2MB');
    }

    user.avatarUrl = `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(
      user.fullName,
    )}`;
    persist();
    return ok({ user: publicUser(user) });
  }),

  http.post('/api/v1/auth/forgot-password', async () => {
    await simulateLatency(400);
    // Luôn trả 200 dù email có tồn tại hay không — tránh lộ danh sách tài khoản.
    return ok({ success: true, message: 'Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.' });
  }),

  http.post('/api/v1/auth/reset-password', async () => {
    await simulateLatency(400);
    return ok({ success: true });
  }),

  http.post('/api/v1/auth/verify-email', async () => {
    await simulateLatency(300);
    return ok({ success: true });
  }),

  http.get('/api/v1/auth/google', async () => {
    // Không mô phỏng luồng OAuth thật; chỉ để nút "Đăng nhập bằng Google" có phản hồi.
    return ok({ url: '#' });
  }),
];
