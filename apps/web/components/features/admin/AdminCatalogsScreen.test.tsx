// @vitest-environment jsdom
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminCatalogsScreen } from './AdminCatalogsScreen';
import {
  useAmenitiesList,
  useCreateAmenity,
  useCreateSport,
  useDeleteAmenity,
  useDeleteSport,
  useSportsList,
} from '@/lib/hooks/useAdminCatalogs';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/hooks/useAdminCatalogs', () => ({
  useSportsList: vi.fn(),
  useCreateSport: vi.fn(),
  useDeleteSport: vi.fn(),
  useAmenitiesList: vi.fn(),
  useCreateAmenity: vi.fn(),
  useDeleteAmenity: vi.fn(),
}));

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('AdminCatalogsScreen (ADM-04, ADM-05)', () => {
  const createSportMutate = vi.fn();
  const deleteSportMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSportsList).mockReturnValue({
      isPending: false,
      isError: false,
      data: [
        { id: 's-1', name: 'Cầu lông', slug: 'cau-long', icon: 'badminton', venueCount: 3 },
        { id: 's-2', name: 'Bóng đá', slug: 'bong-da', icon: 'soccer', venueCount: 0 },
      ],
    } as unknown as ReturnType<typeof useSportsList>);
    vi.mocked(useCreateSport).mockReturnValue({
      isPending: false,
      mutateAsync: createSportMutate,
    } as unknown as ReturnType<typeof useCreateSport>);
    vi.mocked(useDeleteSport).mockReturnValue({
      isPending: false,
      mutateAsync: deleteSportMutate,
    } as unknown as ReturnType<typeof useDeleteSport>);

    vi.mocked(useAmenitiesList).mockReturnValue({
      isPending: false,
      isError: false,
      data: [{ id: 'a-1', name: 'Bãi giữ xe', slug: 'bai-giu-xe', icon: 'parking', venueCount: 2 }],
    } as unknown as ReturnType<typeof useAmenitiesList>);
    vi.mocked(useCreateAmenity).mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    } as unknown as ReturnType<typeof useCreateAmenity>);
    vi.mocked(useDeleteAmenity).mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    } as unknown as ReturnType<typeof useDeleteAmenity>);
  });

  afterEach(() => {
    cleanup();
  });

  it('hiển thị danh sách môn thể thao, chuyển tab tiện ích và mở dialog thêm môn làm mờ icon đã cấu hình', async () => {
    renderWithClient(<AdminCatalogsScreen />);

    expect(screen.getAllByText('Cầu lông').length).toBeGreaterThan(0);
    expect(screen.getByText('3 cơ sở')).not.toBeNull();

    // Mở form thêm môn thể thao -> Icon badminton/soccer phải bị disable & gắn nhãn "Đã có"
    fireEvent.click(screen.getByRole('button', { name: /Thêm môn thể thao/i }));
    await waitFor(() => {
      expect(screen.getAllByText('Đã có').length).toBeGreaterThanOrEqual(2);
    });
    const badmintonBtn = screen.getByRole('button', { name: /Cầu lông/i }) as HTMLButtonElement;
    expect(badmintonBtn.disabled).toBe(true);

    // Đóng dialog và chuyển sang tab Tiện ích cơ sở
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'cancel' }));
    const amenitiesTab = screen.getByRole('tab', { name: /Tiện ích cơ sở/i });
    fireEvent.mouseDown(amenitiesTab);
    fireEvent.click(amenitiesTab);

    await waitFor(() => {
      expect(screen.getByText('Bãi giữ xe')).not.toBeNull();
    });
  });

  it('xác nhận xoá môn thể thao chưa sử dụng gọi deleteSport', async () => {
    deleteSportMutate.mockResolvedValueOnce(undefined);
    renderWithClient(<AdminCatalogsScreen />);

    const deleteBtns = screen.getAllByTitle('Xoá môn thể thao');
    fireEvent.click(deleteBtns[1]!);

    await waitFor(() => expect(screen.getByRole('dialog')).not.toBeNull());
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Xoá môn thể thao' }));

    await waitFor(() => {
      expect(deleteSportMutate).toHaveBeenCalledWith('s-2');
    });
  });
});
