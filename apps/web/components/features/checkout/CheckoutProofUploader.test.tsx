// @vitest-environment jsdom
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';

import { CheckoutProofUploader } from './CheckoutProofUploader';

const mockMutateAsync = vi.fn();
vi.mock('@/lib/hooks/useBookings', () => ({
  useUploadProof: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      uploadProofTitle: 'Xác nhận đã chuyển khoản',
      uploadProofHint: 'Tải ảnh chụp màn hình giao dịch chuyển khoản',
      chooseImage: 'Chọn ảnh biên lai',
      changeImage: 'Chọn ảnh khác',
      confirmPayment: 'Xác nhận đã chuyển khoản',
      submitting: 'Đang gửi minh chứng...',
      submitSuccess: 'Đã gửi minh chứng thanh toán thành công!',
    };
    return map[key] ?? key;
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

describe('CheckoutProofUploader Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue({ id: 'p-1', status: 'pending' });

    if (!window.URL.createObjectURL) {
      window.URL.createObjectURL = vi.fn().mockReturnValue('blob:preview-url');
    } else {
      vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:preview-url');
    }
    if (!window.URL.revokeObjectURL) {
      window.URL.revokeObjectURL = vi.fn();
    } else {
      vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});
    }
  });

  it('nút xác nhận disabled khi chưa chọn ảnh', () => {
    render(<CheckoutProofUploader bookingId="b-up-1" />);

    const submitBtn = screen.getByRole('button', { name: /Xác nhận đã chuyển khoản/i });
    expect(submitBtn.hasAttribute('disabled')).toBe(true);
  });

  it('báo lỗi khi chọn file không phải ảnh', () => {
    render(<CheckoutProofUploader bookingId="b-up-1" />);

    const input = screen.getByLabelText(/Chọn ảnh biên lai/i);
    const nonImageFile = new File(['text'], 'doc.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [nonImageFile] } });

    expect(screen.getByText(/Chỉ chấp nhận tệp định dạng ảnh/i)).toBeDefined();
  });

  it('chọn ảnh hợp lệ mở khóa nút xác nhận và gọi upload khi bấm', async () => {
    const onSuccess = vi.fn();
    render(<CheckoutProofUploader bookingId="b-up-1" onSuccess={onSuccess} />);

    const input = screen.getByLabelText(/Chọn ảnh biên lai/i);
    const imgFile = new File(['image-bytes'], 'payment.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [imgFile] } });

    const submitBtn = screen.getByRole('button', { name: /Xác nhận đã chuyển khoản/i });
    expect(submitBtn.hasAttribute('disabled')).toBe(false);

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(imgFile);
      expect(toast.success).toHaveBeenCalledWith('Đã gửi minh chứng thanh toán thành công!');
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
