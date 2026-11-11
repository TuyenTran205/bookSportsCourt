// @vitest-environment jsdom
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';

import { CheckoutPaymentSection } from './CheckoutPaymentSection';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
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

const mockPayment = {
  id: 'pay-sec-1',
  amount: 150000,
  transferCode: 'BSC-TESTQR',
  bankAccount: {
    bankBin: '970422', // MB Bank
    accountNo: '999888777',
    accountName: 'CONG TY CP BSC',
  },
};

describe('CheckoutPaymentSection Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('render thông tin tài khoản và mã chuyển khoản', () => {
    render(<CheckoutPaymentSection payment={mockPayment} />);

    expect(screen.getByText('Thông tin chuyển khoản ngân hàng')).toBeDefined();
    expect(screen.getByText('999888777')).toBeDefined();
    expect(screen.getByText('CONG TY CP BSC')).toBeDefined();
    expect(screen.getByText('BSC-TESTQR')).toBeDefined();
  });

  it('bấm nút sao chép chuyển mã vào clipboard', async () => {
    render(<CheckoutPaymentSection payment={mockPayment} />);

    const copyBtn = screen.getByRole('button', { name: /Sao chép Nội dung chuyển khoản/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('BSC-TESTQR');
      expect(toast.success).toHaveBeenCalledWith('Đã sao chép vào bộ nhớ tạm');
    });
  });
});
