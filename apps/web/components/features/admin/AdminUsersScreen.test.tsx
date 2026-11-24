// @vitest-environment jsdom
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@bsc/shared';

import { AdminUsersScreen } from './AdminUsersScreen';
import { useAdminUsers, useSetUserStatus } from '@/lib/hooks/useAdminUsers';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/hooks/useAdminUsers', () => ({
  useAdminUsers: vi.fn(),
  useSetUserStatus: vi.fn(),
}));

vi.mock('@/components/features/admin/UserRoleDialog', () => ({
  UserRoleDialog: () => null,
}));

const sampleUsers: User[] = [
  {
    id: 'u-cust',
    email: 'cust@example.com',
    fullName: 'Khách Hàng A',
    phone: '0901234567',
    avatarUrl: null,
    role: 'customer',
    status: 'active',
    createdAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 'u-susp',
    email: 'locked@example.com',
    fullName: 'Chủ Sân Bị Khoá',
    phone: '0909998887',
    avatarUrl: null,
    role: 'owner',
    status: 'suspended',
    createdAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 'u-adm',
    email: 'admin@example.com',
    fullName: 'Admin Hệ Thống',
    phone: null,
    avatarUrl: null,
    role: 'admin',
    status: 'active',
    createdAt: '2026-10-01T00:00:00Z',
  },
];

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('AdminUsersScreen (ADM-03)', () => {
  const setStatusMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAdminUsers).mockReturnValue({
      isPending: false,
      isError: false,
      data: {
        data: sampleUsers,
        meta: { total: 3, page: 1, limit: 10, totalPages: 1 },
      },
    } as unknown as ReturnType<typeof useAdminUsers>);
    vi.mocked(useSetUserStatus).mockReturnValue({
      isPending: false,
      mutateAsync: setStatusMutate,
    } as unknown as ReturnType<typeof useSetUserStatus>);
  });

  afterEach(() => {
    cleanup();
  });

  it('khoá nút khoá đối với Admin và cho phép Admin khoá/mở khoá Customer & Owner', async () => {
    setStatusMutate.mockResolvedValue({});
    renderWithClient(<AdminUsersScreen />);

    expect(screen.getAllByText('Khách Hàng A').length).toBeGreaterThan(0);

    // Nút Khoá cho Admin bị disabled
    const adminLockBtn = screen.getByTitle('Không thể khoá Admin') as HTMLButtonElement;
    expect(adminLockBtn.disabled).toBe(true);

    // Bấm Khoá Khách Hàng A
    const lockBtns = screen.getAllByRole('button', { name: /Khoá$/i });
    fireEvent.click(lockBtns[0]!);

    await waitFor(() => expect(screen.getByRole('dialog')).not.toBeNull());
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Khoá tài khoản' }));

    await waitFor(() => {
      expect(setStatusMutate).toHaveBeenCalledWith({ id: 'u-cust', status: 'suspended' });
    });

    // Bấm Mở khoá Chủ Sân Bị Khoá
    const unlockBtns = screen.getAllByRole('button', { name: /Mở khoá/i });
    fireEvent.click(unlockBtns[0]!);
    await waitFor(() => expect(screen.getByRole('dialog')).not.toBeNull());
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Mở khoá' }));

    await waitFor(() => {
      expect(setStatusMutate).toHaveBeenCalledWith({ id: 'u-susp', status: 'active' });
    });
  });
});
