import { http } from 'msw';
import { matchUnaccent } from '@bsc/shared';
import { areas, amenities, districts, provinces, sports, wards } from '../fixtures/catalogs';
import { ok, simulateLatency } from '../utils';

/** Danh mục công khai — ai cũng gọi được, dùng cho bộ lọc tìm kiếm & quản lý. */
export const catalogHandlers = [
  http.get('/api/v1/sports', async () => {
    await simulateLatency(150);
    return ok(sports);
  }),

  http.get('/api/v1/amenities', async () => {
    await simulateLatency(150);
    return ok(amenities);
  }),

  http.get('/api/v1/areas', async ({ request }) => {
    await simulateLatency(150);
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const parentId = url.searchParams.get('parentId');

    if (type === 'province') return ok(areas.filter((a) => a.type === 'province'));
    if (type === 'ward') return ok(areas.filter((a) => a.type === 'ward'));
    if (type === 'district') return ok(areas.filter((a) => a.type === 'district'));
    if (parentId) return ok(areas.filter((a) => a.parentId === parentId));
    return ok(areas);
  }),

  http.get('/api/v1/provinces', async () => {
    await simulateLatency(150);
    return ok(provinces);
  }),

  http.get('/api/v1/provinces/:code/wards', async ({ params, request }) => {
    await simulateLatency(150);
    const codeOrId = String(params.code);
    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.trim() ?? '';
    const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit') ?? '50')), 100);

    // Hỗ trợ cả 2 chữ số mã tỉnh hoặc UUID của tỉnh
    const province = provinces.find((p) => p.code === codeOrId || p.id === codeOrId);
    const provinceCode = province ? province.code : codeOrId;

    let matched = wards.filter((w) => w.provinceCode === provinceCode);
    if (q) {
      matched = matched.filter((w) => matchUnaccent(q, w.name) || (w.code && w.code.includes(q)));
    }

    const result = matched.slice(0, limit).map((w) => ({
      ...w,
      provinceId: province?.id,
      provinceName: province?.name,
    }));

    return ok(result);
  }),

  http.get('/api/v1/wards/search', async ({ request }) => {
    await simulateLatency(150);
    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.trim() ?? '';
    const provinceCode = url.searchParams.get('provinceCode')?.trim();
    const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit') ?? '50')), 100);

    let matched = wards;
    if (provinceCode) {
      matched = matched.filter((w) => w.provinceCode === provinceCode);
    }
    if (q) {
      matched = matched.filter((w) => matchUnaccent(q, w.name) || (w.code && w.code.includes(q)));
    }

    const provinceMap = new Map(provinces.map((p) => [p.code, p]));
    const result = matched.slice(0, limit).map((w) => {
      const p = provinceMap.get(w.provinceCode);
      return {
        ...w,
        provinceId: p?.id,
        provinceName: p?.name,
      };
    });

    return ok(result);
  }),

  http.get('/api/v1/provinces/:id/districts', async ({ params }) => {
    await simulateLatency(150);
    return ok(districts.filter((d) => d.parentId === params.id));
  }),
];
