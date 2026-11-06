import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  OwnerProfile,
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
 * Ghi chú: phần lớn endpoint ở đây gắn cookie phiên qua `Set-Cookie`, nên khi
 * gọi từ Server Component phải đi qua `lib/api/server.ts`.
 */

export interface AuthResult {
  user: User;
}

/** `GET /users/me` trả kèm hồ sơ chủ sân để header biết có hiện menu "Kênh chủ sân". */
export interface MeResult {
  user: User;
  ownerProfile: OwnerProfile | null;
}

export function register(input: RegisterInput) {
  return apiFetch<AuthResult>('/auth/register', { method: 'POST', ...jsonBody(input) });
}

export function login(input: LoginInput) {
  return apiFetch<AuthResult>('/auth/login', { method: 'POST', ...jsonBody(input) });
}

export function logout() {
  return apiFetch<{ success: true }>('/auth/logout', { method: 'POST' });
}

/** Ném `ApiError` 401 khi chưa đăng nhập — dùng làm nguồn sự thật cho phiên. */
export function me() {
  return apiFetch<MeResult>('/users/me');
}

/**
 * Luôn trả 200 kể cả khi email không tồn tại — server cố ý không tiết lộ
 * danh sách tài khoản. UI vì thế cũng không được báo "email không tồn tại".
 */
export function forgotPassword(input: ForgotPasswordInput) {
  return apiFetch<{ success: true; message: string }>('/auth/forgot-password', {
    method: 'POST',
    ...jsonBody(input),
  });
}

export function resetPassword(input: ResetPasswordInput) {
  return apiFetch<{ success: true }>('/auth/reset-password', {
    method: 'POST',
    ...jsonBody(input),
  });
}

export function verifyEmail(token: string) {
  return apiFetch<{ success: true }>('/auth/verify-email', {
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
  return apiFetch<{ success: true }>('/users/me/password', {
    method: 'PATCH',
    ...jsonBody(input),
  });
}

export function updateProfile(input: UpdateProfileInput) {
  return apiFetch<AuthResult>('/users/me', { method: 'PATCH', ...jsonBody(input) });
}

/**
 * `POST /users/me/avatar` — multipart, giống upload biên lai: KHÔNG set
 * `Content-Type` để trình duyệt tự thêm boundary.
 */
export function uploadAvatar(file: File) {
  const form = new FormData();
  form.append('avatar', file);
  return apiFetch<AuthResult>('/users/me/avatar', { method: 'POST', body: form });
}

/** Trả URL chuyển hướng sang Google OAuth. */
export function googleAuthUrl() {
  return apiFetch<{ url: string }>('/auth/google');
}
