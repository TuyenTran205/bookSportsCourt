import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  extractAddressAndNote,
  geocodeAddress,
  matchProvinceFromLocation,
  matchWardFromLocation,
  parseAddressQuery,
} from './geocoding';

describe('geocoding utils', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('tách đúng địa chỉ và phần ghi chú mở ngoặc (*)', () => {
    const raw = '35 Dịch Vọng Hậu, Cầu Giấy, Hà Nội (* Cổng phụ cạnh tòa FPT)';
    const result = extractAddressAndNote(raw);
    expect(result.address).toBe('35 Dịch Vọng Hậu, Cầu Giấy, Hà Nội');
    expect(result.note).toBe('Cổng phụ cạnh tòa FPT');
  });

  it('xử lý địa chỉ không có ghi chú', () => {
    const raw = '12 Đường Như Nguyệt, Hải Châu, Đà Nẵng';
    const result = extractAddressAndNote(raw);
    expect(result.address).toBe('12 Đường Như Nguyệt, Hải Châu, Đà Nẵng');
    expect(result.note).toBeNull();
  });

  it('phân tích đúng số nhà, tên đường và tỉnh/thành phố từ địa chỉ Việt Nam', () => {
    const parsed = parseAddressQuery('76 Nguyễn Chí Thanh, Hà Nội');
    expect(parsed.houseNumber).toBe('76');
    expect(parsed.streetCore).toBe('nguyen chi thanh');
    expect(parsed.isStreetAddress).toBe(true);
    expect(parsed.province?.code).toBe('01');
  });

  it('chọn đúng 76 Nguyễn Chí Thanh thay vì lấy mù quáng kết quả đầu tiên sai số nhà (43 Nguyễn Chí Thanh)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          {
            geometry: { coordinates: [105.8130654, 21.0257605] },
            properties: {
              countrycode: 'VN',
              housenumber: '43',
              street: 'Đường Nguyễn Chí Thanh',
              name: 'Đài Truyền hình Việt Nam',
              city: 'Hà Nội',
              state: 'Thành phố Hà Nội',
            },
          },
          {
            geometry: { coordinates: [105.8061385, 21.0171654] },
            properties: {
              countrycode: 'VN',
              housenumber: '76',
              street: 'Nguyễn Chí Thanh',
              name: 'Cửa Hàng Thời Trang An Phước',
              city: 'Hà Nội',
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const coords = await geocodeAddress('76 Nguyễn Chí Thanh, Thành phố Hà Nội, Việt Nam');
    expect(coords).toEqual([21.0171654, 105.8061385]);
  });

  it('tự động thử truy vấn rút gọn khi địa chỉ kèm tên phường/quận cũ không ra đúng số nhà', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          features: [
            {
              geometry: { coordinates: [105.805148, 21.0225029] },
              properties: {
                countrycode: 'VN',
                housenumber: '91',
                street: 'Chùa Láng',
                name: 'Trường Đại học Ngoại thương',
                city: 'Hà Nội',
              },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          features: [
            {
              geometry: { coordinates: [105.8061385, 21.0171654] },
              properties: {
                countrycode: 'VN',
                housenumber: '76',
                street: 'Nguyễn Chí Thanh',
                name: 'Cửa Hàng Thời Trang An Phước',
                city: 'Hà Nội',
              },
            },
          ],
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const coords = await geocodeAddress('76 Nguyễn Chí Thanh, Láng Thượng, Đống Đa, Hà Nội');
    expect(coords).toEqual([21.0171654, 105.8061385]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('loại bỏ kết quả ngoài Việt Nam và vẫn tìm đúng địa điểm không có số nhà', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          {
            geometry: { coordinates: [2.3522, 48.8566] },
            properties: {
              countrycode: 'FR',
              name: 'My Dinh Restaurant Paris',
              city: 'Paris',
            },
          },
          {
            geometry: { coordinates: [105.7639, 21.0204] },
            properties: {
              countrycode: 'VN',
              name: 'Sân vận động Quốc gia Mỹ Đình',
              street: 'Lê Đức Thọ',
              city: 'Hà Nội',
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const coords = await geocodeAddress('Sân vận động Mỹ Đình, Hà Nội');
    expect(coords).toEqual([21.0204, 105.7639]);
  });

  it('nhận diện đúng Tỉnh/Thành phố và Phường ngay cả khi reverse geocode trả về dạng tiếng Anh (Hanoi, Lang Ward)', () => {
    const details = {
      formattedAddress: '76 Nguyễn Chí Thanh, Láng Trung, Lang Ward, Hanoi',
      city: 'Hanoi',
      district: 'Lang Ward',
      locality: 'Láng Trung',
      street: 'Nguyễn Chí Thanh',
    };
    const province = matchProvinceFromLocation(details);
    expect(province?.code).toBe('01');

    const wards = [
      { id: 'w1', code: '00001', name: 'Phường Giảng Võ', slug: 'giang-vo', provinceCode: '01', provinceId: 'p1', type: 'ward' as const },
      { id: 'w2', code: '00002', name: 'Phường Láng', slug: 'lang', provinceCode: '01', provinceId: 'p1', type: 'ward' as const },
    ];
    const ward = matchWardFromLocation(wards, details);
    expect(ward?.id).toBe('w2');
  });
});
