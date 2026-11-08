import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  UpdateProfileInput,
  User,
} from '@bsc/shared';

import { apiFetch, jsonBody } from '../client';

/**
 * Endpoint module – Auth & hồ sơ.
 * Khớp `mocks/handlers/auth.ts` và `docs/11-api-contract.md` mục "Auth".
 *
 * Hợp đồng với BE (`docs/implemented-apis.md`): `data` của các endpoint
 * register/login/refresh/`GET /users/me`/`PATCH /users/me` CHÍNH LÀ hồ sơ
 * người dùng (không bọc thêm `{ user }`). Các endpoint còn lại trả 204 nên
 * không có body.
 *
 * Ghi chú: phần lớn endpoint ở đây gắn cookie phiên qua `Set-Cookie`, nên khi
 * gọi từ Server Component phải đi qua `lib/api/server.ts`.
 */

export function register(input: RegisterInput) {
  return apiFetch<User>('/auth/register', { method: 'POST', ...jsonBody(input) });
}

export function login(input: LoginInput) {
  return apiFetch<User>('/auth/login', { method: 'POST', ...jsonBody(input) });
}

/** `POST /auth/logout` trả 204 – không có body. */
export function logout() {
  return apiFetch<void>('/auth/logout', { method: 'POST' });
}

/** Ném `ApiError` 401 khi chưa đăng nhập — dùng làm nguồn sự thật cho phiên. */
export function me() {
  return apiFetch<User>('/users/me');
}

/**
 * Luôn trả 204 kể cả khi email không tồn tại — server cố ý không tiết lộ
 * danh sách tài khoản. UI vì thế cũng không được báo "email không tồn tại".
 */
export function forgotPassword(input: ForgotPasswordInput) {
  return apiFetch<void>('/auth/forgot-password', {
    method: 'POST',
    ...jsonBody(input),
  });
}

export function resetPassword(input: ResetPasswordInput) {
  return apiFetch<void>('/auth/reset-password', {
    method: 'POST',
    ...jsonBody(input),
  });
}

export function verifyEmail(token: string) {
  return apiFetch<void>('/auth/verify-email', {
    method: 'POST',
    ...jsonBody({ token }),
  });
}

/**
 * `PATCH /users/me/password`.
 *
 * `confirmPassword` chỉ để đối chiếu ở form — bóc ra trước khi gửi, server
 * không nhận trường này.
 */
export function changePassword({ confirmPassword: _ignored, ...input }: ChangePasswordInput) {
  return apiFetch<void>('/users/me/password', {
    method: 'PATCH',
    ...jsonBody(input),
  });
}

export function updateProfile(input: UpdateProfileInput) {
  return apiFetch<User>('/users/me', { method: 'PATCH', ...jsonBody(input) });
}

/**
 * `POST /users/me/avatar` — multipart, giống upload biên lai: KHÔNG set
 * `Content-Type` để trình duyệt tự thêm boundary.
 */
export function uploadAvatar(file: File) {
  const form = new FormData();
  form.append('avatar', file);
  return apiFetch<User>('/users/me/avatar', { method: 'POST', body: form });
}

/** Trả URL chuyển hướng sang Google OAuth. */
export function googleAuthUrl() {
  return apiFetch<{ url: string }>('/auth/google');
}
