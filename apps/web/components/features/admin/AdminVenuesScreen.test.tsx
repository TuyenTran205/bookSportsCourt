// @vitest-environment jsdom
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';

import { AdminVenuesScreen } from './AdminVenuesScreen';
import * as adminEndpoints from '@/lib/api/endpoints/admin';
import * as ownerEndpoints from '@/lib/api/endpoints/owner';

const mockVenues: adminEndpoints.AdminVenueRow[] = [
  {
    id: 'venue-1',
    name: 'CLB Cầu Lông Cầu Giấy',
    slug: 'clb-cau-long-cau-giay',
    address: '35 Dịch Vọng Hậu, Cầu Giấy, Hà Nội',
    lat: 21.0285,
    lng: 105.8542,
    provinceId: 'p-1',
    districtId: 'd-1',
    ownerId: 'owner-1',
    ownerName: 'Trần Văn Đức',
    status: 'approved',
    coverUrl: null,
    ratingAvg: 4.8,
    reviewCount: 12,
    fromPrice: 100000,
    sports: [{ id: 's-1', name: 'Cầu lông', slug: 'cau-long', icon: null }],
    amenities: [],
    courts: [
      { id: 'c-1', name: 'Sân 1', sportId: 's-1', status: 'active', description: null },
    ],
    province: { id: 'p-1', code: '01', name: 'Hà Nội', slug: 'ha-noi' },
    district: { id: 'd-1', name: 'Cầu Giấy', slug: 'cau-giay', provinceId: 'p-1' },
  },
  {
    id: 'venue-2',
    name: 'Sân Bóng Đá Mini Nam Sài Gòn',
    slug: 'san-bong-da-mini-nam-sai-gon',
    address: '48 Nguyễn Thị Thập, Quận 7, TP.HCM',
    lat: 10.7626,
    lng: 106.6602,
    provinceId: 'p-2',
    districtId: 'd-2',
    ownerId: 'owner-2',
    ownerName: 'Nguyễn Văn Nam',
    status: 'pending',
    coverUrl: null,
    ratingAvg: 0,
    reviewCount: 0,
    fromPrice: null,
    sports: [{ id: 's-2', name: 'Bóng đá', slug: 'bong-da', icon: null }],
    amenities: [],
    courts: [],
    province: { id: 'p-2', code: '79', name: 'TP. Hồ Chí Minh', slug: 'tp-ho-chi-minh' },
    district: { id: 'd-2', name: 'Quận 7', slug: 'quan-7', provinceId: 'p-2' },
  },
];

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/api/endpoints/admin', async (importOriginal) => {
  const actual = await importOriginal<typeof adminEndpoints>();
  return {
    ...actual,
    listAdminVenues: vi.fn(),
    reviewVenue: vi.fn(),
    listAdminUsers: vi.fn().mockResolvedValue({
      data: [
        { id: 'owner-1', fullName: 'Trần Văn Đức', email: 'duc@example.com', role: 'owner' },
        { id: 'owner-2', fullName: 'Nguyễn Văn Nam', email: 'nam@example.com', role: 'owner' },
      ],
      meta: { total: 2, page: 1, limit: 100, totalPages: 1 },
    }),
  };
});

vi.mock('@/lib/api/endpoints/owner', async (importOriginal) => {
  const actual = await importOriginal<typeof ownerEndpoints>();
  return {
    ...actual,
    createOwnerVenue: vi.fn().mockResolvedValue({ id: 'new-venue-id', name: 'Sân Mới' }),
    updateOwnerVenue: vi.fn().mockResolvedValue({ id: 'venue-1', name: 'Sân Cập Nhật' }),
    deleteVenue: vi.fn().mockResolvedValue(undefined),
    uploadVenueImage: vi.fn().mockResolvedValue({ id: 'img-1', url: 'https://example.com/img.jpg' }),
  };
});

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('AdminVenuesScreen Features (ADM-VENUES-EXT)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminEndpoints.listAdminVenues).mockResolvedValue({
      data: mockVenues,
      meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
    });
  });

  it('TC-ADM-01: Hiển thị nút "+ Thêm cơ sở", nút Chỉnh sửa và nút Xóa mềm trên bảng cơ sở', async () => {
    renderWithClient(<AdminVenuesScreen />);

    // Kiểm tra nút Thêm cơ sở trên Header và các hàng dữ liệu
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Thêm cơ sở/i })).toBeDefined();
      expect(screen.getByText('CLB Cầu Lông Cầu Giấy')).toBeDefined();
      expect(screen.getByText('Sân Bóng Đá Mini Nam Sài Gòn')).toBeDefined();
    });

    // Kiểm tra các nút hành động (Xem, Sửa, Xóa)
    const editButtons = screen.getAllByTitle('Chỉnh sửa thông tin cơ sở');
    expect(editButtons.length).toBe(2);

    const deleteButtons = screen.getAllByTitle('Xóa mềm cơ sở');
    expect(deleteButtons.length).toBe(2);
  });

  it('TC-ADM-02: Bấm "+ Thêm cơ sở" mở dialog tạo cơ sở hộ chủ sân với quyền Admin', async () => {
    renderWithClient(<AdminVenuesScreen />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Thêm cơ sở/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /Thêm cơ sở/i }));

    // Dialog mở ra, có phần chọn chủ sân phụ trách
    await waitFor(() => {
      expect(screen.getByText(/Chủ sân sở hữu/i)).toBeDefined();
      expect(screen.getByText(/-- Chọn chủ sân phụ trách --/i)).toBeDefined();
    });
  });

  it('TC-ADM-03: Bấm nút Chỉnh sửa (Pencil) mở dialog sửa thông tin cơ sở', async () => {
    renderWithClient(<AdminVenuesScreen />);

    await waitFor(() => {
      expect(screen.getAllByTitle('Chỉnh sửa thông tin cơ sở').length).toBe(2);
    });

    fireEvent.click(screen.getAllByTitle('Chỉnh sửa thông tin cơ sở')[0]!);

    // Dialog mở ra, prefilled với tên cơ sở
    await waitFor(() => {
      const nameInput = screen.getByDisplayValue('CLB Cầu Lông Cầu Giấy');
      expect(nameInput).toBeDefined();
    });
  });

  it('TC-ADM-04: Bấm nút Xóa mềm (Trash2) mở modal xác nhận và thực hiện soft delete', async () => {
    renderWithClient(<AdminVenuesScreen />);

    await waitFor(() => {
      expect(screen.getAllByTitle('Xóa mềm cơ sở').length).toBe(2);
    });

    fireEvent.click(screen.getAllByTitle('Xóa mềm cơ sở')[0]!);

    // Modal xác nhận xóa mềm hiển thị
    await waitFor(() => {
      expect(screen.getByText(/Xác nhận xóa mềm cơ sở/i)).toBeDefined();
      expect(screen.getAllByText(/CLB Cầu Lông Cầu Giấy/i).length).toBeGreaterThan(1);
      expect(screen.getByRole('button', { name: /Xác nhận xóa/i })).toBeDefined();
    });

    // Bấm xác nhận xóa
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận xóa/i }));

    await waitFor(() => {
      expect(ownerEndpoints.deleteVenue).toHaveBeenCalledWith('venue-1');
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Đã xóa cơ sở'));
    });
  });

  it('TC-ADM-05: Xem chi tiết cơ sở có nút "Chỉnh sửa" và "Xóa mềm cơ sở" trong drawer', async () => {
    renderWithClient(<AdminVenuesScreen />);

    await waitFor(() => {
      expect(screen.getAllByTitle('Xem chi tiết cơ sở').length).toBe(2);
    });

    // Bấm xem chi tiết cơ sở đầu tiên
    fireEvent.click(screen.getAllByTitle('Xem chi tiết cơ sở')[0]!);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Xóa mềm cơ sở/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /Chỉnh sửa/i })).toBeDefined();
    });
  });
});
