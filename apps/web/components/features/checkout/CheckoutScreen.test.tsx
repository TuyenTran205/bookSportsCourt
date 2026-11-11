// @vitest-environment jsdom
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';

import type { BookingDetail } from '@bsc/shared';
import type { HoldResult } from '@/lib/api/endpoints/bookings';

import { CheckoutScreen } from './CheckoutScreen';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: () => ({ holdId: 'b-checkout-1' }),
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock('@/lib/navigation/navigate', () => ({
  useAppRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      title: 'Thanh toán giữ chỗ',
      subtitle: 'Hoàn tất chuyển khoản tiền cọc',
      breadcrumb: 'Thanh toán giữ chỗ',
      orderSummary: 'Tóm tắt đơn giữ chỗ',
      court: 'Sân',
      matchDate: 'Ngày chơi',
      matchTime: 'Khung giờ',
      totalPrice: 'Tổng giá trị đơn',
      depositRequired: 'Số tiền cọc cần chuyển ngay',
      remainingAtVenue: 'Còn lại thanh toán tại sân',
      remainingAtVenueHint: 'Thanh toán cho chủ sân khi nhận sân',
      cancellationPolicyTitle: 'Chính sách huỷ & hoàn cọc',
      cancellationPolicyNote: 'Đơn giữ chỗ quá 10 phút sẽ tự động huỷ bỏ.',
      transferInfoTitle: 'Thông tin chuyển khoản ngân hàng',
      scanQrHint: 'Mở ứng dụng ngân hàng bất kỳ để quét mã VietQR',
      bankName: 'Ngân hàng thụ hưởng',
      accountNo: 'Số tài khoản',
      accountName: 'Chủ tài khoản',
      amount: 'Số tiền chuyển',
      transferCode: 'Nội dung chuyển khoản',
      transferCodeWarning: 'BẮT BUỘC ghi đúng nội dung này để hệ thống đối soát tự động.',
      copy: 'Sao chép',
      copied: 'Đã sao chép vào bộ nhớ tạm',
      uploadProofTitle: 'Xác nhận đã chuyển khoản',
      uploadProofHint: 'Tải ảnh chụp màn hình giao dịch chuyển khoản',
      chooseImage: 'Chọn ảnh biên lai',
      changeImage: 'Chọn ảnh khác',
      confirmPayment: 'Xác nhận đã chuyển khoản',
      submitting: 'Đang gửi minh chứng...',
      submitSuccess: 'Đã gửi minh chứng thanh toán thành công!',
      expiredTitle: 'Thời gian giữ chỗ đã kết thúc',
      expiredDesc: 'Khung giờ bạn chọn đã tự động được trả lại trạng thái trống.',
      reselectSlot: 'Chọn lại khung giờ',
      findOtherVenues: 'Tìm sân khác',
      pendingTitle: 'Đơn đặt sân đang chờ chủ sân duyệt',
      pendingDesc: 'Bạn đã nộp minh chứng thanh toán thành công.',
      viewBookingDetail: 'Xem chi tiết đơn đặt',
    };
    return translations[key] ?? key;
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

const mockBookingData: BookingDetail = {
  id: 'b-checkout-1',
  courtId: 'court-1',
  customerId: 'cust-1',
  source: 'online',
  guestName: null,
  guestPhone: null,
  during: {
    start: '2026-10-15T08:00:00+07:00',
    end: '2026-10-15T09:30:00+07:00',
  },
  status: 'held',
  totalPrice: 300000,
  depositAmount: 150000,
  note: null,
  expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  cancelledAt: null,
  cancelReason: null,
  createdAt: '2026-10-14T10:00:00+07:00',
  court: {
    id: 'court-1',
    name: 'Sân 1 (Sân 5 người)',
    venue: {
      id: 'venue-1',
      name: 'Sân Bóng Thăng Long',
      slug: 'san-bong-thang-long',
      address: '123 Đường Láng, Hà Nội',
    },
  },
  customer: {
    id: 'cust-1',
    fullName: 'Trần Văn Khách',
    phone: '0912***456',
    email: 'khach@example.com',
  },
  payment: null,
  review: null,
};

const mockHoldData: HoldResult = {
  booking: mockBookingData,
  remainingMs: 600000,
  payment: {
    id: 'pay-1',
    amount: 150000,
    transferCode: 'BSC-A1B2C3',
    bankAccount: {
      bankBin: '970422', // MB Bank
      accountNo: '0123456789',
      accountName: 'CONG TY BSC',
    },
  },
};

let currentBooking: BookingDetail | null = mockBookingData;
let currentHold: HoldResult | null = mockHoldData;
let mockUploadFn = vi.fn().mockResolvedValue({ id: 'pay-1', status: 'pending' });

vi.mock('@/lib/hooks/useBookings', () => ({
  bookingKeys: {
    all: ['bookings'],
    detail: (id: string) => ['bookings', 'detail', id],
    hold: (id: string) => ['bookings', 'hold', id],
  },
  useBookingDetail: () => ({
    data: currentBooking,
    isLoading: false,
    isError: !currentBooking,
    refetch: vi.fn(),
  }),
  useHoldInfo: () => ({
    data: currentHold,
    isLoading: false,
    refetch: vi.fn(),
  }),
  useUploadProof: () => ({
    mutateAsync: mockUploadFn,
    isPending: false,
  }),
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('CheckoutScreen (TC-CHK)', () => {
  beforeEach(() => {
    currentBooking = { ...mockBookingData };
    currentHold = { ...mockHoldData };
    mockUploadFn = vi.fn().mockResolvedValue({ id: 'pay-1', status: 'pending' });
    mockPush.mockClear();
    vi.clearAllMocks();

    // Mock URL object methods in jsdom
    if (!window.URL.createObjectURL) {
      window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-image-url');
    } else {
      vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:mock-image-url');
    }
    if (!window.URL.revokeObjectURL) {
      window.URL.revokeObjectURL = vi.fn();
    } else {
      vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});
    }

    // Mock clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('TC-CHK-01: Hiển thị tóm tắt đơn giữ chỗ đầy đủ thông tin', () => {
    renderWithClient(<CheckoutScreen />);

    expect(screen.getAllByText('Sân Bóng Thăng Long').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('123 Đường Láng, Hà Nội')).toBeDefined();
    expect(screen.getByText('Sân 1 (Sân 5 người)')).toBeDefined();
    expect(screen.getAllByText('Tóm tắt đơn giữ chỗ').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Số tiền cọc cần chuyển ngay')).toBeDefined();
  });

  it('TC-CHK-02: Hiển thị thông tin ngân hàng và mã chuyển khoản', () => {
    renderWithClient(<CheckoutScreen />);

    expect(screen.getByText('0123456789')).toBeDefined();
    expect(screen.getByText('CONG TY BSC')).toBeDefined();
    expect(screen.getByText('BSC-A1B2C3')).toBeDefined();
    expect(
      screen.getByText('BẮT BUỘC ghi đúng nội dung này để hệ thống đối soát tự động.'),
    ).toBeDefined();
  });

  it('TC-CHK-03: Sao chép thông tin ngân hàng khi bấm nút sao chép', async () => {
    renderWithClient(<CheckoutScreen />);

    const copyBtn = screen.getByRole('button', { name: /Sao chép Số tài khoản/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('0123456789');
      expect(toast.success).toHaveBeenCalledWith('Đã sao chép vào bộ nhớ tạm');
    });
  });

  it('TC-CHK-04: Từ chối file biên lai không hợp lệ (> 5MB hoặc sai định dạng)', async () => {
    renderWithClient(<CheckoutScreen />);

    const input = screen.getByLabelText(/Chọn ảnh biên lai/i) as HTMLInputElement;

    // File sai định dạng (.pdf)
    const invalidFile = new File(['dummy'], 'test.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [invalidFile] } });

    expect(
      screen.getByText(/Chỉ chấp nhận tệp định dạng ảnh/i),
    ).toBeDefined();
  });

  it('TC-CHK-05: Gửi minh chứng thành công và kích hoạt điều hướng', async () => {
    renderWithClient(<CheckoutScreen />);

    const input = screen.getByLabelText(/Chọn ảnh biên lai/i) as HTMLInputElement;
    const validFile = new File(['image-content'], 'receipt.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [validFile] } });

    const submitBtn = screen.getByRole('button', { name: /Xác nhận đã chuyển khoản/i });
    expect(submitBtn.hasAttribute('disabled')).toBe(false);

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockUploadFn).toHaveBeenCalledWith(validFile);
      expect(toast.success).toHaveBeenCalledWith('Đã gửi minh chứng thanh toán thành công!');
    });
  });

  it('TC-CHK-06: Xử lý khi giữ chỗ hết hạn (status === expired)', () => {
    currentBooking = {
      ...mockBookingData,
      status: 'expired',
    };

    renderWithClient(<CheckoutScreen />);

    expect(screen.getByText('Thời gian giữ chỗ đã kết thúc')).toBeDefined();
    expect(
      screen.getByText('Khung giờ bạn chọn đã tự động được trả lại trạng thái trống.'),
    ).toBeDefined();

    const reselectLink = screen.getByRole('link', { name: /Chọn lại khung giờ/i });
    expect(reselectLink.getAttribute('href')).toBe('/venues/san-bong-thang-long');

    const findOtherLink = screen.getByRole('link', { name: /Tìm sân khác/i });
    expect(findOtherLink.getAttribute('href')).toBe('/venues');
  });
});
