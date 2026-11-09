// @vitest-environment jsdom
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';

import type { User } from '@bsc/shared';
import { ProfileScreen } from './ProfileScreen';
import { uploadAvatar, type AuthResult } from '@/lib/api/endpoints/auth';

const mockUserWithoutAvatar: User = {
  id: 'user-1',
  email: 'customer@example.com',
  fullName: 'Trần Văn Khách',
  phone: '0912345678',
  avatarUrl: null,
  role: 'customer',
  status: 'active',
  createdAt: '2026-09-01T08:00:00.000Z',
};

const mockUserWithAvatar: User = {
  ...mockUserWithoutAvatar,
  avatarUrl: 'https://example.com/avatar.png',
};

let currentUserState: User = mockUserWithoutAvatar;

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({
    user: currentUserState,
    role: currentUserState.role,
    isLoading: false,
    isAuthenticated: true,
  }),
  authKeys: {
    me: () => ['auth', 'me'],
  },
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/api/endpoints/auth', () => ({
  uploadAvatar: vi.fn(),
  updateProfile: vi.fn(),
  changePassword: vi.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('ProfileScreen Avatar Upload (TC-AVATAR)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUserState = mockUserWithoutAvatar;
  });

  afterEach(() => {
    cleanup();
  });

  it('TC-AVATAR-01: hiển thị chữ cái đầu viết hoa khi chưa có avatarUrl', () => {
    currentUserState = mockUserWithoutAvatar;
    render(<ProfileScreen />, { wrapper: createWrapper() });

    // Chữ cái đầu 'T' từ 'Trần Văn Khách'
    expect(screen.getByText('T')).not.toBeNull();
    expect(screen.queryByRole('img', { name: mockUserWithoutAvatar.fullName })).toBeNull();
  });

  it('TC-AVATAR-02: hiển thị ảnh <img> với src khi người dùng đã có avatarUrl', () => {
    currentUserState = mockUserWithAvatar;
    render(<ProfileScreen />, { wrapper: createWrapper() });

    const img = screen.getByRole('img', { name: mockUserWithAvatar.fullName });
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toBe('https://example.com/avatar.png');
  });

  it('TC-AVATAR-03: từ chối file sai định dạng (ví dụ PDF) và thông báo lỗi format', () => {
    render(<ProfileScreen />, { wrapper: createWrapper() });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    const invalidFile = new File(['dummy content'], 'document.pdf', {
      type: 'application/pdf',
    });

    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    expect(uploadAvatar).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      'Định dạng tệp không được hỗ trợ. Vui lòng chọn ảnh JPG, PNG hoặc WebP.',
    );
  });

  it('TC-AVATAR-04: từ chối file quá dung lượng (> 2MB) và thông báo lỗi kích thước', () => {
    render(<ProfileScreen />, { wrapper: createWrapper() });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    // File 2.5 MB
    const largeFile = new File(['a'.repeat(2.5 * 1024 * 1024)], 'large-photo.jpg', {
      type: 'image/jpeg',
    });
    Object.defineProperty(largeFile, 'size', { value: 2.5 * 1024 * 1024 });

    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    expect(uploadAvatar).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      'Dung lượng ảnh vượt quá 2MB. Vui lòng chọn ảnh nhỏ hơn.',
    );
  });

  it('TC-AVATAR-05: chọn file hợp lệ (PNG <= 2MB) gọi uploadAvatar', async () => {
    const mockAuthResult: AuthResult = {
      user: { ...mockUserWithoutAvatar, avatarUrl: 'https://example.com/new-avatar.png' },
    };
    vi.mocked(uploadAvatar).mockResolvedValueOnce(mockAuthResult);

    render(<ProfileScreen />, { wrapper: createWrapper() });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const validFile = new File(['valid image data'], 'avatar.png', {
      type: 'image/png',
    });
    Object.defineProperty(validFile, 'size', { value: 500 * 1024 }); // 500 KB

    fireEvent.change(fileInput, { target: { files: [validFile] } });

    await waitFor(() => {
      expect(uploadAvatar).toHaveBeenCalledWith(validFile, expect.anything());
      expect(toast.success).toHaveBeenCalledWith('Cập nhật ảnh đại diện thành công');
    });
  });
});
