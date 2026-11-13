import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetHeader, mockGetZxy, mockAdd, mockTile } = vi.hoisted(() => ({
  mockGetHeader: vi.fn(async () => ({ minZoom: 0, maxZoom: 14 })),
  mockGetZxy: vi.fn(async (z: number, x: number, y: number) => ({
    data: new Uint8Array([z, x, y]).buffer,
  })),
  mockAdd: vi.fn(),
  mockTile: vi.fn(),
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
  PMTiles: vi.fn().mockImplementation((url: string, cache: unknown) => ({
    source: { getKey: () => url },
    cache,
    getHeader: mockGetHeader,
    getZxy: mockGetZxy,
  })),
}));

import { PMTiles, SharedPromiseCache } from 'pmtiles';
import {
  ensurePmTilesProtocolRegistered,
  getOrCreatePmTiles,
  resetPmTilesProtocolForTests,
} from './pmtiles-protocol';

describe('pmtiles-protocol singleton & RAM LRU cache (ADR-031)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
