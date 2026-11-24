// @vitest-environment jsdom
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import { ResetPasswordForm } from './ResetPasswordForm';
import { VerifyEmailPanel } from './VerifyEmailPanel';
import { ApiError } from '@/lib/api/errors';
import * as authEndpoints from '@/lib/api/endpoints/auth';

const mockPush = vi.fn();
const mockLogin = vi.fn();
const mockRegister = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

vi.mock('@/lib/navigation/navigate', () => ({
  useAppRouter: () => ({ push: mockPush }),
}));

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({
    login: mockLogin,
    register: mockRegister,
    isLoggingIn: false,
    isRegistering: false,
  }),
}));

vi.mock('@/lib/api/endpoints/auth', () => ({
  googleAuthUrl: () => '/api/v1/auth/google',
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  verifyEmail: vi.fn(),
}));

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('Auth Forms & Recovery Flows (GST-06, CUS-01, CUS-02, CUS-16)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
  });

  afterEach(() => {
    cleanup();
  });

  describe('LoginForm', () => {
    it('chuyển hướng về ?next= sau khi đăng nhập thành công', async () => {
      mockSearchParams = new URLSearchParams('next=/venues/san-cau-long');
      mockLogin.mockResolvedValueOnce({ user: { role: 'customer' } });

      render(<LoginForm />);
      fireEvent.change(screen.getByLabelText('email'), { target: { value: 'khach@example.com' } });
      fireEvent.change(screen.getByLabelText('password'), { target: { value: 'MatKhau123' } });
      fireEvent.click(screen.getByRole('button', { name: /loginButton/i }));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          email: 'khach@example.com',
          password: 'MatKhau123',
          rememberMe: false,
        });
        expect(mockPush).toHaveBeenCalledWith('/venues/san-cau-long');
      });
    });

    it('chuyển hướng đúng dashboard theo vai trò owner / admin và hiện lỗi ApiError', async () => {
      mockLogin.mockResolvedValueOnce({ user: { role: 'admin' } });
      render(<LoginForm />);
      fireEvent.change(screen.getByLabelText('email'), { target: { value: 'admin@example.com' } });
      fireEvent.change(screen.getByLabelText('password'), { target: { value: 'MatKhau123' } });
      fireEvent.click(screen.getByRole('button', { name: /loginButton/i }));
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/admin/dashboard'));

      cleanup();
      mockLogin.mockRejectedValueOnce(new ApiError(401, 'INVALID_CREDENTIALS', 'Sai email hoặc mật khẩu'));
      render(<LoginForm />);
      fireEvent.change(screen.getByLabelText('email'), { target: { value: 'x@example.com' } });
      fireEvent.change(screen.getByLabelText('password'), { target: { value: 'wrongpass' } });
      fireEvent.click(screen.getByRole('button', { name: /loginButton/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert').textContent).toContain('Sai email hoặc mật khẩu');
      });
    });
  });

  describe('RegisterForm', () => {
    it('chặn submit khi nhập SĐT/mật khẩu không hợp lệ và hiển thị lỗi server 409', async () => {
      render(<RegisterForm />);
      fireEvent.change(screen.getByLabelText('fullName'), { target: { value: 'Nguyễn An' } });
      fireEvent.change(screen.getByLabelText('email'), { target: { value: 'an@example.com' } });
      fireEvent.change(screen.getByLabelText('phone'), { target: { value: '12345' } });
      fireEvent.change(document.getElementById('reg-password')!, { target: { value: 'MatKhau123' } });
      fireEvent.change(document.getElementById('reg-confirm-password')!, { target: { value: 'Khac1234' } });
      fireEvent.click(screen.getByRole('button', { name: /registerButton/i }));

      await waitFor(() => {
        expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
      });
      expect(mockRegister).not.toHaveBeenCalled();

      mockRegister.mockRejectedValueOnce(new ApiError(409, 'EMAIL_ALREADY_EXISTS', 'Email đã được đăng ký'));
      fireEvent.change(screen.getByLabelText('phone'), { target: { value: '0912345678' } });
      fireEvent.change(document.getElementById('reg-confirm-password')!, { target: { value: 'MatKhau123' } });
      fireEvent.click(screen.getByRole('button', { name: /registerButton/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert').textContent).toContain('Email đã được đăng ký');
      });
    });
  });

  describe('ForgotPasswordForm & ResetPasswordForm & VerifyEmailPanel (CUS-16)', () => {
    it('ForgotPasswordForm luôn hiển thị trạng thái đã gửi kể cả khi API báo lỗi (anti-enumeration)', async () => {
      vi.mocked(authEndpoints.forgotPassword).mockRejectedValueOnce(new Error('rate limited'));
      render(<ForgotPasswordForm />);

      fireEvent.change(screen.getByLabelText('email'), { target: { value: 'user@example.com' } });
      fireEvent.click(screen.getByRole('button', { name: /forgotButton/i }));

      await waitFor(() => {
        expect(screen.getByText('forgotSent')).not.toBeNull();
      });
    });

    it('ResetPasswordForm báo link không hợp lệ khi thiếu ?token= và submit đổi mật khẩu khi có token', async () => {
      render(<ResetPasswordForm />);
      expect(screen.getByText('resetInvalidTitle')).not.toBeNull();

      cleanup();
      mockSearchParams = new URLSearchParams('token=valid-reset-token');
      vi.mocked(authEndpoints.resetPassword).mockResolvedValueOnce({ success: true });
      render(<ResetPasswordForm />);

      fireEvent.change(document.getElementById('reset-password')!, { target: { value: 'NewPass123' } });
      fireEvent.change(document.getElementById('reset-confirm')!, { target: { value: 'NewPass123' } });
      fireEvent.click(screen.getByRole('button', { name: /resetButton/i }));

      await waitFor(() => {
        expect(authEndpoints.resetPassword).toHaveBeenCalledWith({
          token: 'valid-reset-token',
          password: 'NewPass123',
          confirmPassword: 'NewPass123',
        });
        expect(screen.getByText('resetDoneTitle')).not.toBeNull();
      });
    });

    it('VerifyEmailPanel gọi verifyEmail khi có ?token= và hiển thị lỗi + nút retry khi thất bại', async () => {
      renderWithClient(<VerifyEmailPanel />);
      expect(screen.getByText('verifyTitle')).not.toBeNull();

      cleanup();
      mockSearchParams = new URLSearchParams('token=bad-token');
      vi.mocked(authEndpoints.verifyEmail).mockRejectedValueOnce(new Error('expired'));
      renderWithClient(<VerifyEmailPanel />);

      await waitFor(() => {
        expect(screen.getByText('verifyFailedTitle')).not.toBeNull();
      });

      vi.mocked(authEndpoints.verifyEmail).mockResolvedValueOnce({ success: true });
      fireEvent.click(screen.getByRole('button', { name: /retry/i }));

      await waitFor(() => {
        expect(screen.getByText('verifyDoneTitle')).not.toBeNull();
      });
    });
  });
});
