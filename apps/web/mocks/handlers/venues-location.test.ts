// @vitest-environment jsdom
import * as fs from 'fs';
import * as path from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PROVINCES } from '@bsc/shared';
import { db } from '../db';
import { areas, provinces, sports, wards } from '../fixtures/catalogs';
import { server } from '../server';

const OWNER_ID = '019273c5-7f12-7000-8000-000000000001';
const originalCurrentUserId = db.currentUserId;
const originalVenuesCount = db.venues.length;

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  db.currentUserId = OWNER_ID;
});

afterEach(() => {
  server.resetHandlers();
  db.currentUserId = originalCurrentUserId;
  // Khôi phục danh sách venues nếu có tạo mới
  if (db.venues.length > originalVenuesCount) {
    db.venues.splice(originalVenuesCount);
  }
});

describe('Catalog Endpoints (TC-LOC-01, TC-LOC-02, TC-LOC-04)', () => {
  it('TC-LOC-01: GET /api/v1/provinces trả về đầy đủ 34 tỉnh/thành phố và 6 TP TW', async () => {
    const res = await fetch('http://localhost:3000/api/v1/provinces');
    expect(res.status).toBe(200);

    const body = await res.json();
    const data = body.data;
    expect(data).toHaveLength(34);

    const municipalities = data.filter((p: { isMunicipality?: boolean }) => p.isMunicipality);
    expect(municipalities).toHaveLength(6);
  });

  it('TC-LOC-02: GET /api/v1/provinces/:code/wards trả về danh sách xã theo mã tỉnh hoặc id tỉnh', async () => {
    // Gọi theo mã Hà Nội ('01')
    const res = await fetch('http://localhost:3000/api/v1/provinces/01/wards');
    expect(res.status).toBe(200);

    const body = await res.json();
    const hanoiWards = body.data;
    expect(hanoiWards.length).toBeGreaterThan(0);
    expect(hanoiWards.every((w: { provinceCode: string }) => w.provinceCode === '01')).toBe(true);

    // Gọi theo id Hà Nội
    const hanoi = provinces.find((p) => p.code === '01')!;
    const resById = await fetch(`http://localhost:3000/api/v1/provinces/${hanoi.id}/wards`);
    expect(resById.status).toBe(200);
    const bodyById = await resById.json();
    expect(bodyById.data.length).toBe(hanoiWards.length);
  });

  it('TC-LOC-04: GET /api/v1/wards/search tìm kiếm không dấu (unaccent)', async () => {
    const res = await fetch('http://localhost:3000/api/v1/wards/search?q=ben%20nghe');
    expect(res.status).toBe(200);

    const body = await res.json();
    const results = body.data;
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((w: { name: string }) => w.name.includes('Bến Nghé'))).toBe(true);
  });
});

describe('Venue Location Integrity (TC-LOC-06)', () => {
  const hanoi = provinces.find((p) => p.code === '01')!;
  const tphcm = provinces.find((p) => p.code === '79')!;
  const hanoiWard = wards.find((w) => w.provinceCode === '01')!;
  const tphcmWard = wards.find((w) => w.provinceCode === '79')!;
  const badmintonSportId = sports[0]!.id;

  it('TC-LOC-06: từ chối 422 khi wardId không thuộc provinceId đã chọn kèm thông báo tiếng Việt', async () => {
    // Gửi payload: province Hà Nội nhưng ward Bến Nghé (TP.HCM)
    const invalidPayload = {
      name: 'Sân Cầu Lông Lỗi Địa Bàn',
      address: '123 Đường Test',
      provinceId: hanoi.id,
      wardId: tphcmWard.id,
      sportIds: [badmintonSportId],
      lat: 21.0285,
      lng: 105.8542,
    };

    const res = await fetch('http://localhost:3000/api/v1/venues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidPayload),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error?.code).toBe('VALIDATION_ERROR');
    expect(body.error?.message).toMatch(/địa bàn|Xã\/phường/i);
  });

  it('TC-LOC-06: tạo cơ sở thành công (201) khi wardId thuộc đúng provinceId', async () => {
    const validPayload = {
      name: 'Sân Cầu Lông Ba Đình Mới',
      address: '456 Đội Cấn, Ba Đình',
      provinceId: hanoi.id,
      wardId: hanoiWard.id,
      sportIds: [badmintonSportId],
      lat: 21.0345,
      lng: 105.8198,
    };

    const res = await fetch('http://localhost:3000/api/v1/venues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data?.name).toBe('Sân Cầu Lông Ba Đình Mới');
    expect(body.data?.provinceId).toBe(hanoi.id);
    expect(body.data?.wardId).toBe(hanoiWard.id);
  });
});

describe('Bundle Guard (TC-LOC-10)', () => {
  it('TC-LOC-10: không có client component hay public route nào import trực tiếp wards.json', () => {
    const webRoot = path.resolve(__dirname, '../../');
    const clientDirs = [
      path.join(webRoot, 'components'),
      path.join(webRoot, 'app'),
    ];

    function scanFiles(dir: string): string[] {
      const results: string[] = [];
      if (!fs.existsSync(dir)) return results;
      const list = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of list) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...scanFiles(fullPath));
        } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const allClientFiles = clientDirs.flatMap(scanFiles);
    expect(allClientFiles.length).toBeGreaterThan(20);

    const offendingFiles: string[] = [];
    for (const file of allClientFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      if (content.includes('wards.json')) {
        offendingFiles.push(path.relative(webRoot, file));
      }
    }

    expect(offendingFiles).toEqual([]);
  });
});
