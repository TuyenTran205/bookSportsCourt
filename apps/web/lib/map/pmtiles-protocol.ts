/**
 * Quản lý PMTiles Singleton & MapLibre GL JS Protocol (ADR-031).
 *
 * Khắc phục 3 điểm nghẽn lớn trên Chrome/Edge Windows:
 *  1. `pmtiles` FetchSource tự bật `chromeWindowsNoCache = true` ép `cache: "no-store"`,
 *     vô hiệu hoá HTTP disk cache của trình duyệt ⇒ tắt cờ này ở `CachedHttpRangeSource`.
 *  2. Khởi tạo `new PMTiles()` nhiều lần hoặc gọi trùng HTTP Range cùng lúc ⇒
 *     dùng singleton `SharedPromiseCache(1000)`, LRU RAM cache 1024 tile và dedup in-flight Range.
 *  3. Nhảy zoom/toạ độ lớn giữa các cơ sở trên toàn quốc chưa có tile lân cận ⇒
 *     hỗ trợ làm nóng (prewarm) tile z12/z14 xung quanh toạ độ sân.
 */

import { addProtocol } from 'maplibre-gl';
import * as pmtilesPkg from 'pmtiles';
import type { PMTiles, Protocol, RangeResponse, SharedPromiseCache, Source } from 'pmtiles';

const { PMTiles: PMTilesCtor, Protocol: ProtocolCtor, SharedPromiseCache: SharedPromiseCacheCtor } =
  pmtilesPkg;
const FetchSourceCtor =
  'FetchSource' in pmtilesPkg && typeof pmtilesPkg.FetchSource === 'function'
    ? pmtilesPkg.FetchSource
    : null;

const SHARED_PROMISE_CACHE_LIMIT = 1000;
const TILE_RAM_LRU_LIMIT = 1024;
const PREWARM_CONCURRENCY = 4;

let sharedDirectoryCache: SharedPromiseCache | null = null;
let sharedProtocol: Protocol | null = null;
let isProtocolRegistered = false;
const pmtilesRegistry = new Map<string, PMTiles>();
const tileRamCache = new Map<string, RangeResponse | undefined>();
const prewarmedTiles = new Set<string>();

function getSharedDirectoryCache(): SharedPromiseCache {
  if (!sharedDirectoryCache) {
    sharedDirectoryCache = new SharedPromiseCacheCtor(SHARED_PROMISE_CACHE_LIMIT);
  }
  return sharedDirectoryCache;
}

function getSharedProtocol(): Protocol {
  if (!sharedProtocol) {
    sharedProtocol = new ProtocolCtor();
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

/**
 * HTTP Range Source cho PMTiles giữ nguyên HTTP browser cache trên Chrome/Edge Windows
 * và gộp các yêu cầu byte-range trùng nhau đang chờ phản hồi.
 */
class CachedHttpRangeSource implements Source {
  private readonly baseSource: InstanceType<typeof pmtilesPkg.FetchSource>;
  private readonly inflight = new Map<
    string,
    {
      promise: Promise<RangeResponse>;
      waiters: number;
      controller: AbortController;
    }
  >();

  constructor(private readonly url: string) {
    if (!FetchSourceCtor) {
      throw new Error('FetchSource is unavailable');
    }
    this.baseSource = new FetchSourceCtor(url);
    this.baseSource.chromeWindowsNoCache = false;
  }

  getKey(): string {
    return this.url;
  }

  async getBytes(
    offset: number,
    length: number,
    signal?: AbortSignal,
    etag?: string,
  ): Promise<RangeResponse> {
    if (signal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }

    const key = `${offset}:${length}:${etag ?? ''}`;
    let entry = this.inflight.get(key);

    if (!entry) {
      const controller = new AbortController();
      const promise = this.baseSource
        .getBytes(offset, length, controller.signal, etag)
        .finally(() => {
          if (this.inflight.get(key)?.promise === promise) {
            this.inflight.delete(key);
          }
        });
      entry = { promise, waiters: 0, controller };
      this.inflight.set(key, entry);
    }

    entry.waiters += 1;
    const activeEntry = entry;
    let settled = false;
    let detachAbort: (() => void) | undefined;

    try {
      const response = await new Promise<RangeResponse>((resolve, reject) => {
        const handleAbort = () => {
          if (settled) return;
          settled = true;
          activeEntry.waiters -= 1;
          if (activeEntry.waiters <= 0) {
            activeEntry.controller.abort();
          }
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        };

        if (signal) {
          signal.addEventListener('abort', handleAbort, { once: true });
          detachAbort = () => signal.removeEventListener('abort', handleAbort);
        }

        activeEntry.promise.then(
          (res) => {
            if (!settled) {
              settled = true;
              activeEntry.waiters -= 1;
              resolve(res);
            }
          },
          (err) => {
            if (!settled) {
              settled = true;
              activeEntry.waiters -= 1;
              reject(err);
            }
          },
        );
      });

      return cloneRangeResponse(response)!;
    } finally {
      detachAbort?.();
    }
  }
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

/** Chuyển toạ độ `[lng, lat]` sang chỉ số tile Web Mercator `(x, y)` ở mức `zoom`. */
export function lngLatToTileXY(lng: number, lat: number, zoom: number): { x: number; y: number } {
  const n = 2 ** zoom;
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const latRad = (clampedLat * Math.PI) / 180;
  const x = Math.max(0, Math.min(n - 1, Math.floor(((lng + 180) / 360) * n)));
  const y = Math.max(
    0,
    Math.min(
      n - 1,
      Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n),
    ),
  );
  return { x, y };
}

/**
 * Làm nóng nền các tile PMTiles xung quanh danh sách toạ độ `[lng, lat]` để hạn chế
 * vùng trắng tạm thời khi chuyển đổi giữa các cơ sở hoặc phóng to đột ngột.
 */
export async function prewarmPmTilesForCoordinates(
  url: string,
  coords: Array<[number, number]>,
  options?: { zooms?: number[]; radius?: number; maxCenters?: number },
): Promise<void> {
  const normalizedUrl = url.trim();
  if (!normalizedUrl || coords.length === 0) return;

  const zooms = options?.zooms ?? [12, 14];
  const radius = Math.max(0, options?.radius ?? 0);
  const maxCenters = Math.max(1, options?.maxCenters ?? 8);

  const client = getOrCreatePmTiles(normalizedUrl);
  let maxArchiveZoom = 14;
  try {
    const header = await client.getHeader();
    if (typeof header?.maxZoom === 'number' && header.maxZoom >= 0) {
      maxArchiveZoom = header.maxZoom;
    }
  } catch {
    return;
  }

  const tasks: Array<{ z: number; x: number; y: number }> = [];
  const seen = new Set<string>();

  for (const [lng, lat] of coords.slice(0, maxCenters)) {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;

    for (const rawZoom of zooms) {
      const z = Math.min(rawZoom, maxArchiveZoom);
      if (z < 0) continue;
      const { x: cx, y: cy } = lngLatToTileXY(lng, lat, z);
      const limit = 2 ** z - 1;
      const tileRadius = z >= maxArchiveZoom ? radius : 0;

      for (let dx = -tileRadius; dx <= tileRadius; dx += 1) {
        for (let dy = -tileRadius; dy <= tileRadius; dy += 1) {
          const x = Math.max(0, Math.min(limit, cx + dx));
          const y = Math.max(0, Math.min(limit, cy + dy));
          const key = `${normalizedUrl}:${z}:${x}:${y}`;
          if (seen.has(key) || prewarmedTiles.has(key) || tileRamCache.has(key)) {
            continue;
          }
          seen.add(key);
          prewarmedTiles.add(key);
          tasks.push({ z, x, y });
        }
      }
    }
  }

  if (tasks.length === 0) return;

  let cursor = 0;
  const workerCount = Math.min(PREWARM_CONCURRENCY, tasks.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < tasks.length) {
        const task = tasks[cursor];
        cursor += 1;
        if (!task) break;
        await client.getZxy(task.z, task.x, task.y).catch(() => undefined);
      }
    }),
  );
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

  const source: Source | string = FetchSourceCtor
    ? new CachedHttpRangeSource(normalizedUrl)
    : normalizedUrl;
  const instance = new PMTilesCtor(source as Source, getSharedDirectoryCache());
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
  prewarmedTiles.clear();
}
