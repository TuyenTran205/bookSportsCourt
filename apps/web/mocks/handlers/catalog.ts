import { http } from 'msw';
import { areas, amenities, districts, provinces, sports } from '../fixtures/catalogs';
import { ok, simulateLatency } from '../utils';

/** Danh mục công khai — ai cũng gọi được, dùng cho bộ lọc tìm kiếm. */
export const catalogHandlers = [
  http.get('/api/v1/sports', async () => {
    await simulateLatency(200);
    return ok(sports);
  }),

  http.get('/api/v1/amenities', async () => {
    await simulateLatency(200);
    return ok(amenities);
  }),

  http.get('/api/v1/areas', async ({ request }) => {
    await simulateLatency(200);
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const parentId = url.searchParams.get('parentId');

    // Màn Admin cần cả cây; bộ lọc tìm kiếm chỉ cần tỉnh, rồi nạp quận theo tỉnh.
    if (type === 'province') return ok(areas.filter((a) => a.type === 'province'));
    if (parentId) return ok(areas.filter((a) => a.parentId === parentId));
    return ok(areas);
  }),

  http.get('/api/v1/provinces', async () => {
    await simulateLatency(150);
    return ok(provinces);
  }),

  http.get('/api/v1/provinces/:id/districts', async ({ params }) => {
    await simulateLatency(150);
    return ok(districts.filter((d) => d.parentId === params.id));
  }),
];
