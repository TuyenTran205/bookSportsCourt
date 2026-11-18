import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetHeader, mockGetZxy, mockAdd, mockTile, mockFetchGetBytes, fetchInstances } = vi.hoisted(() => ({
  mockGetHeader: vi.fn(async () => ({ minZoom: 0, maxZoom: 14 })),
  mockGetZxy: vi.fn(async (z: number, x: number, y: number) => ({
    data: new Uint8Array([z, x, y]).buffer,
  })),
  mockAdd: vi.fn(),
  mockTile: vi.fn(),
  mockFetchGetBytes: vi.fn(async (offset: number, length: number) => ({
    data: new Uint8Array([offset & 255, length & 255]).buffer,
  })),
  fetchInstances: [] as Array<{ url: string; chromeWindowsNoCache: boolean }>,
}));

vi.mock('maplibre-gl', () => ({
  addProtocol: vi.fn(),
}));

vi.mock('pmtiles', () => ({
  SharedPromiseCache: vi.fn().mockImplementation((maxEntries: number) => ({ maxEntries })),
  Protocol: vi.fn().mockImplementation(() => ({
    add: mockAdd,
    tile: mockTile,
  })),
  FetchSource: vi.fn().mockImplementation((url: string) => {
    const inst = {
      url,
      chromeWindowsNoCache: true,
      getKey: () => url,
      getBytes: mockFetchGetBytes,
    };
    fetchInstances.push(inst);
    return inst;
  }),
  PMTiles: vi.fn().mockImplementation((source: { getKey?: () => string } | string, cache: unknown) => ({
    source: typeof source === 'string' ? { getKey: () => source } : source,
    cache,
    getHeader: mockGetHeader,
    getZxy: mockGetZxy,
  })),
}));

import { PMTiles, SharedPromiseCache, type Source } from 'pmtiles';
import {
  ensurePmTilesProtocolRegistered,
  getOrCreatePmTiles,
  lngLatToTileXY,
  prewarmPmTilesForCoordinates,
  resetPmTilesProtocolForTests,
} from './pmtiles-protocol';

describe('pmtiles-protocol singleton & RAM LRU cache (ADR-031)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchInstances.length = 0;
    resetPmTilesProtocolForTests();
  });

  it('tái sử dụng cùng một PMTiles instance theo URL với SharedPromiseCache(1000)', () => {
    const first = getOrCreatePmTiles('https://map.booksportscourt.id.vn/map/vietnam.pmtiles');
    const second = getOrCreatePmTiles(' https://map.booksportscourt.id.vn/map/vietnam.pmtiles ');

    expect(first).toBe(second);
    expect(PMTiles).toHaveBeenCalledTimes(1);
    expect(SharedPromiseCache).toHaveBeenCalledWith(1000);
    expect(mockAdd).toHaveBeenCalledTimes(1);
    expect(mockAdd).toHaveBeenCalledWith(first);
  });

  it('lưu cache RAM LRU cho getZxy và trả về ArrayBuffer độc lập (không bị detach)', async () => {
    const client = getOrCreatePmTiles('https://map.booksportscourt.id.vn/map/vietnam.pmtiles');

    const res1 = await client.getZxy(12, 3260, 1910);
    const res2 = await client.getZxy(12, 3260, 1910);

    expect(mockGetZxy).toHaveBeenCalledTimes(1);
    expect(res1?.data.byteLength).toBe(3);
    expect(res2?.data.byteLength).toBe(3);
    expect(res1?.data).not.toBe(res2?.data);
  });

  it('chỉ đăng ký pmtiles protocol với MapLibre đúng 1 lần', () => {
    const registerFn = vi.fn();

    ensurePmTilesProtocolRegistered(registerFn);
    ensurePmTilesProtocolRegistered(registerFn);

    expect(registerFn).toHaveBeenCalledTimes(1);
    expect(registerFn).toHaveBeenCalledWith('pmtiles', mockTile);
  });

  it('tắt chromeWindowsNoCache và gộp request HTTP Range đang chạy song song', async () => {
    const client = getOrCreatePmTiles('https://map.booksportscourt.id.vn/map/vietnam.pmtiles') as unknown as {
      source: Source;
    };

    expect(fetchInstances).toHaveLength(1);
    expect(fetchInstances[0]?.chromeWindowsNoCache).toBe(false);

    const [a, b, c] = await Promise.all([
      client.source.getBytes(1024, 512),
      client.source.getBytes(1024, 512),
      client.source.getBytes(1024, 512),
    ]);

    expect(mockFetchGetBytes).toHaveBeenCalledTimes(1);
    expect(a.data).not.toBe(b.data);
    expect(b.data).not.toBe(c.data);
  });

  it('prewarmPmTilesForCoordinates làm nóng tile z12/z14 theo toạ độ không trùng lặp', async () => {
    const hn = lngLatToTileXY(105.79, 21.036, 14);
    expect(hn.x).toBeGreaterThan(0);
    expect(hn.y).toBeGreaterThan(0);

    await prewarmPmTilesForCoordinates(
      'https://map.booksportscourt.id.vn/map/vietnam.pmtiles',
      [
        [105.79, 21.036],
        [105.79, 21.036],
      ],
      { zooms: [12, 14], radius: 0 },
    );

    expect(mockGetZxy).toHaveBeenCalledTimes(2);
  });
});
