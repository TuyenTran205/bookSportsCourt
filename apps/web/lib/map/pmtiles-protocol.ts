/**
 * Quản lý PMTiles Singleton & MapLibre GL JS Protocol (ADR-031).
 *
 * Khắc phục 2 điểm nghẽn lớn trên Chrome/Edge Windows:
 *  1. `pmtiles` FetchSource bật `chromeWindowsNoCache = true` ép `cache: "no-store"`,
 *     vô hiệu hoá HTTP disk cache của trình duyệt.
 *  2. Khởi tạo `new PMTiles()` nhiều lần làm mất cache directory và tile đã tải.
 *
 * Giải pháp: Dùng chung `SharedPromiseCache(1000)` + LRU tile cache trong RAM (512 tile)
 * cho toàn bộ phiên làm việc, đồng thời chỉ đăng ký `maplibregl.addProtocol('pmtiles', ...)` 1 lần.
 */

import { addProtocol } from 'maplibre-gl';
import { PMTiles, Protocol, SharedPromiseCache, type RangeResponse } from 'pmtiles';

const SHARED_PROMISE_CACHE_LIMIT = 1000;
const TILE_RAM_LRU_LIMIT = 512;

let sharedDirectoryCache: SharedPromiseCache | null = null;
let sharedProtocol: Protocol | null = null;
let isProtocolRegistered = false;
const pmtilesRegistry = new Map<string, PMTiles>();
const tileRamCache = new Map<string, RangeResponse | undefined>();

function getSharedDirectoryCache(): SharedPromiseCache {
  if (!sharedDirectoryCache) {
    sharedDirectoryCache = new SharedPromiseCache(SHARED_PROMISE_CACHE_LIMIT);
  }
  return sharedDirectoryCache;
}

function getSharedProtocol(): Protocol {
  if (!sharedProtocol) {
    sharedProtocol = new Protocol();
  }
  return sharedProtocol;
}

function setTileLru(key: string, value: RangeResponse | undefined): void {
  if (tileRamCache.has(key)) {
    tileRamCache.delete(key);
  } else if (tileRamCache.size >= TILE_RAM_LRU_LIMIT) {
    const oldestKey = tileRamCache.keys().next().value;
    if (oldestKey !== undefined) {
      tileRamCache.delete(oldestKey);
    }
  }
  tileRamCache.set(key, value);
}

function cloneRangeResponse(response: RangeResponse | undefined): RangeResponse | undefined {
  if (!response) return response;
  // Nhân bản ArrayBuffer để tránh bị detach khi MapLibre chuyển tile sang WebWorker
  return {
    ...response,
    data: response.data.slice(0),
  };
}

function attachRamTileLru(instance: PMTiles, url: string): void {
  const originalGetZxy = instance.getZxy.bind(instance);

  instance.getZxy = async (
    z: number,
    x: number,
    y: number,
    signal?: AbortSignal,
  ): Promise<RangeResponse | undefined> => {
    const cacheKey = `${url}:${z}:${x}:${y}`;
    if (tileRamCache.has(cacheKey)) {
      const hit = tileRamCache.get(cacheKey);
      // Đưa lên đầu LRU
      tileRamCache.delete(cacheKey);
      tileRamCache.set(cacheKey, hit);
      return cloneRangeResponse(hit);
    }

    const result = await originalGetZxy(z, x, y, signal);
    if (!signal?.aborted) {
      setTileLru(cacheKey, cloneRangeResponse(result));
    }
    return result;
  };
}

/**
 * Lấy hoặc khởi tạo instance `PMTiles` duy nhất theo URL,
 * tự động gắn vào `Protocol` dùng chung và làm nóng header sớm.
 */
export function getOrCreatePmTiles(url: string): PMTiles {
  const normalizedUrl = url.trim();
  const existing = pmtilesRegistry.get(normalizedUrl);
  if (existing) {
    return existing;
  }

  const instance = new PMTiles(normalizedUrl, getSharedDirectoryCache());
  attachRamTileLru(instance, normalizedUrl);
  pmtilesRegistry.set(normalizedUrl, instance);

  const protocol = getSharedProtocol();
  protocol.add(instance);

  // Làm nóng header sớm; lỗi mạng/CORS sẽ được caller xử lý qua `getHeader()` khi gắn layer
  void instance.getHeader().catch(() => undefined);

  return instance;
}

/**
 * Đăng ký giao thức `pmtiles://` với MapLibre GL JS đúng một lần trên client.
 */
export function ensurePmTilesProtocolRegistered(
  registerFn?: (scheme: string, fn: unknown) => void,
): Protocol {
  const protocol = getSharedProtocol();
  if (!isProtocolRegistered) {
    const register =
      registerFn ??
      ((scheme: string, fn: unknown) => {
        addProtocol(scheme, fn as Parameters<typeof addProtocol>[1]);
      });
    register('pmtiles', protocol.tile);
    isProtocolRegistered = true;
  }
  return protocol;
}

/** Đặt lại trạng thái singleton (chỉ dùng trong unit test). */
export function resetPmTilesProtocolForTests(): void {
  sharedDirectoryCache = null;
  sharedProtocol = null;
  isProtocolRegistered = false;
  pmtilesRegistry.clear();
  tileRamCache.clear();
}
