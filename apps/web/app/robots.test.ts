import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import robots from './robots';

describe('robots.ts metadata route (SPEC-FE-BATCH3-01 / TODO-12)', () => {
  const originalEnv = process.env.NEXT_PUBLIC_SITE_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://booksportscourt.vn';
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = originalEnv;
  });

  it('TC-SEO-01: trả về quy tắc robots chuẩn với allow, disallow và sitemap URL', () => {
    const config = robots();

    expect(config).toBeDefined();
    expect(config.sitemap).toBe('https://booksportscourt.vn/sitemap.xml');

    const rules = Array.isArray(config.rules) ? config.rules[0] : config.rules;
    expect(rules).toBeDefined();
    expect(rules?.userAgent).toBe('*');
    expect(rules?.allow).toEqual(['/', '/venues', '/venues/*']);
    expect(rules?.disallow).toEqual([
      '/admin/',
      '/owner/',
      '/bookings/',
      '/checkout/',
      '/api/',
    ]);
  });

  it('sử dụng URL fallback khi không cấu hình NEXT_PUBLIC_SITE_URL', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const config = robots();

    expect(config.sitemap).toBe('http://localhost:3000/sitemap.xml');
  });
});
