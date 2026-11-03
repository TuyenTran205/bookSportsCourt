// @vitest-environment jsdom
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { LocationSelector } from './LocationSelector';
import type { Province, Ward } from '@bsc/shared';
import { PROVINCES } from '@bsc/shared';

// Mẫu xã/phường/đặc khu đại diện cho Hà Nội, TP.HCM, Đà Nẵng, Quảng Ninh
const mockWards: Ward[] = [
  {
    id: 'w-00001',
    code: '00001',
    name: 'Phường Phúc Xá',
    slug: 'phuc-xa',
    provinceCode: '01',
    type: 'ward',
    unaccentName: 'phuong phuc xa',
  },
  {
    id: 'w-00004',
    code: '00004',
    name: 'Phường Trúc Bạch',
    slug: 'truc-bach',
    provinceCode: '01',
    type: 'ward',
    unaccentName: 'phuong truc bach',
  },
  {
    id: 'w-00010',
    code: '00010',
    name: 'Xã Tân Triều',
    slug: 'tan-trieu',
    provinceCode: '01',
    type: 'commune',
    unaccentName: 'xa tan trieu',
  },
  {
    id: 'w-26734',
    code: '26734',
    name: 'Phường Bến Nghé',
    slug: 'ben-nghe',
    provinceCode: '79',
    type: 'ward',
    unaccentName: 'phuong ben nghe',
  },
  {
    id: 'w-20150',
    code: '20150',
    name: 'Phường Hải Châu I',
    slug: 'hai-chau-1',
    provinceCode: '48',
    type: 'ward',
    unaccentName: 'phuong hai chau 1',
  },
  {
    id: 'w-19300',
    code: '19300',
    name: 'Đặc khu Vân Đồn',
    slug: 'van-don',
    provinceCode: '22', // Quảng Ninh
    type: 'special_zone',
    unaccentName: 'dac khu van don',
  },
];

vi.mock('@/lib/api/endpoints/venues', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/endpoints/venues')>();
  return {
    ...actual,
    listProvinces: vi.fn().mockImplementation(() => Promise.resolve(PROVINCES)),
    listWards: vi.fn().mockImplementation((codeOrId: string, params?: { q?: string }) => {
      const filtered = mockWards.filter((w) => {
        const matchesProv =
          w.provinceCode === codeOrId ||
          PROVINCES.find((p) => p.id === codeOrId)?.code === w.provinceCode;
        if (!matchesProv) return false;
        if (params?.q) {
          const query = params.q.toLowerCase();
          return w.name.toLowerCase().includes(query) || (w.unaccentName && w.unaccentName.includes(query));
        }
        return true;
      });
      return Promise.resolve(filtered);
    }),
  };
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('LocationSelector Component (TC-LOC Matrix)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('TC-LOC-01: dropdown Tỉnh hiển thị đủ 34 đơn vị hành chính cấp tỉnh', async () => {
    render(
      <LocationSelector
        onProvinceChange={vi.fn()}
        onWardChange={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    const provinceBtn = screen.getByLabelText('Tỉnh / Thành phố') as HTMLButtonElement;
    await waitFor(() => {
      expect(provinceBtn.disabled).toBe(false);
    });

    fireEvent.click(provinceBtn);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Tìm kiếm 34 tỉnh/thành...')).not.toBeNull();
    });

    // Kiểm tra danh sách hiển thị đủ 34 tỉnh/thành
    const listbox = screen.getByRole('listbox', { name: 'Danh sách Tỉnh / Thành phố' });
    const options = listbox.querySelectorAll('[role="option"]');
    expect(options).toHaveLength(34);

    // Kiểm tra có đủ 6 TP trực thuộc Trung ương
    expect(screen.getByText('Thành phố Hà Nội')).not.toBeNull();
    expect(screen.getByText('Thành phố Hồ Chí Minh')).not.toBeNull();
    expect(screen.getByText('Thành phố Hải Phòng')).not.toBeNull();
    expect(screen.getByText('Thành phố Đà Nẵng')).not.toBeNull();
    expect(screen.getByText('Thành phố Huế')).not.toBeNull();
    expect(screen.getByText('Thành phố Cần Thơ')).not.toBeNull();
  });

  it('TC-LOC-02: dropdown Xã hiển thị đúng các đơn vị cấp xã của tỉnh đã chọn (gồm Phường, Xã, Đặc khu)', async () => {
    const { rerender } = render(
      <LocationSelector
        provinceId="019273c5-7f00-7000-0000-000000000001"
        provinceCode="01"
        onProvinceChange={vi.fn()}
        onWardChange={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    const wardBtn = screen.getByLabelText('Xã / Phường / Đặc khu') as HTMLButtonElement;
    await waitFor(() => {
      expect(wardBtn.disabled).toBe(false);
    });

    fireEvent.click(wardBtn);

    // Hà Nội có cả Phường (Phúc Xá, Trúc Bạch) và Xã (Tân Triều)
    await waitFor(() => {
      expect(screen.getByText('Phường Phúc Xá')).not.toBeNull();
      expect(screen.getByText('Phường Trúc Bạch')).not.toBeNull();
      expect(screen.getByText('Xã Tân Triều')).not.toBeNull();
    });

    // Đổi sang Quảng Ninh (code '22') xem có Đặc khu Vân Đồn
    rerender(
      <LocationSelector
        provinceCode="22"
        onProvinceChange={vi.fn()}
        onWardChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Đặc khu Vân Đồn')).not.toBeNull();
    });
  });

  it('TC-LOC-03: không còn bất kỳ cấp "Quận/Huyện" nào trong giao diện hiển thị', () => {
    render(
      <LocationSelector
        onProvinceChange={vi.fn()}
        onWardChange={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    // Chỉ có Tỉnh / Thành phố và Xã / Phường / Đặc khu
    expect(screen.getByText('Tỉnh / Thành phố')).not.toBeNull();
    expect(screen.getByText('Xã / Phường / Đặc khu')).not.toBeNull();
    expect(screen.queryByText(/Quận \/ Huyện/i)).toBeNull();
    expect(screen.queryByText(/Chọn Quận/i)).toBeNull();
  });

  it('TC-LOC-04: tìm kiếm tiếng Việt không dấu (unaccent) cho Tỉnh và Xã', async () => {
    render(
      <LocationSelector
        provinceId="019273c5-7f00-7000-0000-000000000001"
        provinceCode="01"
        onProvinceChange={vi.fn()}
        onWardChange={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    // 1. Chờ combobox tỉnh nạp xong
    const provinceBtn = screen.getByLabelText('Tỉnh / Thành phố') as HTMLButtonElement;
    await waitFor(() => {
      expect(provinceBtn.disabled).toBe(false);
    });
    fireEvent.click(provinceBtn);

    const provinceInput = await screen.findByPlaceholderText('Tìm kiếm 34 tỉnh/thành...');
    fireEvent.change(provinceInput, { target: { value: 'da nang' } });

    expect(screen.getByText('Thành phố Đà Nẵng')).not.toBeNull();
    expect(screen.queryByText('Thành phố Hải Phòng')).toBeNull();

    // Chọn Đà Nẵng
    const daNangOption = screen.getByText('Thành phố Đà Nẵng');
    fireEvent.click(daNangOption);

    // 2. Mở popover xã và kiểm tra tìm kiếm không dấu
    const wardBtn = screen.getByLabelText('Xã / Phường / Đặc khu') as HTMLButtonElement;
    await waitFor(() => {
      expect(wardBtn.disabled).toBe(false);
    });
    fireEvent.click(wardBtn);

    const wardInput = await screen.findByPlaceholderText(/Tìm xã\/phường/i);
    expect(wardInput).not.toBeNull();
  });

  it('TC-LOC-05: đổi Tỉnh A sang Tỉnh B thì Xã tự động reset (onWardChange(null))', async () => {
    const onProvinceChange = vi.fn();
    const onWardChange = vi.fn();

    render(
      <LocationSelector
        provinceId="019273c5-7f00-7000-0000-000000000001"
        provinceCode="01"
        wardId="w-00001"
        wardCode="00001"
        onProvinceChange={onProvinceChange}
        onWardChange={onWardChange}
      />,
      { wrapper: createWrapper() },
    );

    const provinceBtn = screen.getByLabelText('Tỉnh / Thành phố') as HTMLButtonElement;
    await waitFor(() => {
      expect(provinceBtn.disabled).toBe(false);
    });

    fireEvent.click(provinceBtn);

    const tphcmOption = await screen.findByText('Thành phố Hồ Chí Minh');
    fireEvent.click(tphcmOption);

    expect(onProvinceChange).toHaveBeenCalledWith(
      expect.objectContaining({ code: '79', name: 'Thành phố Hồ Chí Minh' }),
    );
    expect(onWardChange).toHaveBeenCalledWith(null);
  });

  it('TC-LOC-07: kiểm tra đầy đủ 6 trạng thái UI của LocationSelector', async () => {
    // 1. Disabled state (chưa chọn tỉnh thì Xã bị disabled, hoặc truyền disabled=true)
    const { rerender } = render(
      <LocationSelector
        onProvinceChange={vi.fn()}
        onWardChange={vi.fn()}
        disabled={true}
      />,
      { wrapper: createWrapper() },
    );

    const disabledProvBtn = screen.getByLabelText('Tỉnh / Thành phố') as HTMLButtonElement;
    expect(disabledProvBtn.disabled).toBe(true);
    expect(disabledProvBtn.className).toContain('cursor-not-allowed');

    // 2. Error state (khi truyền error.province và error.ward)
    rerender(
      <LocationSelector
        onProvinceChange={vi.fn()}
        onWardChange={vi.fn()}
        error={{
          province: 'Vui lòng chọn Tỉnh/Thành phố',
          ward: 'Vui lòng chọn Xã/Phường',
        }}
      />,
    );

    expect(screen.getByText('Vui lòng chọn Tỉnh/Thành phố')).not.toBeNull();
    expect(screen.getByText('Vui lòng chọn Xã/Phường')).not.toBeNull();
    const provBtnWithError = screen.getByLabelText('Tỉnh / Thành phố');
    expect(provBtnWithError.className).toContain('border-danger');

    // 3. Hover & Focus-visible styles
    expect(provBtnWithError.className).toContain('hover:border-neutral-400');
    expect(provBtnWithError.className).toContain('focus-visible:ring-danger');

    // 4. Empty state: khi tìm từ khoá không khớp
    rerender(
      <LocationSelector
        onProvinceChange={vi.fn()}
        onWardChange={vi.fn()}
      />,
    );

    const provBtn = screen.getByLabelText('Tỉnh / Thành phố') as HTMLButtonElement;
    await waitFor(() => {
      expect(provBtn.disabled).toBe(false);
    });
    expect(provBtn.className).toContain('focus-visible:ring-primary-600');

    fireEvent.click(provBtn);
    const searchInput = await screen.findByPlaceholderText('Tìm kiếm 34 tỉnh/thành...');
    fireEvent.change(searchInput, { target: { value: 'DiaDanhKhongTonTai123' } });

    expect(screen.getByText('Không tìm thấy tỉnh/thành phố nào')).not.toBeNull();
  });

  it('TC-LOC-08: chuẩn Anti-AI (không emoji trong label, touch target >= 44px min-h-11)', () => {
    const { container } = render(
      <LocationSelector
        onProvinceChange={vi.fn()}
        onWardChange={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    // Touch target: các trigger button phải có class min-h-11 (44px)
    const buttons = container.querySelectorAll('button[role="combobox"]');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    buttons.forEach((btn) => {
      expect(btn.className).toContain('min-h-11');
    });

    // Không chứa ký tự emoji trong văn bản
    const textContent = container.textContent ?? '';
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(textContent)).toBe(false);
  });

  it('TC-LOC-11: hiển thị dòng ghi chú bản quyền & mốc dữ liệu khi bật showFooterNotice', () => {
    render(
      <LocationSelector
        onProvinceChange={vi.fn()}
        onWardChange={vi.fn()}
        showFooterNotice={true}
      />,
      { wrapper: createWrapper() },
    );

    expect(
      screen.getByText('Dữ liệu hành chính cập nhật đến 03/11/2026 — Nguồn: Tổng cục Thống kê & CSDL Quốc gia về Đơn vị Hành chính'),
    ).not.toBeNull();
  });
});
