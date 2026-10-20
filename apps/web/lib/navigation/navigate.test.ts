import { afterEach, describe, expect, it } from 'vitest';
import { classifyNavigation } from './navigate';
import { cancelNavigation } from './navigation-store';

const ORIGIN = 'https://bsc.vn';

function classify(
  href: string | null,
  overrides: Partial<{
    pathname: string;
    search: string;
    download: boolean;
    target: string;
  }> = {},
) {
  return classifyNavigation(href, {
    pathname: '/owner/timeline',
    search: '',
    origin: ORIGIN,
    ...overrides,
  });
}

afterEach(() => {
  cancelNavigation();
});

describe('classifyNavigation', () => {
  it('UT-CLS-01: path nội bộ → internal', () => {
    expect(classify('/owner/bookings')).toEqual({
      kind: 'internal',
      href: '/owner/bookings',
    });
  });

  it('UT-CLS-02: origin khác → external', () => {
    expect(classify('https://example.com/venues').kind).toBe('external');
  });

  it('UT-CLS-03: hash → hash', () => {
    expect(classify('#section')).toEqual({ kind: 'hash', href: null });
  });

  it('UT-CLS-04: javascript: bị chặn như external', () => {
    expect(classify('javascript:alert(1)').kind).toBe('external');
    expect(classify('JavaScript:alert(1)').kind).toBe('external');
  });

  it('UT-CLS-05: mailto → external', () => {
    expect(classify('mailto:a@b.c').kind).toBe('external');
  });

  it('UT-CLS-06: trùng pathname + search → same-route', () => {
    expect(classify('/owner/timeline').kind).toBe('same-route');
  });

  it('UT-CLS-07: cùng pathname khác query → internal', () => {
    expect(classify('/owner/timeline?page=2')).toEqual({
      kind: 'internal',
      href: '/owner/timeline?page=2',
    });
  });

  it('UT-CLS-08: trim khoảng trắng trước khi phân loại', () => {
    expect(classify('  /owner/bookings  ')).toEqual({
      kind: 'internal',
      href: '/owner/bookings',
    });
  });

  it('UT-CLS-09: target="_blank" → external', () => {
    expect(classify('/owner/bookings', { target: '_blank' }).kind).toBe(
      'external',
    );
  });

  it('UT-CLS-10: download → download', () => {
    expect(classify('/export.csv', { download: true }).kind).toBe('download');
  });

  it('UT-CLS-11: bỏ trailing slash khi so sánh', () => {
    expect(classify('/owner/timeline/', { pathname: '/owner/timeline' }).kind).toBe(
      'same-route',
    );
    expect(classify('/venues/', { pathname: '/venues' }).kind).toBe('same-route');
  });

  it('UT-CLS-12: href rỗng → same-route (không start)', () => {
    expect(classify('').kind).toBe('same-route');
    expect(classify(null).kind).toBe('same-route');
    expect(classify('   ').kind).toBe('same-route');
  });

  it('UT-CLS-13: search hiện tại không có "?" vẫn so đúng', () => {
    expect(
      classify('/owner/timeline?page=2', {
        search: 'page=2',
        pathname: '/owner/timeline',
      }).kind,
    ).toBe('same-route');
  });

  it('UT-CLS-14: URL tuyệt đối cùng origin là internal', () => {
    expect(classify(`${ORIGIN}/owner/payments`)).toEqual({
      kind: 'internal',
      href: '/owner/payments',
    });
  });

  it('UT-CLS-15: tel: bị chặn', () => {
    expect(classify('tel:+84901234567').kind).toBe('external');
  });
});
