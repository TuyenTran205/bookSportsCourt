// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import GoogleAuthCallbackPage from './page';
import { useAuth } from '@/lib/hooks/useAuth';

const mockReplace = vi.fn();

vi.mock('@/lib/navigation/navigate', () => ({
  useAppRouter: () => ({ replace: mockReplace }),
}));

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

describe('GoogleAuthCallbackPage (CUS-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('gọi refetchMe và chuyển hướng về trang chủ sau OAuth callback', async () => {
    const refetchMe = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue({ refetchMe } as unknown as ReturnType<typeof useAuth>);

    render(<GoogleAuthCallbackPage />);
    expect(screen.getByText('Đang xác thực tài khoản Google…')).not.toBeNull();

    await waitFor(() => {
      expect(refetchMe).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
  });
});
