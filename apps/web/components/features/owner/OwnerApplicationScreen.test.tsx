// @vitest-environment jsdom
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OwnerApplicationScreen } from './OwnerApplicationScreen';
import { useAuth } from '@/lib/hooks/useAuth';
import { useMyOwnerApplication, useSubmitOwnerApplication } from '@/lib/hooks/useOwnerApplication';
import { ApiError } from '@/lib/api/errors';
import { SUPPORTED_BANKS } from '@/lib/utils/payment-qr';

const replaceMock = vi.fn();

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/lib/navigation/navigate', () => ({
  useAppRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/lib/hooks/useOwnerApplication', () => ({
  useMyOwnerApplication: vi.fn(),
  useSubmitOwnerApplication: vi.fn(),
}));

vi.mock('@/components/features/venue/VenueLocationMapWrapper', () => ({
  VenueLocationMapWrapper: () => <div data-testid="mock-map" />,
}));

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('OwnerApplicationScreen (CUS-17)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('hiển thị trạng thái pending nếu khách đã nộp hồ sơ chờ duyệt', () => {
    vi.mocked(useAuth).mockReturnValue({
      isLoading: false,
      user: { id: 'u-1', role: 'customer', phone: '0901234567' },
      role: 'customer',
    } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useMyOwnerApplication).mockReturnValue({
      isLoading: false,
      error: null,
      data: { id: 'app-1', status: 'pending', businessName: 'CLB Thanh Xuân' },
    } as unknown as ReturnType<typeof useMyOwnerApplication>);
    vi.mocked(useSubmitOwnerApplication).mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    } as unknown as ReturnType<typeof useSubmitOwnerApplication>);

    renderWithClient(<OwnerApplicationScreen />);
    expect(screen.getByText('pendingTitle')).not.toBeNull();
    expect(screen.getByText('CLB Thanh Xuân')).not.toBeNull();
  });

  it('gửi thành công hồ sơ đăng ký chủ sân với MST, ngân hàng và toạ độ', async () => {
    const mutateAsync = vi.fn().mockResolvedValueOnce({ id: 'app-new', status: 'pending' });
    vi.mocked(useAuth).mockReturnValue({
      isLoading: false,
      user: { id: 'u-1', role: 'customer', phone: '0912345678' },
      role: 'customer',
    } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useMyOwnerApplication).mockReturnValue({
      isLoading: false,
      error: new ApiError(404, 'NOT_FOUND', 'Chưa có hồ sơ'),
      data: undefined,
    } as unknown as ReturnType<typeof useMyOwnerApplication>);
    vi.mocked(useSubmitOwnerApplication).mockReturnValue({
      isPending: false,
      mutateAsync,
    } as unknown as ReturnType<typeof useSubmitOwnerApplication>);

    renderWithClient(<OwnerApplicationScreen />);

    fireEvent.change(screen.getByLabelText(/businessNameLabel/i), {
      target: { value: 'Tổ hợp Thể thao Đống Đa' },
    });
    fireEvent.change(screen.getByLabelText(/phoneLabel/i), {
      target: { value: '0912345678' },
    });
    fireEvent.change(screen.getByLabelText(/taxCodeLabel/i), {
      target: { value: '0123456789' },
    });
    fireEvent.change(screen.getByLabelText(/addressLabel/i), {
      target: { value: '12 Chùa Bộc, Đống Đa, Hà Nội' },
    });

    const bankSelect = screen.getByLabelText(/bankLabel/i) as HTMLSelectElement;
    fireEvent.change(bankSelect, { target: { value: SUPPORTED_BANKS[0]!.bin } });

    fireEvent.change(screen.getByLabelText(/accountNumberLabel/i), {
      target: { value: '123456789012' },
    });
    fireEvent.change(screen.getByLabelText(/accountHolderLabel/i), {
      target: { value: 'NGUYEN VAN CHU' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /submitButton/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          businessName: 'Tổ hợp Thể thao Đống Đa',
          phone: '0912345678',
          taxCode: '0123456789',
          bankBin: SUPPORTED_BANKS[0]!.bin,
          accountNo: '123456789012',
          accountName: 'NGUYEN VAN CHU',
        }),
      );
    });
  });
});
