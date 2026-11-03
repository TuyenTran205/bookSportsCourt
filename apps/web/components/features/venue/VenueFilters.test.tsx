// @vitest-environment jsdom
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { VenueFilters, type VenueFilterValues } from './VenueFilters';

const mockProvinces = [
  { id: 'p-hn', code: '01', name: 'Hà Nội', slug: 'ha-noi', isMunicipality: true },
  { id: 'p-hcm', code: '79', name: 'Hồ Chí Minh', slug: 'ho-chi-minh', isMunicipality: true },
];

const mockWards = [
  { id: 'w-cg', provinceCode: '01', code: '00001', name: 'Cầu Giấy', slug: 'cau-giay', type: 'ward' },
  { id: 'w-bd', provinceCode: '01', code: '00004', name: 'Ba Đình', slug: 'ba-dinh', type: 'ward' },
];

const mockSports = [
  { id: 'sp-badminton', name: 'Cầu lông', slug: 'cau-long' },
  { id: 'sp-pickleball', name: 'Pickleball', slug: 'pickleball' },
];

const mockAmenities = [
  { id: 'am-parking', name: 'Bãi đỗ xe ô tô', icon: 'car' },
  { id: 'am-wifi', name: 'Wifi miễn phí', icon: 'wifi' },
];

vi.mock('@/lib/api/endpoints/venues', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/endpoints/venues')>();
  return {
    ...actual,
    listProvinces: vi.fn().mockImplementation(() => Promise.resolve(mockProvinces)),
    listWards: vi.fn().mockImplementation((provinceCodeOrId: string) => {
      if (provinceCodeOrId === 'p-hn' || provinceCodeOrId === '01') {
        return Promise.resolve(mockWards);
      }
      return Promise.resolve([]);
    }),
    listSports: vi.fn().mockImplementation(() => Promise.resolve(mockSports)),
    listAmenities: vi.fn().mockImplementation(() => Promise.resolve(mockAmenities)),
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

describe('VenueFilters Component (TC-FILTER)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('TC-FILTER-01: render đủ các trường lọc cơ bản & ghi chú ĐVHC', async () => {
    const values: VenueFilterValues = {};
    render(<VenueFilters values={values} onChange={vi.fn()} onReset={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByLabelText('Tỉnh / Thành phố')).not.toBeNull();
    expect(screen.getByLabelText('Xã / Phường / Đặc khu')).not.toBeNull();
    expect(screen.getByLabelText('Mức giá')).not.toBeNull();
    expect(screen.getByLabelText('Sắp xếp theo')).not.toBeNull();

    // Dòng ghi chú ĐVHC (TC-LOC-09)
    expect(screen.getByText(/Dữ liệu hành chính cập nhật đến 03\/11\/2026/i)).not.toBeNull();
  });

  it('TC-FILTER-02: combobox Xã/Phường bị disabled khi chưa chọn Tỉnh/Thành', async () => {
    const values: VenueFilterValues = {};
    const { rerender } = render(
      <VenueFilters values={values} onChange={vi.fn()} onReset={vi.fn()} />,
      { wrapper: createWrapper() },
    );

    const wardBtn = screen.getByLabelText('Xã / Phường / Đặc khu') as HTMLButtonElement;
    expect(wardBtn.disabled).toBe(true);
    expect(screen.getByText('Chọn Tỉnh/Thành trước')).not.toBeNull();

    // Rerender với provinceId = 'p-hn', provinceCode = '01'
    rerender(
      <VenueFilters
        values={{ ...values, provinceId: 'p-hn', provinceCode: '01' }}
        onChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(wardBtn.disabled).toBe(false);
      expect(screen.getByText('Tất cả Xã / Phường')).not.toBeNull();
    });
  });

  it('TC-FILTER-03: bấm nút "Xóa bộ lọc" kích hoạt callback onReset', () => {
    const onReset = vi.fn();
    const values: VenueFilterValues = { provinceId: 'p-hn', maxPrice: 300000 };

    render(<VenueFilters values={values} onChange={vi.fn()} onReset={onReset} />, {
      wrapper: createWrapper(),
    });

    const resetButton = screen.getByRole('button', { name: /Xóa bộ lọc/i });
    expect(resetButton).not.toBeNull();

    fireEvent.click(resetButton);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('TC-FILTER-04: chọn Tỉnh/Thành gọi onChange với provinceId mới, reset wardId, districtId và page 1', async () => {
    const onChange = vi.fn();
    const values: VenueFilterValues = { provinceId: 'p-hcm', provinceCode: '79', wardId: 'w-1', page: 3 };

    render(<VenueFilters values={values} onChange={onChange} onReset={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    const provinceBtn = screen.getByLabelText('Tỉnh / Thành phố') as HTMLButtonElement;
    await waitFor(() => {
      expect(provinceBtn.disabled).toBe(false);
    });
    fireEvent.click(provinceBtn);

    const hanoiOption = await screen.findByText('Hà Nội');
    fireEvent.click(hanoiOption);

    expect(onChange).toHaveBeenCalledWith({
      provinceId: 'p-hn',
      provinceCode: '01',
      wardId: undefined,
      wardCode: undefined,
      districtId: undefined,
      page: 1,
    });
  });

  it('TC-FILTER-05: mở rộng và thu gọn Bộ lọc nâng cao', async () => {
    const values: VenueFilterValues = {};
    render(<VenueFilters values={values} onChange={vi.fn()} onReset={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    expect(screen.queryByText('Môn thể thao')).toBeNull();

    const advancedToggle = screen.getByRole('button', { name: /Bộ lọc nâng cao/i });
    fireEvent.click(advancedToggle);

    expect(screen.getByText('Môn thể thao')).not.toBeNull();
    expect(screen.getByLabelText('Đánh giá sao tối thiểu')).not.toBeNull();

    await waitFor(() => {
      expect(screen.getByText('Cầu lông')).not.toBeNull();
      expect(screen.getByText('Pickleball')).not.toBeNull();
      expect(screen.getByText('Bãi đỗ xe ô tô')).not.toBeNull();
      expect(screen.getByText('Wifi miễn phí')).not.toBeNull();
    });

    // Thu gọn lại
    const collapseToggle = screen.getByRole('button', { name: /Thu gọn bộ lọc/i });
    fireEvent.click(collapseToggle);
    expect(screen.queryByText('Môn thể thao')).toBeNull();
  });

  it('TC-FILTER-06: toggle chọn môn thể thao cập nhật mảng sportIds', async () => {
    const onChange = vi.fn();
    const values: VenueFilterValues = { sportIds: ['sp-badminton'] };

    render(<VenueFilters values={values} onChange={onChange} onReset={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByRole('button', { name: /Bộ lọc nâng cao/i }));

    await waitFor(() => {
      expect(screen.getByText('Pickleball')).not.toBeNull();
    });

    // Thêm Pickleball vào mảng sportIds
    const pickleballBtn = screen.getByRole('button', { name: 'Pickleball' });
    fireEvent.click(pickleballBtn);
    expect(onChange).toHaveBeenCalledWith({
      sportIds: ['sp-badminton', 'sp-pickleball'],
      page: 1,
    });

    // Bỏ chọn Cầu lông
    const badmintonBtn = screen.getByRole('button', { name: 'Cầu lông' });
    fireEvent.click(badmintonBtn);
    expect(onChange).toHaveBeenCalledWith({
      sportIds: undefined,
      page: 1,
    });
  });

  it('TC-FILTER-07: toggle chọn tiện ích cập nhật mảng amenityIds', async () => {
    const onChange = vi.fn();
    const values: VenueFilterValues = {};

    render(<VenueFilters values={values} onChange={onChange} onReset={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByRole('button', { name: /Bộ lọc nâng cao/i }));

    await waitFor(() => {
      expect(screen.getByText('Bãi đỗ xe ô tô')).not.toBeNull();
    });

    const parkingCheckbox = screen.getByRole('checkbox', { name: /Bãi đỗ xe ô tô/i });
    fireEvent.click(parkingCheckbox);

    expect(onChange).toHaveBeenCalledWith({
      amenityIds: ['am-parking'],
      page: 1,
    });
  });

  it('TC-FILTER-08: thay đổi mức giá, sắp xếp và đánh giá tối thiểu gọi onChange', async () => {
    const onChange = vi.fn();
    const values: VenueFilterValues = {};

    render(<VenueFilters values={values} onChange={onChange} onReset={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    // Đổi mức giá
    const priceSelect = screen.getByLabelText('Mức giá');
    fireEvent.change(priceSelect, { target: { value: '300000' } });
    expect(onChange).toHaveBeenCalledWith({
      maxPrice: 300000,
      page: 1,
    });

    // Đổi sắp xếp
    const sortSelect = screen.getByLabelText('Sắp xếp theo');
    fireEvent.change(sortSelect, { target: { value: 'price_asc' } });
    expect(onChange).toHaveBeenCalledWith({
      sort: 'price_asc',
      page: 1,
    });

    // Mở bộ lọc nâng cao để đổi minRating
    fireEvent.click(screen.getByRole('button', { name: /Bộ lọc nâng cao/i }));
    const ratingSelect = screen.getByLabelText('Đánh giá sao tối thiểu');
    fireEvent.change(ratingSelect, { target: { value: '4' } });
    expect(onChange).toHaveBeenCalledWith({
      minRating: 4,
      page: 1,
    });
  });

  it('TC-FILTER-09: hiển thị số lượng cơ sở khi truyền totalResults', () => {
    render(
      <VenueFilters
        values={{}}
        onChange={vi.fn()}
        onReset={vi.fn()}
        totalResults={42}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText('42')).not.toBeNull();
    expect(screen.getByText(/Tìm thấy/)).not.toBeNull();
    expect(screen.getByText(/cơ sở/)).not.toBeNull();
  });

  it('TC-FILTER-10: badge đếm số lượng bộ lọc đang kích hoạt', () => {
    const values: VenueFilterValues = {
      provinceId: 'p-hn',
      maxPrice: 300000,
      sportIds: ['sp-badminton', 'sp-pickleball'],
      sort: 'price_asc',
    };

    render(<VenueFilters values={values} onChange={vi.fn()} onReset={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    // 1 (provinceId) + 1 (maxPrice) + 2 (sportIds) + 1 (sort !== rating_desc) = 5
    expect(screen.getByText('5')).not.toBeNull();
  });

  it('TC-LOC-03: không còn bất kỳ trường lọc hoặc nhãn Quận/Huyện nào trong giao diện', () => {
    render(<VenueFilters values={{}} onChange={vi.fn()} onReset={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    expect(screen.queryByLabelText(/Quận/i)).toBeNull();
    expect(screen.queryByLabelText(/Huyện/i)).toBeNull();
    expect(screen.queryByText(/Quận \/ Huyện/i)).toBeNull();
  });
});
