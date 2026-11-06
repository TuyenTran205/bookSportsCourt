import { describe, expect, it } from 'vitest';

import {
  FALLBACK_ERROR_TILE_URL,
  TILE_PROVIDERS,
  getTileProviders,
} from './tile-providers';
import type { MapProviderId } from './types';

describe('tile-providers module (SPEC-MAP-003)', () => {
  const emptyEnv = {
    NEXT_PUBLIC_CARTO_API_KEY: undefined,
    NEXT_PUBLIC_MAPTILER_API_KEY: undefined,
    NEXT_PUBLIC_STADIA_API_KEY: undefined,
    NEXT_PUBLIC_GEOAPIFY_API_KEY: undefined,
    NEXT_PUBLIC_THUNDERFOREST_API_KEY: undefined,
    NEXT_PUBLIC_DEFAULT_MAP_PROVIDER: undefined,
  };

  describe('UT-MAP-01: Lọc danh sách provider mặc định khi không có bất kỳ API Key nào', () => {
    it('chỉ trả về đúng 4 provider miễn phí không yêu cầu key theo thứ tự Esri -> OSM France -> OpenTopo -> OSM Standard', () => {
      const providers = getTileProviders(emptyEnv);

      // Đúng 4 provider miễn phí (CARTO Voyager không xuất hiện vì requiresKey: true)
      expect(providers).toHaveLength(4);

      // Thứ tự ưu tiên mặc định: Esri -> OSM France -> OpenTopo -> OSM Standard
      const expectedIds: MapProviderId[] = [
        'esri-world-street',
        'osm-france-hot',
        'opentopomap',
        'osm-standard',
      ];
      expect(providers.map((p) => p.id)).toEqual(expectedIds);

      // 100% provider trong danh sách có requiresKey === false
      providers.forEach((p) => {
        expect(p.requiresKey).toBe(false);
      });

      // Không chứa các provider trả phí / cần key
      const keyRequiredIds: MapProviderId[] = [
        'carto-voyager',
        'maptiler-streets',
        'stadia-smooth',
        'geoapify-osm-bright',
        'thunderforest-transport',
      ];
      keyRequiredIds.forEach((id) => {
        expect(providers.find((p) => p.id === id)).toBeUndefined();
      });
    });
  });

  describe('UT-MAP-02: Kích hoạt CARTO Voyager khi cung cấp NEXT_PUBLIC_CARTO_API_KEY', () => {
    it('CARTO Voyager xuất hiện ở vị trí đầu tiên (priority 0) và URL chứa đúng API key', () => {
      const testKey = 'carto-secret-test-key';
      const providers = getTileProviders({
        ...emptyEnv,
        NEXT_PUBLIC_CARTO_API_KEY: testKey,
      });

      expect(providers).toHaveLength(5);

      const firstProvider = providers[0]!;
      expect(firstProvider.id).toBe('carto-voyager');
      expect(firstProvider.priority).toBe(0);
      expect(firstProvider.url).toContain(`key=${testKey}`);
      expect(firstProvider.url).not.toContain('{apiKey}');
      expect(firstProvider.url).not.toContain('{key}');
    });
  });

  describe('UT-MAP-03: Kích hoạt MapTiler Streets khi cung cấp NEXT_PUBLIC_MAPTILER_API_KEY', () => {
    it('MapTiler xuất hiện ở vị trí đầu tiên và URL chứa đúng API key', () => {
      const testKey = 'maptiler-secret-test-key';
      const providers = getTileProviders({
        ...emptyEnv,
        NEXT_PUBLIC_MAPTILER_API_KEY: testKey,
      });

      expect(providers).toHaveLength(5);

      const firstProvider = providers[0]!;
      expect(firstProvider.id).toBe('maptiler-streets');
      expect(firstProvider.priority).toBe(0);
      expect(firstProvider.url).toContain(`key=${testKey}`);
      expect(firstProvider.url).not.toContain('{apiKey}');
      expect(firstProvider.url).not.toContain('{key}');
    });
  });

  describe('UT-MAP-04: Xử lý nhiều API Key và loại bỏ key rỗng / khoảng trắng', () => {
    it('kích hoạt đồng thời nhiều provider có key và xếp trước các provider miễn phí', () => {
      const providers = getTileProviders({
        ...emptyEnv,
        NEXT_PUBLIC_CARTO_API_KEY: 'carto-secret',
        NEXT_PUBLIC_MAPTILER_API_KEY: 'maptiler-secret',
        NEXT_PUBLIC_STADIA_API_KEY: 'stadia-secret',
        NEXT_PUBLIC_GEOAPIFY_API_KEY: 'geoapify-secret',
      });

      // 4 provider có key + 4 provider free = 8
      expect(providers).toHaveLength(8);

      const keyedIds = providers.slice(0, 4).map((p) => p.id);
      expect(keyedIds).toContain('carto-voyager');
      expect(keyedIds).toContain('maptiler-streets');
      expect(keyedIds).toContain('stadia-smooth');
      expect(keyedIds).toContain('geoapify-osm-bright');

      // Kiểm tra URL từng provider được thay đúng key
      const carto = providers.find((p) => p.id === 'carto-voyager');
      expect(carto?.url).toContain('key=carto-secret');

      const maptiler = providers.find((p) => p.id === 'maptiler-streets');
      expect(maptiler?.url).toContain('key=maptiler-secret');

      const stadia = providers.find((p) => p.id === 'stadia-smooth');
      expect(stadia?.url).toContain('api_key=stadia-secret');

      const geoapify = providers.find((p) => p.id === 'geoapify-osm-bright');
      expect(geoapify?.url).toContain('apiKey=geoapify-secret');
    });

    it('bỏ qua provider có key rỗng hoặc chỉ có khoảng trắng để tránh lỗi 401 hoặc watermark', () => {
      const providers = getTileProviders({
        ...emptyEnv,
        NEXT_PUBLIC_CARTO_API_KEY: '   ',
        NEXT_PUBLIC_STADIA_API_KEY: '   ',
        NEXT_PUBLIC_GEOAPIFY_API_KEY: '',
        NEXT_PUBLIC_MAPTILER_API_KEY: 'valid-maptiler-key',
      });

      // Chỉ có MapTiler (key hợp lệ) + 4 provider no-key = 5
      expect(providers).toHaveLength(5);
      expect(providers[0]!.id).toBe('maptiler-streets');
      expect(providers.find((p) => p.id === 'carto-voyager')).toBeUndefined();
      expect(providers.find((p) => p.id === 'stadia-smooth')).toBeUndefined();
      expect(providers.find((p) => p.id === 'geoapify-osm-bright')).toBeUndefined();
    });
  });

  describe('UT-MAP-05: Tôn trọng NEXT_PUBLIC_DEFAULT_MAP_PROVIDER', () => {
    it('đưa provider chỉ định lên vị trí đầu tiên', () => {
      const providers = getTileProviders({
        ...emptyEnv,
        NEXT_PUBLIC_DEFAULT_MAP_PROVIDER: 'osm-france-hot',
      });

      expect(providers[0]!.id).toBe('osm-france-hot');
      expect(providers.map((p) => p.id)).toContain('esri-world-street');
      expect(providers).toHaveLength(4);
    });

    it('bỏ qua NEXT_PUBLIC_DEFAULT_MAP_PROVIDER nếu provider id không tồn tại hoặc không khả dụng', () => {
      const providers = getTileProviders({
        ...emptyEnv,
        NEXT_PUBLIC_DEFAULT_MAP_PROVIDER: 'non-existing-provider',
      });

      expect(providers[0]!.id).toBe('esri-world-street');
      expect(providers).toHaveLength(4);
    });
  });

  describe('UT-MAP-06: Kiểm tra tính toàn vẹn và hợp lệ của toàn bộ TILE_PROVIDERS', () => {
    it('FALLBACK_ERROR_TILE_URL là SVG Data URI hợp lệ, nền trung tính Slate', () => {
      expect(FALLBACK_ERROR_TILE_URL).toBeDefined();
      expect(FALLBACK_ERROR_TILE_URL.startsWith('data:image/svg+xml')).toBe(true);

      // Giải mã Base64 và kiểm tra nội dung SVG
      const base64Part = FALLBACK_ERROR_TILE_URL.split(',')[1]!;
      expect(base64Part).toBeTruthy();

      const decodedSvg = Buffer.from(base64Part, 'base64').toString('utf-8');
      expect(decodedSvg).toContain('<svg');
      expect(decodedSvg).toContain('width="256"');
      expect(decodedSvg).toContain('height="256"');
      // Màu nền trung tính Slate #f8fafc và lưới caro #e2e8f0
      expect(decodedSvg).toContain('#f8fafc');
      expect(decodedSvg).toContain('#e2e8f0');
      // Dung lượng tối ưu < 400 bytes
      expect(Buffer.byteLength(FALLBACK_ERROR_TILE_URL, 'utf-8')).toBeLessThan(400);
    });

    it('100% provider có attribution hợp lệ độ dài > 10 ký tự, maxNativeZoom <= maxZoom', () => {
      const allProviders = Object.values(TILE_PROVIDERS);
      expect(allProviders.length).toBeGreaterThanOrEqual(9);

      allProviders.forEach((provider) => {
        expect(provider.id).toBeTruthy();
        expect(provider.name).toBeTruthy();
        expect(provider.url).toContain('{z}');
        expect(provider.url).toContain('{x}');
        expect(provider.url).toContain('{y}');
        expect(provider.attribution).toBeTruthy();
        expect(provider.attribution.length).toBeGreaterThan(10);
        expect(provider.maxZoom).toBeGreaterThanOrEqual(17);
        expect(provider.maxNativeZoom).toBeGreaterThanOrEqual(17);
        expect(provider.maxNativeZoom).toBeLessThanOrEqual(provider.maxZoom);
        expect(provider.priority).toBeGreaterThanOrEqual(0);
      });
    });

    it('hàm là pure function, không làm biến đổi TILE_PROVIDERS gốc', () => {
      const originalCartoUrl = TILE_PROVIDERS['carto-voyager'].url;
      const originalProvidersSnapshot = JSON.stringify(TILE_PROVIDERS);

      const run1 = getTileProviders(emptyEnv);
      const run2 = getTileProviders(emptyEnv);

      expect(run1).toEqual(run2);
      expect(TILE_PROVIDERS['carto-voyager'].url).toBe(originalCartoUrl);
      expect(JSON.stringify(TILE_PROVIDERS)).toBe(originalProvidersSnapshot);
    });
  });
});
